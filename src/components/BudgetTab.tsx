import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, BudgetGoal, DisplayCurrency } from '../types';
import { analyzeSpending, formatCurrency, convertCurrency, deriveBudgetsFromTransactions, getLatestMonth, getCurrentMonthKey, getDefaultSelectedMonth } from '../utils/financeUtils';
import { Target, AlertTriangle, CheckCircle, Plus, Calendar, RefreshCw, Sparkles } from 'lucide-react';

interface BudgetTabProps {
  transactions: Transaction[];
  budgets: BudgetGoal[];
  onUpdateBudgets: (newBudgets: BudgetGoal[]) => void;
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
}

export function BudgetTab({ transactions, budgets, onUpdateBudgets, displayCurrency, usdArsRate }: BudgetTabProps) {
  const [budgetList, setBudgetList] = useState<BudgetGoal[]>(budgets);
  const [isEditing, setIsEditing] = useState(false);

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  // Available months from transactions
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.date) monthSet.add(tx.date.substring(0, 7));
    });
    monthSet.add(currentMonthKey);
    return Array.from(monthSet).sort().reverse();
  }, [transactions, currentMonthKey]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => getDefaultSelectedMonth(transactions));

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth) && selectedMonth !== 'ALL') {
      setSelectedMonth(getDefaultSelectedMonth(transactions));
    }
  }, [availableMonths]);

  // Sync budgetList when budgets prop changes or if empty
  useEffect(() => {
    if (budgets && budgets.length > 0) {
      setBudgetList(budgets);
    } else if (transactions.length > 0) {
      const derived = deriveBudgetsFromTransactions(transactions, []);
      setBudgetList(derived);
      onUpdateBudgets(derived);
    }
  }, [budgets, transactions]);

  const spending = analyzeSpending(transactions, displayCurrency, usdArsRate, selectedMonth);

  const handleLimitChange = (category: string, newLimit: number) => {
    setBudgetList(prev => prev.map(b => b.category === category ? { ...b, monthlyLimitARS: newLimit } : b));
  };

  const handleSave = () => {
    onUpdateBudgets(budgetList);
    setIsEditing(false);
  };

  const handleAutoGenerate = () => {
    const derived = deriveBudgetsFromTransactions(transactions, []);
    setBudgetList(derived);
    onUpdateBudgets(derived);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-[#161b22] p-4 sm:p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            <span>Monthly Budget Goals</span>
          </h3>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Control spending limits across categories.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          {/* Month Selector */}
          <div className="flex items-center space-x-2 bg-[#121620] px-3 py-1.5 rounded-lg border border-slate-800 text-xs flex-1 sm:flex-none justify-center sm:justify-start">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none py-0 text-xs text-slate-200 font-semibold focus:outline-none"
            >
              <option value="ALL">All Time</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 sm:flex-none">
            {isEditing ? (
              <div className="flex space-x-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 sm:flex-none px-3 py-1.5 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 bg-[#121620] hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600 border border-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-500"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 sm:flex-none px-3 py-1.5 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 bg-[#121620] hover:bg-slate-800"
                >
                  Configure
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {budgetList.length === 0 ? (
        <div className="bg-[#161b22] p-8 rounded-xl border border-slate-800 text-center space-y-4">
          <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-base font-bold text-slate-100">No Budget Goals Set Yet</h4>
            <p className="text-xs text-slate-400">
              Generate automatic category budget limits based on your uploaded CSV transaction categories.
            </p>
          </div>
          <button
            onClick={handleAutoGenerate}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Budget Goals for CSV Categories</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgetList.map((budget, idx) => {
            const categorySpent = spending.topCategories.find(c => c.category === budget.category)?.amount || 0;
            const limitConverted = convertCurrency(budget.monthlyLimitARS, 'ARS', displayCurrency, usdArsRate);
            const percentage = limitConverted > 0 ? (categorySpent / limitConverted) * 100 : 0;
            const isOver = percentage > 100;

            return (
              <div key={idx} className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-lg border ${isOver ? 'bg-rose-950/80 border-rose-800/50 text-rose-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      {isOver ? <AlertTriangle className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                    </div>
                    <h4 className="text-sm font-bold text-slate-100">{budget.category}</h4>
                  </div>
                  {isOver ? (
                    <span className="px-2 py-0.5 bg-rose-950/80 border border-rose-800/50 text-rose-300 text-[10px] font-bold rounded">Over Budget</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-800/50 text-emerald-300 text-[10px] font-bold rounded">On Track</span>
                  )}
                </div>

                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-400">Spent ({selectedMonth === 'ALL' ? 'All-time' : selectedMonth}): <strong className="text-slate-100">{formatCurrency(categorySpent, displayCurrency)}</strong></span>
                  {isEditing ? (
                    <div className="flex items-center space-x-1">
                      <span className="text-slate-400">Limit (ARS):</span>
                      <input
                        type="number"
                        value={budget.monthlyLimitARS}
                        onChange={(e) => handleLimitChange(budget.category, parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 bg-[#0f131a] border border-slate-700 text-slate-200 rounded text-xs text-right font-semibold focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                  ) : (
                    <span className="text-slate-400">Limit: <strong className="text-slate-100">{formatCurrency(limitConverted, displayCurrency)}</strong></span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isOver ? 'bg-rose-500' : percentage > 85 ? 'bg-amber-500' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>{percentage.toFixed(1)}% used</span>
                  <span>Remaining: {formatCurrency(Math.max(limitConverted - categorySpent, 0), displayCurrency)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
