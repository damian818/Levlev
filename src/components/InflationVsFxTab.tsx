import React, { useState, useEffect } from 'react';
import { InflationPoint } from '../types';
import { historicalInflationAndFX } from '../data/defaultTransactions';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, AlertCircle, HelpCircle, RefreshCw, DollarSign, Activity, CheckCircle2, Calculator, ArrowRight, TrendingDown, Percent } from 'lucide-react';

interface FxRateDetail {
  buy: number;
  sell: number;
  name: string;
  updated: string;
}

interface InflationVsFxTabProps {
  historyData?: InflationPoint[];
}

export function InflationVsFxTab({ historyData: initialHistory }: InflationVsFxTabProps) {
  const [historyData, setHistoryData] = useState<InflationPoint[]>(initialHistory || historicalInflationAndFX);
  const [liveRates, setLiveRates] = useState<Record<string, FxRateDetail> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sourceInfo, setSourceInfo] = useState<string>('Historical Initial Data');
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<boolean>(false);

  // Interactive Calculator State
  const [calcInputType, setCalcInputType] = useState<'ARS' | 'USD'>('USD');
  const [calcAmount, setCalcAmount] = useState<number>(5000);
  const [startMonth, setStartMonth] = useState<string>('2024-01');

  const FINLEV_CACHE_KEY = 'finlev_fx_data_cache';

  const fetchLiveMetrics = async () => {
    setIsLoading(true);
    setFetchError(false);
    try {
      const [fxRes, inflRes] = await Promise.all([
        fetch('/api/fx-rates').catch(() => null),
        fetch('/api/inflation-fx-history').catch(() => null)
      ]);

      let newLiveRates = null;
      let newHistoryData = null;
      let success = false;

      if (fxRes && fxRes.ok) {
        const fxJson = await fxRes.json();
        if (fxJson.rates) {
          newLiveRates = fxJson.rates;
          setLiveRates(newLiveRates);
          success = true;
        }
      }

      if (inflRes && inflRes.ok) {
        const inflJson = await inflRes.json();
        if (inflJson.points && inflJson.points.length > 0) {
          newHistoryData = inflJson.points;
          setHistoryData(newHistoryData);
          setSourceInfo(inflJson.source || 'ArgentinaDatos API');
          success = true;
        }
      }

      if (success) {
        setLastFetched(new Date().toLocaleTimeString());
        
        // Save to cache
        localStorage.setItem(FINLEV_CACHE_KEY, JSON.stringify({
          liveRates: newLiveRates || liveRates,
          historyData: newHistoryData || historyData,
          sourceInfo: 'Cached Data',
          lastFetched: new Date().toLocaleTimeString()
        }));
      } else {
        // Try load from cache
        const cached = localStorage.getItem(FINLEV_CACHE_KEY);
        if (cached) {
          const { liveRates: cRates, historyData: cHistory, sourceInfo: cSource, lastFetched: cTime } = JSON.parse(cached);
          if (cRates) setLiveRates(cRates);
          if (cHistory) setHistoryData(cHistory);
          setSourceInfo(`${cSource} (Cached at ${cTime})`);
          setLastFetched(cTime);
        } else {
          setFetchError(true);
        }
      }
    } catch (err) {
      console.error('Failed to load live inflation/fx data:', err);
      // Try load from cache
      const cached = localStorage.getItem(FINLEV_CACHE_KEY);
      if (cached) {
        const { liveRates: cRates, historyData: cHistory, sourceInfo: cSource, lastFetched: cTime } = JSON.parse(cached);
        if (cRates) setLiveRates(cRates);
        if (cHistory) setHistoryData(cHistory);
        setSourceInfo(`${cSource} (Cached at ${cTime})`);
        setLastFetched(cTime);
      } else {
        setFetchError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialHistory && initialHistory.length > 0) {
      setHistoryData(initialHistory);
    } else {
      fetchLiveMetrics();
    }
  }, [initialHistory]);

  // Compute key summary statistics
  const firstPoint = historyData[0] || { month: '2024-01', inflationIndex: 100, usdArsRate: 1177 };
  const lastPoint = historyData[historyData.length - 1] || { month: '2026-08', inflationIndex: 169.1, usdArsRate: 1521 };
  
  const cumulativeInflationPct = ((lastPoint.inflationIndex - firstPoint.inflationIndex) / firstPoint.inflationIndex) * 100;
  
  const initialFx = firstPoint.usdArsRate || 1177;
  const currentFx = lastPoint.usdArsRate || (liveRates?.bolsa?.sell ?? 1521);
  const fxDevaluationPct = ((currentFx - initialFx) / initialFx) * 100;

  // Real USD Purchasing Power relative to Inflation (Ratio < 100% means USD lost local purchasing power)
  const usdRealPurchasingPowerIndex = ((1 + fxDevaluationPct / 100) / (1 + cumulativeInflationPct / 100)) * 100;
  const realPurchasingPowerLossPct = 100 - usdRealPurchasingPowerIndex;

  // Calculator logic
  const selectedStartPoint = historyData.find(p => p.month === startMonth) || firstPoint;
  const inflationMultiplier = lastPoint.inflationIndex / selectedStartPoint.inflationIndex;

  let calcInitialARS = 0;
  let calcRequiredARSToday = 0;
  let calcCurrentARS = 0;
  let calcRequiredUSDToday = 0;
  let calcPurchasingPowerChange = 0;

  if (calcInputType === 'USD') {
    calcInitialARS = calcAmount * selectedStartPoint.usdArsRate;
    calcRequiredARSToday = calcInitialARS * inflationMultiplier;
    calcCurrentARS = calcAmount * currentFx;
    calcRequiredUSDToday = currentFx > 0 ? calcRequiredARSToday / currentFx : 0;
    calcPurchasingPowerChange = ((calcCurrentARS - calcRequiredARSToday) / calcRequiredARSToday) * 100;
  } else {
    calcInitialARS = calcAmount;
    calcRequiredARSToday = calcAmount * inflationMultiplier;
    calcCurrentARS = calcAmount;
    calcPurchasingPowerChange = ((calcAmount - calcRequiredARSToday) / calcRequiredARSToday) * 100;
  }

  // Generate chart data for Real Purchasing Power trajectory over time
  const realPurchasingPowerTrajectory = historyData.map(pt => {
    const ptInflation = pt.inflationIndex / firstPoint.inflationIndex;
    const ptFxDeval = pt.usdArsRate / firstPoint.usdArsRate;
    // Real value of $1,000 USD in terms of local ARS basket of goods
    const realUsdPower = (ptFxDeval / ptInflation) * 100;

    return {
      month: pt.month,
      inflationIndex: pt.inflationIndex,
      usdArsRate: pt.usdArsRate,
      realUsdPower: parseFloat(realUsdPower.toFixed(1)),
    };
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#161b22] p-4 sm:p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 sm:p-2.5 bg-slate-800 border border-slate-700 text-emerald-400 rounded-xl shadow-inner">
            <TrendingUp className="w-5 h-5 sm:w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-100">Live Inflation vs. USD/ARS</h3>
              {fetchError ? (
                <span className="hidden xs:inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertCircle className="w-3 h-3 mr-1" /> API Sync Failed
                </span>
              ) : lastFetched ? (
                <span className="hidden xs:inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> API Connected
                </span>
              ) : (
                <span className="hidden xs:inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                  <Activity className="w-3 h-3 mr-1" /> Initializing Sync...
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
              Live economic intelligence from DolarApi & ArgentinaDatos.
            </p>
          </div>
        </div>

        <button
          onClick={fetchLiveMetrics}
          disabled={isLoading}
          className="inline-flex items-center justify-center px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] sm:text-xs font-semibold text-slate-200 rounded-lg transition-colors shadow-xs w-full md:w-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-2 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Syncing...' : 'Refresh Live API'}</span>
        </button>
      </div>

      {/* Live Exchange Rate Ticker Cards */}
      {liveRates && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { key: 'bolsa', label: 'Dólar MEP', detail: liveRates.bolsa, badge: 'MEP' },
            { key: 'blue', label: 'Dólar Blue', detail: liveRates.blue, badge: 'Blue' },
            { key: 'oficial', label: 'Dólar Oficial', detail: liveRates.oficial, badge: 'BCRA' },
            { key: 'cripto', label: 'Dólar Cripto', detail: liveRates.cripto, badge: 'USDT' },
            { key: 'contadoconliqui', label: 'CCL', detail: liveRates.contadoconliqui, badge: 'CCL' },
            { key: 'tarjeta', label: 'Tarjeta', detail: liveRates.tarjeta, badge: 'Card' },
          ].map(({ key, label, detail, badge }) => (
            <div key={key} className="bg-[#161b22] p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors shadow-xs">
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 truncate">{label}</span>
                <span className="text-[8px] px-1 py-0.5 rounded bg-slate-800 text-slate-300 font-medium whitespace-nowrap">{badge}</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
                ${detail ? detail.sell.toLocaleString('es-AR', { maximumFractionDigits: 0 }) : '—'}
              </div>
              <div className="text-[8px] sm:text-[9px] text-slate-500 mt-1 flex justify-between">
                <span>V: ${detail ? detail.sell : '—'}</span>
                <span>C: ${detail ? detail.buy : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key Analysis Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#161b22] p-3 sm:p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs">
            <span>Cumulative Inflation</span>
            <Activity className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-rose-400">
            +{cumulativeInflationPct.toFixed(1)}%
          </div>
          <p className="text-[9px] sm:text-[11px] text-slate-500">IPC increase over period.</p>
        </div>

        <div className="bg-[#161b22] p-3 sm:p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs">
            <span>USD/ARS Devaluation</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-emerald-400">
            +{fxDevaluationPct.toFixed(1)}%
          </div>
          <p className="text-[9px] sm:text-[11px] text-slate-500">From ${initialFx} to ${currentFx}.</p>
        </div>

        <div className="bg-[#161b22] p-3 sm:p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs">
            <span>Real USD Power</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className={`text-lg sm:text-xl font-bold ${usdRealPurchasingPowerIndex >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {usdRealPurchasingPowerIndex.toFixed(1)}%
          </div>
          <p className="text-[9px] sm:text-[11px] text-slate-500 truncate">
            {usdRealPurchasingPowerIndex < 100
              ? `Lost ${realPurchasingPowerLossPct.toFixed(1)}% local power.`
              : 'USD outpaced inflation.'}
          </p>
        </div>
      </div>

      {/* NEW: Interactive Earning & Expense Purchasing Power Calculator */}
      <div className="bg-[#161b22] p-4 sm:p-5 rounded-xl border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
          <div className="p-1.5 sm:p-2 bg-amber-950/60 border border-amber-800/50 text-amber-400 rounded-lg">
            <Calculator className="w-4 h-4 sm:w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-100">Purchasing Power Calculator</h3>
            <p className="text-[10px] sm:text-xs text-slate-400">Calculate local inflation impact on earnings.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#121620] p-3 rounded-xl border border-slate-800">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Currency Type</label>
            <div className="grid grid-cols-2 gap-1 bg-[#161b22] p-0.5 rounded-lg border border-slate-700">
              <button
                onClick={() => setCalcInputType('USD')}
                className={`py-1 rounded text-[10px] font-semibold transition-colors ${calcInputType === 'USD' ? 'bg-emerald-950 text-emerald-300' : 'text-slate-500'}`}
              >
                USD
              </button>
              <button
                onClick={() => setCalcInputType('ARS')}
                className={`py-1 rounded text-[10px] font-semibold transition-colors ${calcInputType === 'ARS' ? 'bg-slate-800 text-slate-200' : 'text-slate-500'}`}
              >
                ARS
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">
              Monthly Amount
            </label>
            <input
              type="number"
              value={calcAmount}
              onChange={(e) => setCalcAmount(Number(e.target.value) || 0)}
              className="w-full px-3 py-1 bg-[#161b22] border border-slate-700 rounded-lg text-xs font-bold text-slate-100 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Baseline Month</label>
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="w-full px-3 py-1 bg-[#161b22] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100 focus:outline-none"
            >
              {historyData.map(pt => (
                <option key={pt.month} value={pt.month}>
                  {pt.month}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Calculation Result Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-[#121620] border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-500 block">Baseline Value</span>
            <div className="text-sm sm:text-base font-bold text-slate-200">
              {calcInputType === 'USD' ? `$${calcAmount.toLocaleString()} USD` : `$${calcAmount.toLocaleString()} ARS`}
            </div>
            <p className="text-[9px] text-slate-600">
              ARS: ${calcInitialARS.toLocaleString('es-AR')} in {startMonth}.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#121620] border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-500 block">Required for Power Today</span>
            <div className="text-sm sm:text-base font-bold text-emerald-400">
              {calcInputType === 'USD'
                ? `$${Math.round(calcRequiredUSDToday).toLocaleString()} USD`
                : `$${Math.round(calcRequiredARSToday).toLocaleString('es-AR')} ARS`}
            </div>
            <p className="text-[9px] text-slate-600 truncate">
              Equivalent: ${Math.round(calcRequiredARSToday).toLocaleString('es-AR')} ARS.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#121620] border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-500 block">Power Impact</span>
            <div className={`text-sm sm:text-base font-bold ${calcPurchasingPowerChange >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {calcPurchasingPowerChange.toFixed(1)}%
            </div>
            <p className="text-[9px] text-slate-600">
              {calcPurchasingPowerChange < 0
                ? `Lost ${Math.abs(calcPurchasingPowerChange).toFixed(1)}% power.`
                : 'Maintained power.'}
            </p>
          </div>
        </div>
      </div>

      {/* Real USD Purchasing Power Index Chart */}
      <div className="bg-[#161b22] p-4 sm:p-5 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-100">Real USD Purchasing Power Trajectory</h4>
            <p className="text-[10px] sm:text-xs text-slate-400">USD power relative to local ARS inflation (Base 100 = Jan 2024).</p>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={realPurchasingPowerTrajectory} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="month" stroke="#8b949e" fontSize={9} tickFormatter={(val) => val.split(' ')[0]} />
              <YAxis stroke="#8b949e" fontSize={9} domain={['auto', 'auto']} />
              <Tooltip 
                formatter={(val: any) => [`${val}% of Initial Power`, 'Real Power']}
                contentStyle={{ backgroundColor: '#161b22', color: '#f0f6fc', borderRadius: '8px', border: '1px solid #30363d', fontSize: '11px' }} 
              />
              <Area type="monotone" dataKey="realUsdPower" name="Real USD Power %" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#powerGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interactive Main Chart */}
      <div className="bg-[#161b22] p-4 sm:p-5 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-100">Cumulative IPC Inflation vs. Exchange Rate</h4>
            <p className="text-[10px] sm:text-xs text-slate-400">Comparison curves using INDEC CPI monthly inflation index.</p>
          </div>
        </div>

        <div className="h-64 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="month" stroke="#8b949e" fontSize={9} tickFormatter={(val) => val.split(' ')[0]} />
              <YAxis yAxisId="left" stroke="#fb7185" fontSize={9} domain={['auto', 'auto']} />
              <YAxis yAxisId="right" orientation="right" stroke="#34d399" fontSize={9} domain={['auto', 'auto']} hide={true} />
              <Tooltip contentStyle={{ backgroundColor: '#161b22', color: '#f0f6fc', borderRadius: '8px', border: '1px solid #30363d', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
              <Line yAxisId="left" type="monotone" dataKey="inflationIndex" name="Inflation Index" stroke="#fb7185" strokeWidth={2.5} dot={{ r: 2 }} />
              <Line yAxisId="right" type="monotone" dataKey="usdArsRate" name="USD/ARS Rate" stroke="#34d399" strokeWidth={2.5} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Explanatory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
            <AlertCircle className="w-4 h-4" />
            <span>Understanding USD Inflation Lag in Argentina</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            When domestic inflation in pesos runs higher than the rate at which the US dollar depreciates or devalues against the peso, expenses priced in pesos (such as rent, groceries, and utilities) increase in USD terms. This creates local "cost-of-living inflation in USD".
          </p>
        </div>

        <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" />
            <span>Multi-Currency Asset Protection</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Keeping multi-currency balances across digital dollar accounts (such as Deel, DollarApp, and Cocos) enables seamless conversion at real market rates (Dólar MEP or Blue) when liquidity is needed, mitigating currency devaluation risks.
          </p>
        </div>
      </div>
    </div>
  );
}
