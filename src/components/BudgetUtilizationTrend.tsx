import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Area, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Zap,
  Info
} from 'lucide-react';
import { Transaction, BudgetGoal, DisplayCurrency, BudgetStreakAlert } from '../types';
import { 
  formatCurrency, 
  computeBudgetUtilizationTrend, 
  computeBudgetStreakAlerts 
} from '../utils/financeUtils';

interface BudgetUtilizationTrendProps {
  transactions: Transaction[];
  budgets: BudgetGoal[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  onApplyProposedLimit: (category: string, newLimitDisplay: number) => void;
  onApplyAllProposedLimits?: (proposals: { category: string; newLimitDisplay: number }[]) => void;
}

export function BudgetUtilizationTrend({
  transactions,
  budgets,
  displayCurrency,
  usdArsRate,
  onApplyProposedLimit,
  onApplyAllProposedLimits,
}: BudgetUtilizationTrendProps) {
  const { t, i18n } = useTranslation();
  const isSpanish = (i18n.language || '').toLowerCase().startsWith('es');

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [appliedCategories, setAppliedCategories] = useState<Set<string>>(new Set());
  const [isChartExpanded, setIsChartExpanded] = useState<boolean>(true);

  // Compute trend points across all available recent months (up to 8 months)
  const trendData = useMemo(() => {
    return computeBudgetUtilizationTrend(transactions, budgets, displayCurrency, usdArsRate, 8);
  }, [transactions, budgets, displayCurrency, usdArsRate]);

  // Compute 3-month streak alerts for over budget or under 80%
  const streakAlerts = useMemo(() => {
    return computeBudgetStreakAlerts(transactions, budgets, displayCurrency, usdArsRate);
  }, [transactions, budgets, displayCurrency, usdArsRate]);

  // Chart data formatted according to selected category or overall
  const chartPoints = useMemo(() => {
    return trendData.map(pt => {
      if (selectedCategoryFilter === 'ALL') {
        return {
          month: pt.month,
          label: pt.label,
          utilization: pt.utilization,
          spent: pt.totalSpent,
          limit: pt.totalBudgeted,
          isOver: pt.isOver,
        };
      }

      const catData = pt.categoryBreakdown?.[selectedCategoryFilter];
      const spent = catData ? catData.spent : 0;
      const limit = catData ? catData.limit : 0;
      const utilization = catData ? catData.utilization : 0;

      return {
        month: pt.month,
        label: pt.label,
        utilization,
        spent,
        limit,
        isOver: utilization > 100,
      };
    });
  }, [trendData, selectedCategoryFilter]);

  // Key metrics from trend
  const latestPoint = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1] : null;
  const previousPoint = chartPoints.length > 1 ? chartPoints[chartPoints.length - 2] : null;

  const currentUtilization = latestPoint ? latestPoint.utilization : 0;
  const prevUtilization = previousPoint ? previousPoint.utilization : null;
  const utilizationDelta = prevUtilization !== null ? currentUtilization - prevUtilization : 0;

  const averageUtilization = useMemo(() => {
    if (chartPoints.length === 0) return 0;
    const sum = chartPoints.reduce((acc, p) => acc + p.utilization, 0);
    return Math.round((sum / chartPoints.length) * 10) / 10;
  }, [chartPoints]);

  const handleApplySingle = (category: string, proposedLimit: number) => {
    onApplyProposedLimit(category, proposedLimit);
    setAppliedCategories(prev => new Set(prev).add(category));
  };

  const handleApplyAll = () => {
    const unapplied = streakAlerts
      .filter(a => !appliedCategories.has(a.category))
      .map(a => ({ category: a.category, newLimitDisplay: a.proposedLimitDisplay }));
    
    if (onApplyAllProposedLimits && unapplied.length > 0) {
      onApplyAllProposedLimits(unapplied);
    } else {
      unapplied.forEach(item => {
        onApplyProposedLimit(item.category, item.newLimitDisplay);
      });
    }

    setAppliedCategories(prev => {
      const next = new Set(prev);
      unapplied.forEach(item => next.add(item.category));
      return next;
    });
  };

  const unappliedAlerts = streakAlerts.filter(a => !appliedCategories.has(a.category));

  if (trendData.length === 0 && streakAlerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 3-Month Consecutive Utilization Alerts & Quick Actions Banner */}
      {streakAlerts.length > 0 && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#141b2b] via-[#111827] to-[#141b2b] rounded-2xl border border-amber-500/30 shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>{isSpanish ? 'Acciones Rápidas: Últimos 3 Meses Cerrados' : 'Quick Actions: Last 3 Completed Months'}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {unappliedAlerts.length} {isSpanish ? 'sugerencias' : 'proposals'}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isSpanish
                    ? 'Categorías con desviaciones sostenidas en los últimos 3 meses cerrados (excluyendo el mes en curso). Aplica nuevos límites con un clic.'
                    : 'Categories consistently over or under budget across the last 3 completed months (excluding ongoing month). Adjust limits with one click.'}
                </p>
              </div>
            </div>

