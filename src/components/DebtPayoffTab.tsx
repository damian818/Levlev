import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DebtItem, DebtPayoffStrategy, DisplayCurrency } from '../types';
import { 
  getSavedDebts, 
  saveDebtsToStorage, 
  getSavedDebtStrategy, 
  saveDebtStrategyToStorage, 
  getSavedExtraPayment, 
  saveExtraPaymentToStorage, 
  simulateDebtPayoff,
  DEFAULT_SAMPLE_DEBTS,
  DebtSimulationResult
} from '../utils/debtUtils';
import { formatCurrency } from '../utils/financeUtils';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { 
  CreditCard, 
  TrendingDown, 
  Zap, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Calendar, 
  DollarSign, 
  ShieldCheck, 
  Info, 
  ArrowRight, 
  Award, 
  Flame, 
  Snowflake, 
  Download, 
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface DebtPayoffTabProps {
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  currentUserId?: string;
}

export function DebtPayoffTab({
  displayCurrency,
  usdArsRate,
  currentUserId,
}: DebtPayoffTabProps) {
  const { t } = useTranslation();

  const [debts, setDebts] = useState<DebtItem[]>(() => getSavedDebts());
  const [strategy, setStrategy] = useState<DebtPayoffStrategy>(() => getSavedDebtStrategy());
  const [extraPayment, setExtraPayment] = useState<number>(() => getSavedExtraPayment());
  const [isAddingDebt, setIsAddingDebt] = useState<boolean>(false);
  const [editingDebt, setEditingDebt] = useState<DebtItem | null>(null);
  const [showAmortization, setShowAmortization] = useState<boolean>(false);

  // Form state
  const [formName, setFormName] = useState<string>('');
  const [formBalance, setFormBalance] = useState<string>('');
  const [formRate, setFormRate] = useState<string>('19.99');
  const [formMinPayment, setFormMinPayment] = useState<string>('');
  const [formCategory, setFormCategory] = useState<DebtItem['category']>('CREDIT_CARD');
  const [formDueDay, setFormDueDay] = useState<string>('15');
  const [formNotes, setFormNotes] = useState<string>('');

  // Persist changes
  useEffect(() => {
    saveDebtsToStorage(debts);
  }, [debts]);

  useEffect(() => {
    saveDebtStrategyToStorage(strategy);
  }, [strategy]);

  useEffect(() => {
    saveExtraPaymentToStorage(extraPayment);
  }, [extraPayment]);

  // Run simulation for selected strategy
  const simResult: DebtSimulationResult = useMemo(() => {
    return simulateDebtPayoff(debts, strategy, extraPayment);
  }, [debts, strategy, extraPayment]);

  // Also simulate alternative strategy for direct comparison
  const altStrategy: DebtPayoffStrategy = strategy === 'SNOWBALL' ? 'AVALANCHE' : 'SNOWBALL';
  const altSimResult: DebtSimulationResult = useMemo(() => {
    return simulateDebtPayoff(debts, altStrategy, extraPayment);
  }, [debts, altStrategy, extraPayment]);

  const totalMinPaymentSum = useMemo(() => {
    return debts.reduce((sum, d) => sum + (Number(d.minPayment) || 0), 0);
  }, [debts]);

  const totalBalanceSum = useMemo(() => {
    return debts.reduce((sum, d) => sum + (Number(d.balance) || 0), 0);
  }, [debts]);

  const handleOpenAddModal = () => {
    setEditingDebt(null);
    setFormName('');
    setFormBalance('');
    setFormRate('18.0');
    setFormMinPayment('');
    setFormCategory('CREDIT_CARD');
    setFormDueDay('15');
    setFormNotes('');
    setIsAddingDebt(true);
  };

  const handleOpenEditModal = (debt: DebtItem) => {
    setEditingDebt(debt);
    setFormName(debt.name);
    setFormBalance(String(debt.balance));
    setFormRate(String(debt.interestRate));
    setFormMinPayment(String(debt.minPayment));
    setFormCategory(debt.category || 'CREDIT_CARD');
    setFormDueDay(debt.dueDay ? String(debt.dueDay) : '15');
    setFormNotes(debt.notes || '');
    setIsAddingDebt(true);
  };

  const handleSaveDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = parseFloat(formBalance);
    const rateNum = parseFloat(formRate);
    const minPayNum = parseFloat(formMinPayment);

    if (!formName.trim() || isNaN(balanceNum) || balanceNum < 0 || isNaN(rateNum) || isNaN(minPayNum)) {
      return;
    }

    if (editingDebt) {
      setDebts(prev => {
        const next = prev.map(d => d.id === editingDebt.id ? {
          ...d,
          name: formName.trim(),
          balance: balanceNum,
          interestRate: rateNum,
          minPayment: minPayNum,
          category: formCategory,
          dueDay: parseInt(formDueDay, 10) || 15,
          notes: formNotes.trim(),
        } : d);
        saveDebtsToStorage(next);
        return next;
      });
    } else {
      const newDebt: DebtItem = {
        id: `debt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: formName.trim(),
        balance: balanceNum,
        interestRate: rateNum,
        minPayment: minPayNum,
        currency: 'USD',
        category: formCategory,
        dueDay: parseInt(formDueDay, 10) || 15,
        notes: formNotes.trim(),
      };
      setDebts(prev => {
        const next = [...prev, newDebt];
        saveDebtsToStorage(next);
        return next;
      });
    }

    setIsAddingDebt(false);
  };

  const handleDeleteDebt = (id: string) => {
    setDebts(prev => {
      const next = prev.filter(d => d.id !== id);
      saveDebtsToStorage(next);
      return next;
    });
  };

  const handleResetSampleDebts = () => {
    setDebts(DEFAULT_SAMPLE_DEBTS);
    saveDebtsToStorage(DEFAULT_SAMPLE_DEBTS);
    setExtraPayment(150);
  };

  const handleClearAllDebts = () => {
    setDebts([]);
    saveDebtsToStorage([]);
  };

  const exportScheduleCsv = () => {
    if (!simResult.schedule || simResult.schedule.length === 0) return;
    const headers = ['Month Index', 'Month Key', 'Total Payment', 'Principal Paid', 'Interest Paid', 'Remaining Balance', 'Milestones'];
    const rows = simResult.schedule.map(pt => [
      pt.monthIndex,
      pt.monthKey,
      pt.totalMonthlyPayment.toFixed(2),
      pt.totalPrincipalPaid.toFixed(2),
      pt.totalInterestPaid.toFixed(2),
      pt.totalRemainingBalance.toFixed(2),
      `"${pt.paidOffDebtsThisMonth.join(', ')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `debt_payoff_${strategy.toLowerCase()}_schedule.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepare chart dataset (sampled for performance if many months)
  const chartData = useMemo(() => {
    if (!simResult.schedule) return [];
    return simResult.schedule.map(pt => ({
      month: pt.monthLabel,
      balance: pt.totalRemainingBalance,
      interest: pt.totalInterestPaid,
      principal: pt.totalPrincipalPaid,
      cumulativeInterest: pt.cumulativeInterest,
      milestone: pt.paidOffDebtsThisMonth.length > 0 ? pt.paidOffDebtsThisMonth[0] : null,
    }));
  }, [simResult.schedule]);

  return (
    <div id="debt-payoff-tab-root" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER & INTRO */}
      <div className="bg-[#111622] p-5 sm:p-6 rounded-2xl border border-slate-800/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-xl">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
                <span>Debt Payoff Planner</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold font-mono">
                  {strategy === 'SNOWBALL' ? 'Snowball Method' : 'Avalanche Method'}
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Eliminate debt faster by strategically cascading payments using the Debt Snowball or Debt Avalanche accelerator.
              </p>
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Debt</span>
          </button>
          <button
            type="button"
            onClick={handleResetSampleDebts}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
            title="Load realistic sample debts"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Load Demo Debts</span>
          </button>
        </div>
      </div>

      {/* 2. STRATEGY SELECTOR & EXTRA PAYMENT ENGINE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Strategy Selector (7 cols) */}
        <div className="lg:col-span-7 bg-[#111622] p-5 rounded-2xl border border-slate-800/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Select Payoff Strategy</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              Total Active: {debts.filter(d => d.balance > 0).length} Debts
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Snowball Card */}
            <div
              onClick={() => setStrategy('SNOWBALL')}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                strategy === 'SNOWBALL'
                  ? 'bg-[#182238] border-cyan-500/80 shadow-md ring-1 ring-cyan-500/40'
                  : 'bg-[#131926] border-slate-800 hover:border-slate-700 opacity-80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Snowflake className={`w-4 h-4 ${strategy === 'SNOWBALL' ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <h4 className="text-xs sm:text-sm font-bold text-slate-100">Debt Snowball</h4>
                  </div>
                  {strategy === 'SNOWBALL' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                  Focuses on the <strong className="text-cyan-300">lowest balance first</strong> regardless of APR. Delivers rapid psychological wins that build unstoppable debt payoff momentum.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Best for: High motivation & quick wins</span>
              </div>
            </div>

            {/* Avalanche Card */}
            <div
              onClick={() => setStrategy('AVALANCHE')}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                strategy === 'AVALANCHE'
                  ? 'bg-[#291823] border-rose-500/80 shadow-md ring-1 ring-rose-500/40'
                  : 'bg-[#131926] border-slate-800 hover:border-slate-700 opacity-80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className={`w-4 h-4 ${strategy === 'AVALANCHE' ? 'text-rose-400' : 'text-slate-400'}`} />
                    <h4 className="text-xs sm:text-sm font-bold text-slate-100">Debt Avalanche</h4>
                  </div>
                  {strategy === 'AVALANCHE' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                  Focuses on the <strong className="text-rose-300">highest APR first</strong>. Mathematically optimal — minimizes total lifetime interest paid and accelerates payoff.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Best for: Maximum money & interest savings</span>
              </div>
            </div>
          </div>
        </div>

        {/* Extra Monthly Payment Accelerator (5 cols) */}
        <div className="lg:col-span-5 bg-[#111622] p-5 rounded-2xl border border-slate-800/90 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Monthly Payoff Budget</span>
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-400">
                Total: {formatCurrency(totalMinPaymentSum + extraPayment, displayCurrency)}/mo
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Minimum payments ({formatCurrency(totalMinPaymentSum, displayCurrency)}) + your extra accelerated snowball amount.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-[#151c2c] p-3 rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-300">Extra Monthly Payment:</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">+</span>
                <input
                  type="number"
                  min="0"
                  step="25"
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-24 bg-[#0e1420] border border-slate-700 rounded-lg px-2.5 py-1 text-sm font-mono font-bold text-emerald-300 text-right focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs font-mono text-slate-400">USD</span>
              </div>
            </div>

            {/* Quick Increment Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[0, 50, 100, 200, 350, 500].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setExtraPayment(amt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    extraPayment === amt
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-xs'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                  }`}
                >
                  {amt === 0 ? '$0' : `+$${amt}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. SIMULATION KPI OUTCOME CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Debt Free Date */}
        <div className="bg-[#111622] p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-sm space-y-1">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Debt-Free Date</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight pt-1">
            {simResult.debtFreeDateFormatted || 'Debt Free!'}
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            {simResult.totalMonths} months total payoff time
          </p>
        </div>

        {/* KPI 2: Total Starting Balance */}
        <div className="bg-[#111622] p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-sm space-y-1">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
            <span>Current Total Debt</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight pt-1 font-mono">
            {formatCurrency(totalBalanceSum, displayCurrency)}
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            Across {debts.filter(d => d.balance > 0).length} active liabilities
          </p>
        </div>

        {/* KPI 3: Total Interest Paid */}
        <div className="bg-[#111622] p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-sm space-y-1">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            <span>Lifetime Interest Cost</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-rose-400 tracking-tight pt-1 font-mono">
            {formatCurrency(simResult.totalInterestPaid, displayCurrency)}
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            Total Paid: {formatCurrency(simResult.totalAmountPaid, displayCurrency)}
          </p>
        </div>

        {/* KPI 4: Savings vs Minimum Only Baseline */}
        <div className="bg-[#111622] p-4 sm:p-5 rounded-2xl border border-amber-500/30 shadow-sm space-y-1 bg-gradient-to-br from-amber-500/5 to-transparent">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Accelerated Savings</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-amber-300 tracking-tight pt-1 font-mono">
            {formatCurrency(simResult.interestSavedVsBaseline, displayCurrency)}
          </h3>
          <p className="text-xs text-amber-200/80 font-mono">
            {simResult.monthsSavedVsBaseline > 0 ? `Debt-free ${simResult.monthsSavedVsBaseline} months sooner!` : 'Accelerating payoff'}
          </p>
        </div>
      </div>

      {/* 4. VISUAL TIMELINE & MONTHLY AMORTIZATION CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left (7 cols): Debt Balance Trajectory */}
        <div className="lg:col-span-7 bg-[#111622] p-5 rounded-2xl border border-slate-800/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Payoff Balance Trajectory</h3>
              <p className="text-xs text-slate-400">Total outstanding balance declining over time to zero.</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
              {simResult.totalMonths} months
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2433" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} 
                />
                <Tooltip
                  formatter={(val: any, name: string) => [
                    formatCurrency(Number(val) || 0, displayCurrency),
                    name === 'balance' ? 'Remaining Balance' : 'Cumulative Interest'
                  ]}
                  contentStyle={{
                    backgroundColor: '#161d2b',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#f8fafc'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="balance" 
                  name="balance"
                  stroke="#f43f5e" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#debtGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right (5 cols): Monthly Payment Breakdown (Principal vs Interest) */}
        <div className="lg:col-span-5 bg-[#111622] p-5 rounded-2xl border border-slate-800/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Payment Composition</h3>
              <p className="text-xs text-slate-400">Principal reduction vs interest share over time.</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.slice(0, 24)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2433" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={9} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                <Tooltip
                  formatter={(val: any, name: string) => [
                    formatCurrency(Number(val) || 0, displayCurrency),
                    name === 'principal' ? 'Principal' : 'Interest'
                  ]}
                  contentStyle={{
                    backgroundColor: '#161d2b',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#f8fafc'
                  }}
                />
                <Legend formatter={(value) => (value === 'principal' ? 'Principal Paid' : 'Interest Paid')} />
                <Bar dataKey="principal" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="interest" fill="#fb7185" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. DEBT ITEMS MANAGEMENT TABLE */}
      <div className="bg-[#111622] p-5 rounded-2xl border border-slate-800/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-slate-400" />
              <span>Your Debts & Liabilities ({debts.length})</span>
            </h3>
            <p className="text-xs text-slate-400">
              Ranked in execution order based on the <strong className="text-slate-200">{strategy === 'SNOWBALL' ? 'Snowball (Lowest Balance)' : 'Avalanche (Highest APR)'}</strong> algorithm.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Debt</span>
            </button>
            {debts.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllDebts}
                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-medium transition-colors cursor-pointer"
                title="Clear all debts"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {debts.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <h4 className="text-sm font-bold text-slate-200">No debts recorded!</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You currently have zero debts listed. You can add individual credit cards, personal loans, or load the demo set.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all cursor-pointer"
              >
                Add Your First Debt
              </button>
              <button
                type="button"
                onClick={handleResetSampleDebts}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs border border-slate-700 transition-colors cursor-pointer"
              >
                Load Demo Debts
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase">
                  <th className="pb-2.5 font-medium">Priority & Name</th>
                  <th className="pb-2.5 font-medium text-right">Balance</th>
                  <th className="pb-2.5 font-medium text-right">APR %</th>
                  <th className="pb-2.5 font-medium text-right">Min Payment</th>
                  <th className="pb-2.5 font-medium text-center">Projected Payoff</th>
                  <th className="pb-2.5 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {simResult.milestones.map((milestone, idx) => {
                  const debt = debts.find(d => d.id === milestone.debtId);
                  if (!debt) return null;

                  return (
                    <tr key={debt.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3 font-sans">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                            idx === 0 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            #{idx + 1} {idx === 0 ? 'Target' : ''}
                          </span>
                          <div>
                            <p className="font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">
                              {debt.name}
                            </p>
                            <span className="text-[10px] text-slate-400 font-sans">
                              {debt.category || 'Credit Card'} • Due day {debt.dueDay || 15}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right font-bold text-slate-100">
                        {formatCurrency(debt.balance, displayCurrency)}
                      </td>
                      <td className="py-3 text-right font-bold text-rose-400">
                        {debt.interestRate.toFixed(2)}%
                      </td>
                      <td className="py-3 text-right text-slate-300">
                        {formatCurrency(debt.minPayment, displayCurrency)}/mo
                      </td>
                      <td className="py-3 text-center">
                        <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                          {milestone.payoffDateFormatted}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-1 font-sans">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(debt)}
                            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Edit Debt"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDebt(debt.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Delete Debt"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. PAYOFF MILESTONES ROADMAP */}
      {simResult.milestones.length > 0 && (
        <div className="bg-[#111622] p-5 rounded-2xl border border-slate-800/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Debt Payoff Milestones Journey</span>
            </h3>
            <span className="text-[10px] text-slate-400">
              Roll full payments into the next target upon each payoff
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {simResult.milestones.map((m, idx) => (
              <div 
                key={m.debtId} 
                className="bg-[#151c2c] p-3.5 rounded-xl border border-slate-800 space-y-2 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Milestone #{idx + 1}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-100 truncate">{m.debtName}</h4>
                <div className="text-[11px] font-mono text-emerald-400 font-bold">
                  Paid off: {m.payoffDateFormatted}
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  Interest: {formatCurrency(m.totalInterestPaid, displayCurrency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. EXPANDABLE MONTH-BY-MONTH AMORTIZATION SCHEDULE */}
      <div className="bg-[#111622] rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-800/80">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Detailed Amortization Schedule</h3>
            <p className="text-xs text-slate-400">Month-by-month principal, interest, and remaining balances.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportScheduleCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAmortization(prev => !prev)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>{showAmortization ? 'Hide' : 'Show Schedule'}</span>
              {showAmortization ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {showAmortization && (
          <div className="p-4 sm:p-5 overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 font-medium text-right">Payment</th>
                  <th className="pb-2 font-medium text-right">Principal</th>
                  <th className="pb-2 font-medium text-right">Interest</th>
                  <th className="pb-2 font-medium text-right">Remaining Balance</th>
                  <th className="pb-2 font-medium text-center">Milestones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {simResult.schedule.map((pt) => (
                  <tr key={pt.monthIndex} className="hover:bg-slate-800/30">
                    <td className="py-2 text-slate-300">{pt.monthLabel} (#{pt.monthIndex})</td>
                    <td className="py-2 text-right text-slate-200">{formatCurrency(pt.totalMonthlyPayment, displayCurrency)}</td>
                    <td className="py-2 text-right text-emerald-400">{formatCurrency(pt.totalPrincipalPaid, displayCurrency)}</td>
                    <td className="py-2 text-right text-rose-400">{formatCurrency(pt.totalInterestPaid, displayCurrency)}</td>
                    <td className="py-2 text-right font-bold text-slate-100">{formatCurrency(pt.totalRemainingBalance, displayCurrency)}</td>
                    <td className="py-2 text-center">
                      {pt.paidOffDebtsThisMonth.length > 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold font-sans">
                          🎉 Paid: {pt.paidOffDebtsThisMonth.join(', ')}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD / EDIT DEBT MODAL */}
      {isAddingDebt && (
        <div 
          id="debt-form-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
        >
          <div className="bg-[#111622] border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl my-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>{editingDebt ? 'Edit Debt' : 'Add New Debt'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingDebt(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDebt} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Debt / Card Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chase Sapphire / Santander Auto Loan"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#161d2b] border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Current Balance ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="2500.00"
                    value={formBalance}
                    onChange={(e) => setFormBalance(e.target.value)}
                    className="w-full bg-[#161d2b] border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Interest Rate (APR %)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    placeholder="18.5"
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    className="w-full bg-[#161d2b] border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Minimum Payment ($/mo)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="75.00"
                    value={formMinPayment}
                    onChange={(e) => setFormMinPayment(e.target.value)}
                    className="w-full bg-[#161d2b] border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full bg-[#161d2b] border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="PERSONAL_LOAN">Personal Loan</option>
                    <option value="AUTO_LOAN">Auto Loan</option>
                    <option value="MORTGAGE">Mortgage</option>
                    <option value="STUDENT_LOAN">Student Loan</option>
                    <option value="MEDICAL">Medical</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingDebt(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md cursor-pointer"
                >
                  {editingDebt ? 'Update Debt' : 'Save Debt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default DebtPayoffTab;