            {unappliedAlerts.length > 1 && (
              <button
                onClick={handleApplyAll}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center space-x-1.5 cursor-pointer shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSpanish ? `Aplicar Todos (${unappliedAlerts.length})` : `Apply All Proposals (${unappliedAlerts.length})`}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
            {streakAlerts.map(alert => {
              const isApplied = appliedCategories.has(alert.category);
              const isOver = alert.type === 'OVER_BUDGET_3M';

              return (
                <div 
                  key={alert.category}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isApplied 
                      ? 'bg-slate-900/40 border-slate-800 opacity-70' 
                      : isOver 
                        ? 'bg-rose-950/20 border-rose-800/50' 
                        : 'bg-emerald-950/20 border-emerald-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${
                          isOver 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {isOver 
                            ? (isSpanish ? 'Excedido 3 meses seguidos' : 'Over budget 3 months in a row')
                            : (isSpanish ? 'Bajo 80% por 3 meses seguidos' : 'Under 80% for 3 months in a row')}
                        </span>
                        <h5 className="text-xs font-bold text-slate-100">{alert.category}</h5>
                      </div>

                      {/* 3-month history pill sequence */}
                      <div className="flex items-center space-x-1.5 mt-2">
                        <span className="text-[10px] text-slate-400">{isSpanish ? 'Historial:' : 'Trend:'}</span>
                        {alert.history.map((h, i) => (
                          <span 
                            key={h.month}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              h.utilization > 100 
                                ? 'bg-rose-900/50 text-rose-300' 
                                : h.utilization < 80 
                                  ? 'bg-emerald-900/50 text-emerald-300' 
                                  : 'bg-slate-800 text-slate-300'
                            }`}
                            title={`${h.month}: ${formatCurrency(h.spentDisplay, displayCurrency)}`}
                          >
                            {h.month.slice(5)}: {h.utilization.toFixed(0)}%
                            {i < alert.history.length - 1 && <span className="text-slate-500 ml-1">→</span>}
                          </span>
                        ))}
                      </div>

                      {/* Comparison: Current vs Proposed */}
                      <div className="flex items-center space-x-2 text-xs mt-2 text-slate-300">
                        <span className="text-slate-400">
                          {isSpanish ? 'Actual:' : 'Current:'} <strong className="line-through text-slate-400 font-mono">{formatCurrency(alert.currentLimitDisplay, displayCurrency)}</strong>
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>
                          {isSpanish ? 'Propuesto:' : 'Proposed:'} <strong className={`font-mono font-bold ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(alert.proposedLimitDisplay, displayCurrency)}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Quick action button */}
                    <div className="shrink-0 self-center">
                      {isApplied ? (
                        <div className="flex items-center space-x-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isSpanish ? 'Aplicado' : 'Applied'}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleApplySingle(alert.category, alert.proposedLimitDisplay)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-1.5 ${
                            isOver 
                              ? 'bg-rose-600 hover:bg-rose-500 text-white' 
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{isSpanish ? 'Aplicar Límite' : 'Apply Limit'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Utilization Trend Analysis Section */}
      <div className="bg-[#111622] p-4 sm:p-5 rounded-2xl border border-slate-800/90 shadow-sm space-y-4">
        {/* Header with Title, Category Filter, and Collapse Toggle */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>{isSpanish ? 'Tendencia de Utilización de Presupuesto' : 'Budget Utilization Trend'}</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {isSpanish ? 'Evolución mensual del porcentaje de presupuesto utilizado.' : 'Monthly evolution of spending vs. budgeted limits over time.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {/* Category Filter Selector */}
            <div className="flex items-center space-x-1.5 bg-[#161d2b] px-2.5 py-1 rounded-xl border border-slate-700/80 text-xs flex-1 sm:flex-none">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-transparent border-none text-xs text-slate-100 font-bold focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL" className="bg-[#161d2b] text-slate-100">
                  {isSpanish ? 'Todo el Presupuesto (General)' : 'All Budgeted (Overall)'}
                </option>
                {budgets.map(b => (
                  <option key={b.category} value={b.category} className="bg-[#161d2b] text-slate-100">
                    {b.category}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsChartExpanded(prev => !prev)}
              className="p-1.5 rounded-xl border border-slate-700/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title={isChartExpanded ? 'Collapse Trend' : 'Expand Trend'}
            >
              {isChartExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* KPI Mini-Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-[#161d2b]/80 border border-slate-800 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {isSpanish ? 'Utilización Último Mes' : 'Latest Month Utilization'}
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className={`text-lg font-black font-mono ${
                currentUtilization > 100 
                  ? 'text-rose-400' 
                  : currentUtilization < 80 
                    ? 'text-emerald-400' 
                    : 'text-amber-400'
              }`}>
                {currentUtilization.toFixed(1)}%
              </span>
              {utilizationDelta !== 0 && (
                <span className={`text-[10px] font-bold flex items-center ${
                  utilizationDelta > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {utilizationDelta > 0 ? <TrendingUp className="w-3 h-3 mr-0.5 inline" /> : <TrendingDown className="w-3 h-3 mr-0.5 inline" />}
                  {Math.abs(utilizationDelta).toFixed(1)}%
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {latestPoint ? latestPoint.label : '-'}
            </span>
          </div>

          <div className="p-3 bg-[#161d2b]/80 border border-slate-800 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {isSpanish ? 'Promedio del Período' : 'Period Average'}
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className={`text-lg font-black font-mono ${
                averageUtilization > 100 ? 'text-rose-400' : 'text-slate-100'
              }`}>
                {averageUtilization.toFixed(1)}%
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {isSpanish ? `Sobre ${chartPoints.length} meses analizados` : `Across ${chartPoints.length} analyzed months`}
            </span>
          </div>

          <div className="p-3 bg-[#161d2b]/80 border border-slate-800 rounded-xl col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {isSpanish ? 'Zona Óptima' : 'Target Thresholds'}
            </span>
            <div className="flex items-center space-x-3 mt-1.5 text-xs">
              <div className="flex items-center space-x-1 text-emerald-400 font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                <span>&lt;80%</span>
              </div>
              <div className="flex items-center space-x-1 text-amber-400 font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                <span>80-100%</span>
              </div>
              <div className="flex items-center space-x-1 text-rose-400 font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
                <span>&gt;100%</span>
              </div>
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {isSpanish ? 'Líneas guía punteadas' : 'Reference guide lines'}
            </span>
          </div>
        </div>

        {/* Recharts Area/Line Chart */}
        {isChartExpanded && chartPoints.length > 0 && (
          <div className="pt-2">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="utilizationGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={{ stroke: '#334155' }}
                    tickFormatter={(val) => `${val}%`}
                    domain={[0, (dataMax: number) => Math.max(120, Math.ceil(dataMax / 20) * 20)]}
                  />
                  <Tooltip 
                    content={<CustomTrendTooltip displayCurrency={displayCurrency} isSpanish={isSpanish} />}
                  />
                  {/* Reference line for 100% Limit */}
                  <ReferenceLine 
                    y={100} 
                    stroke="#f43f5e" 
                    strokeDasharray="4 4" 
                    label={{ 
                      value: '100% Limit', 
                      fill: '#f43f5e', 
                      fontSize: 10, 
                      position: 'top',
                      offset: 4
                    }} 
                  />
                  {/* Reference line for 80% Target */}
                  <ReferenceLine 
                    y={80} 
                    stroke="#f59e0b" 
                    strokeDasharray="4 4" 
                    label={{ 
                      value: '80% Target', 
                      fill: '#f59e0b', 
                      fontSize: 10, 
                      position: 'bottom',
                      offset: 4
                    }} 
                  />
                  <Area
                    type="monotone"
                    dataKey="utilization"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#utilizationGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="utilization"
                    stroke="#818cf8"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#818cf8', stroke: '#1e1b4b', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#a5b4fc', stroke: '#fff', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
              <span className="flex items-center space-x-1">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {selectedCategoryFilter === 'ALL'
                    ? (isSpanish ? 'Utilización general de todas las categorías con meta' : 'Overall utilization across all budgeted categories')
                    : (isSpanish ? `Utilización de la categoría "${selectedCategoryFilter}"` : `Utilization for "${selectedCategoryFilter}"`)}
                </span>
              </span>
              <span className="font-mono text-slate-300 font-medium">
                {isSpanish ? 'Meta recomendada: 80%' : 'Recommended ceiling: 80%'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  displayCurrency: DisplayCurrency;
  isSpanish: boolean;
}

function CustomTrendTooltip({ active, payload, label, displayCurrency, isSpanish }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const utilization: number = data.utilization || 0;
  const spent: number = data.spent || 0;
  const limit: number = data.limit || 0;
  const isOver: boolean = utilization > 100;

  return (
    <div className="bg-[#0f172a] border border-slate-700 p-3 rounded-xl shadow-xl space-y-1.5 text-xs min-w-[170px]">
      <div className="flex justify-between items-center border-b border-slate-800 pb-1">
        <span className="font-bold text-slate-200">{data.month} ({label})</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
          isOver 
            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
            : utilization < 80 
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
        }`}>
          {utilization.toFixed(1)}%
        </span>
      </div>

      <div className="flex justify-between text-slate-400 pt-0.5">
        <span>{isSpanish ? 'Gastado:' : 'Spent:'}</span>
        <strong className="text-slate-100 font-mono">{formatCurrency(spent, displayCurrency)}</strong>
      </div>

      <div className="flex justify-between text-slate-400">
        <span>{isSpanish ? 'Límite:' : 'Limit:'}</span>
        <strong className="text-slate-100 font-mono">{formatCurrency(limit, displayCurrency)}</strong>
      </div>

      <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800 text-[11px]">
        <span>{isSpanish ? 'Estado:' : 'Status:'}</span>
        <span className={`font-bold ${isOver ? 'text-rose-400' : utilization < 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
          {isOver 
            ? (isSpanish ? 'Excedido' : 'Over Budget') 
            : utilization < 80 
              ? (isSpanish ? 'Bajo Límite (<80%)' : 'Under 80% (Optimal)') 
              : (isSpanish ? 'Cerca del Límite' : 'Near Limit (80-100%)')}
        </span>
      </div>
    </div>
  );
}
