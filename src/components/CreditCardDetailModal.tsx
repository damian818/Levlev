import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, DisplayCurrency, TransactionFilter, CreditCardClosingRule, ClosingRuleType } from '../types';
import { getCreditCardStatements, getCurrentStatementIndex, getNextCloseDate, formatCurrency, getStatementCloseDateForTx, getStatementCloseDateForPayment, getClosingRuleLabel, getCloseDateForMonthAndYear } from '../utils/financeUtils';
import { X, CreditCard, Calendar, ArrowRightLeft, Plus, CheckCircle, AlertCircle, FileText, ChevronRight, Settings, Edit3 } from 'lucide-react';

interface CreditCardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountName: string;
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  closingRule?: CreditCardClosingRule;
  periodStatusOverrides?: Record<string, 'PAID' | 'OPEN'>;
  onUpdatePeriodStatus?: (accountName: string, closeDate: string, status?: 'PAID' | 'OPEN') => void;
  onUpdateClosingRule?: (rule: CreditCardClosingRule) => void;
  onAddTransaction: (tx: Transaction) => void;
  onNavigateToTransactionsWithFilter: (filter: TransactionFilter) => void;
  onReassignTransactionPeriod?: (txId: string, statementCloseDate: string | undefined) => void;
}

export function CreditCardDetailModal({
  isOpen,
  onClose,
  accountName,
  transactions,
  displayCurrency,
  usdArsRate,
  closingRule,
  periodStatusOverrides,
  onUpdatePeriodStatus,
  onUpdateClosingRule,
  onAddTransaction,
  onNavigateToTransactionsWithFilter,
  onReassignTransactionPeriod,
}: CreditCardDetailModalProps) {
  const [selectedStatementIdx, setSelectedStatementIdx] = useState<number>(0);
  const [showPaymentForm, setShowPaymentForm] = useState<boolean>(false);
  const [isEditingRule, setIsEditingRule] = useState<boolean>(false);

  const currentRule: CreditCardClosingRule = closingRule || { ruleType: 'FIXED_DAY', fixedDay: 25 };
  const [tempRule, setTempRule] = useState<CreditCardClosingRule>(currentRule);

  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    if (currentRule.ruleType === 'PREVIOUS_TO_LAST_WEEKDAY' && currentRule.weekday === 4) return 'PREVIOUS_THU';
    if (currentRule.ruleType === 'LAST_WEEKDAY' && currentRule.weekday === 5) return 'LAST_FRI';
    if (currentRule.ruleType === 'NTH_WEEKDAY' && currentRule.weekday === 4 && currentRule.nth === 3) return '3RD_THU';
    if (currentRule.ruleType === 'PREVIOUS_TO_LAST_WEEKDAY' && currentRule.weekday === 5) return 'PREVIOUS_FRI';
    if (currentRule.ruleType === 'FIXED_DAY' && currentRule.fixedDay === 25) return 'FIXED_25';
    if (currentRule.ruleType === 'FIXED_DAY' && currentRule.fixedDay === 20) return 'FIXED_20';
    return 'CUSTOM';
  });

  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey);
    if (presetKey === 'PREVIOUS_THU') {
      setTempRule({ ruleType: 'PREVIOUS_TO_LAST_WEEKDAY', weekday: 4, dueDaysAfterClose: 10 });
    } else if (presetKey === 'LAST_FRI') {
      setTempRule({ ruleType: 'LAST_WEEKDAY', weekday: 5, dueDaysAfterClose: 10 });
    } else if (presetKey === '3RD_THU') {
      setTempRule({ ruleType: 'NTH_WEEKDAY', weekday: 4, nth: 3, dueDaysAfterClose: 10 });
    } else if (presetKey === 'PREVIOUS_FRI') {
      setTempRule({ ruleType: 'PREVIOUS_TO_LAST_WEEKDAY', weekday: 5, dueDaysAfterClose: 10 });
    } else if (presetKey === 'FIXED_25') {
      setTempRule({ ruleType: 'FIXED_DAY', fixedDay: 25, dueDaysAfterClose: 10 });
    } else if (presetKey === 'FIXED_20') {
      setTempRule({ ruleType: 'FIXED_DAY', fixedDay: 20, dueDaysAfterClose: 10 });
    }
  };

  const handleSaveRuleSubmit = () => {
    if (onUpdateClosingRule) {
      onUpdateClosingRule(tempRule);
    }
    setIsEditingRule(false);
  };

  const upcomingCloseDatesPreview = useMemo(() => {
    const result: { monthLabel: string; closeDateStr: string }[] = [];
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let offset = 0; offset < 4; offset++) {
      let y = now.getFullYear();
      let m = now.getMonth() + offset;
      if (m > 11) {
        y += Math.floor(m / 12);
        m = m % 12;
      }
      const d = getCloseDateForMonthAndYear(y, m, tempRule);
      const pad = (n: number) => String(n).padStart(2, '0');
      result.push({
        monthLabel: `${months[m]} ${y}`,
        closeDateStr: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      });
    }
    return result;
  }, [tempRule]);

  // Payment form state
  const [paidFromAccount, setPaidFromAccount] = useState('BBVA');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().substring(0, 10));
  const [paymentNote, setPaymentNote] = useState('');

  const statements = useMemo(() => {
    return getCreditCardStatements(transactions, accountName, currentRule, periodStatusOverrides);
  }, [transactions, accountName, currentRule, periodStatusOverrides]);

  const currentCloseDate = useMemo(() => {
    return getNextCloseDate(currentRule);
  }, [currentRule]);

  const currentIdx = useMemo(() => {
    return getCurrentStatementIndex(statements, currentRule);
  }, [statements, currentRule]);

  useEffect(() => {
    if (isOpen) {
      setSelectedStatementIdx(currentIdx);
    }
  }, [isOpen, accountName, currentIdx]);

  const activeStatement = statements[selectedStatementIdx] || statements[currentIdx] || statements[0];

  const availablePeriods = useMemo(() => {
    const datesSet = new Set<string>();
    statements.forEach(s => datesSet.add(s.closeDate));

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    for (let offset = -12; offset <= 12; offset++) {
      let y = now.getFullYear();
      let m = now.getMonth() + offset;
      while (m < 0) {
        y -= 1;
        m += 12;
      }
      while (m > 11) {
        y += 1;
        m -= 12;
      }
      const dt = getCloseDateForMonthAndYear(y, m, currentRule);
      const closeStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
      datesSet.add(closeStr);
    }

    return Array.from(datesSet).sort();
  }, [statements, currentRule]);

  if (!isOpen || !accountName) return null;

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) return;

    const paymentTx: Transaction = {
      id: `cc-pay-${Date.now()}`,
      date: new Date(paymentDate).toISOString(),
      title: paymentNote || `Pago Resumen ${accountName}`,
      category: 'Tarjetas de Crédito',
      account: paidFromAccount,
      toAccount: accountName,
      amount: amt,
      transferAmount: amt,
      receiveAmount: amt,
      currency: activeStatement?.currency || 'ARS',
      transferCurrency: activeStatement?.currency || 'ARS',
      receiveCurrency: activeStatement?.currency || 'ARS',
      type: 'CC_PAYMENT',
      statementCloseDate: activeStatement?.closeDate,
      description: `Payment for statement closing ${activeStatement?.closeDate || ''}`,
    };

    onAddTransaction(paymentTx);
    setShowPaymentForm(false);
    setPaymentAmount('');
    setPaymentNote('');
  };

  const handlePreFillPayment = () => {
    if (activeStatement) {
      const due = Math.max(0, activeStatement.netDue);
      setPaymentAmount(due > 0 ? due.toString() : '');
      setPaymentNote(`Pago Resumen ${activeStatement.closeDate}`);
      setShowPaymentForm(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#161b22] rounded-2xl max-w-3xl w-full border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#121620] border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-100">{accountName}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                  Credit Card Account
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Itemized expenses and statement payment details
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 bg-[#161b22] hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Closing Date Rule Bar */}
        <div className="px-4 py-2 bg-[#121620] border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400 font-medium">Closing Date Rule:</span>
            <span className="font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded text-[11px]">
              {getClosingRuleLabel(currentRule)}
            </span>
          </div>
          <button
            onClick={() => {
              setTempRule(currentRule);
              setIsEditingRule(!isEditingRule);
            }}
            className="text-purple-400 hover:text-purple-300 font-semibold underline text-[11px] flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            {isEditingRule ? 'Close Rule Editor' : 'Configure Rule'}
          </button>
        </div>

        {/* Rule Editor Drawer Panel */}
        {isEditingRule && (
          <div className="p-4 bg-[#0f131a] border-b border-purple-500/30 space-y-3 text-xs animate-in fade-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>Configure Statement Closing Date Schedule</span>
              </h4>
              <span className="text-[10px] text-slate-400">Rules assign charges to statement cycles</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Preset Schedule</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[#161b22] border border-slate-700 text-slate-100 font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="PREVIOUS_THU">Previous to last Thursday of the month (e.g. 2nd-to-last Thursday)</option>
                  <option value="LAST_FRI">Last Friday of the month</option>
                  <option value="3RD_THU">3rd Thursday of the month</option>
                  <option value="PREVIOUS_FRI">Previous to last Friday of the month</option>
                  <option value="FIXED_25">Fixed Day: 25th of each month</option>
                  <option value="FIXED_20">Fixed Day: 20th of each month</option>
                  <option value="CUSTOM">Custom Rule...</option>
                </select>
              </div>

              {selectedPreset === 'CUSTOM' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-[#161b22] rounded-lg border border-slate-800">
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Schedule Pattern</label>
                    <select
                      value={tempRule.ruleType}
                      onChange={(e) => setTempRule({ ...tempRule, ruleType: e.target.value as ClosingRuleType })}
                      className="w-full px-2.5 py-1.5 bg-[#0f131a] border border-slate-700 text-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="PREVIOUS_TO_LAST_WEEKDAY">Previous to last [Day of week]</option>
                      <option value="LAST_WEEKDAY">Last [Day of week] of month</option>
                      <option value="NTH_WEEKDAY">N-th [Day of week] of month</option>
                      <option value="FIXED_DAY">Fixed Day of month</option>
                    </select>
                  </div>

                  {tempRule.ruleType === 'FIXED_DAY' ? (
                    <div>
                      <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Day of Month (1-31)</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={tempRule.fixedDay ?? 25}
                        onChange={(e) => setTempRule({ ...tempRule, fixedDay: parseInt(e.target.value) || 25 })}
                        className="w-full px-2.5 py-1.5 bg-[#0f131a] border border-slate-700 text-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 font-bold"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Day of Week</label>
                        <select
                          value={tempRule.weekday ?? 4}
                          onChange={(e) => setTempRule({ ...tempRule, weekday: parseInt(e.target.value) })}
                          className="w-full px-2.5 py-1.5 bg-[#0f131a] border border-slate-700 text-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          <option value={1}>Monday</option>
                          <option value={2}>Tuesday</option>
                          <option value={3}>Wednesday</option>
                          <option value={4}>Thursday</option>
                          <option value={5}>Friday</option>
                          <option value={6}>Saturday</option>
                          <option value={0}>Sunday</option>
                        </select>
                      </div>

                      {tempRule.ruleType === 'NTH_WEEKDAY' && (
                        <div>
                          <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Occurrence</label>
                          <select
                            value={tempRule.nth ?? 3}
                            onChange={(e) => setTempRule({ ...tempRule, nth: parseInt(e.target.value) })}
                            className="w-full px-2.5 py-1.5 bg-[#0f131a] border border-slate-700 text-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                          >
                            <option value={1}>1st occurrence</option>
                            <option value={2}>2nd occurrence</option>
                            <option value={3}>3rd occurrence</option>
                            <option value={4}>4th occurrence</option>
                          </select>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Preview */}
              <div className="p-3 bg-[#161b22] rounded-lg border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Calculated Upcoming Closing Dates:</span>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {upcomingCloseDatesPreview.map((item, i) => (
                    <span key={i} className="px-2.5 py-1 bg-[#0f131a] border border-slate-700 text-purple-300 rounded font-mono">
                      {item.monthLabel}: <strong className="text-white">{item.closeDateStr}</strong>
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingRule(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRuleSubmit}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                >
                  Apply & Save Rule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Statement Selector Bar */}
        <div className="p-4 bg-[#0f131a] border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-300">Statement Period:</span>
            <select
              value={selectedStatementIdx}
              onChange={(e) => setSelectedStatementIdx(Number(e.target.value))}
              className="px-3 py-1.5 bg-[#161b22] border border-slate-700 text-slate-100 font-semibold rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 flex-1 sm:flex-none"
            >
              {statements.map((stmt, idx) => {
                const isPast = stmt.closeDate < currentCloseDate;
                const isFuture = stmt.closeDate > currentCloseDate;
                let tag = 'Current';
                if (stmt.isManualOverride) {
                  tag = stmt.isPaid ? 'Paid (Manual)' : 'Open (Manual)';
                } else if (isPast) {
                  tag = stmt.isPaid ? 'Paid' : 'Open';
                } else if (isFuture) {
                  tag = stmt.isPaid ? 'Paid' : 'Future';
                } else {
                  tag = stmt.netDue <= 0 ? 'Current (Paid)' : 'Current (Open)';
                }
                return (
                  <option key={stmt.closeDate} value={idx}>
                    Closing {stmt.closeDate} — {formatCurrency(stmt.totalExpenses, stmt.currency as DisplayCurrency)} [{tag}]
                  </option>
                );
              })}
            </select>

            {activeStatement && onUpdatePeriodStatus && (
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-slate-600 hidden sm:inline">|</span>
                <button
                  type="button"
                  onClick={() => onUpdatePeriodStatus(accountName, activeStatement.closeDate, activeStatement.isPaid ? 'OPEN' : 'PAID')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all ${
                    activeStatement.isPaid
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  }`}
                  title={activeStatement.isPaid ? 'Mark period as Open / Unpaid' : 'Mark period as Paid'}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{activeStatement.isPaid ? 'Mark as Open' : 'Mark as Paid'}</span>
                </button>
                {activeStatement.isManualOverride && (
                  <button
                    type="button"
                    onClick={() => onUpdatePeriodStatus(accountName, activeStatement.closeDate, undefined)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] rounded-lg border border-slate-700"
                    title="Reset to automatic calculation"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handlePreFillPayment}
            className="w-full sm:w-auto px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Record Statement Payment</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Cycle Metrics Header */}
          {activeStatement && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-[#121620] border border-slate-800 space-y-1">
                <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">Statement Expenses</span>
                <div className="text-xl font-bold text-slate-100">
                  {formatCurrency(activeStatement.totalExpenses, activeStatement.currency as DisplayCurrency)}
                </div>
                <div className="text-[10px] text-slate-500">
                  {activeStatement.expenses.length} itemized charges
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#121620] border border-slate-800 space-y-1">
                <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">Payments Applied</span>
                <div className="text-xl font-bold text-emerald-400">
                  {formatCurrency(activeStatement.totalPayments, activeStatement.currency as DisplayCurrency)}
                </div>
                <div className="text-[10px] text-slate-500">
                  {activeStatement.payments.length} payment transfers
                </div>
              </div>

              <div className={`p-4 rounded-xl border space-y-2 ${
                activeStatement.netDue <= 0 
                  ? 'bg-emerald-950/20 border-emerald-800/40' 
                  : 'bg-amber-950/20 border-amber-800/40'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Net Outstanding Due</span>
                  <div className="flex items-center gap-1.5">
                    {activeStatement.netDue <= 0 ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        <CheckCircle className="w-3 h-3" /> Paid {activeStatement.isManualOverride ? '(Manual)' : ''}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        <AlertCircle className="w-3 h-3" /> Outstanding {activeStatement.isManualOverride ? '(Manual)' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-end gap-2 pt-0.5">
                  <div>
                    <div className={`text-xl font-bold ${activeStatement.netDue <= 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                      {formatCurrency(activeStatement.netDue, activeStatement.currency as DisplayCurrency)}
                    </div>
                    {activeStatement.dueDate && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Est. Due Date: {activeStatement.dueDate}
                      </div>
                    )}
                  </div>

                  {onUpdatePeriodStatus && (
                    <div className="flex items-center gap-1.5">
                      {activeStatement.isPaid ? (
                        <button
                          type="button"
                          onClick={() => onUpdatePeriodStatus(accountName, activeStatement.closeDate, 'OPEN')}
                          className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Manually set period status to Open / Unpaid"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Mark as Open</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUpdatePeriodStatus(accountName, activeStatement.closeDate, 'PAID')}
                          className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Manually set period status to Paid"
                        >
                          <CheckCircle className="w-3 h-3" />
                          <span>Mark as Paid</span>
                        </button>
                      )}

                      {activeStatement.isManualOverride && (
                        <button
                          type="button"
                          onClick={() => onUpdatePeriodStatus(accountName, activeStatement.closeDate, undefined)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg text-[10px] transition-colors"
                          title="Reset status to calculated"
                        >
                          Reset Auto
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Payment Drawer Form */}
          {showPaymentForm && activeStatement && (
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl space-y-3 animate-in fade-in duration-200">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-purple-400" />
                  Record Payment for Statement ({activeStatement.closeDate})
                </h4>
                <button
                  onClick={() => setShowPaymentForm(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleRecordPaymentSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#0f131a] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Paid From (Bank Account)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BBVA"
                    value={paidFromAccount}
                    onChange={(e) => setPaidFromAccount(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#0f131a] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Amount Paid ({activeStatement.currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#0f131a] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 font-bold"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors shadow-sm"
                  >
                    Confirm Payment
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Itemized Statement Expenses */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-400" />
                Itemized Credit Card Charges ({activeStatement?.expenses.length || 0})
              </h3>
              <button
                onClick={() => onNavigateToTransactionsWithFilter({ account: accountName })}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
              >
                <span>View in Transactions Tab</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeStatement?.expenses.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-[#121620] rounded-xl border border-slate-800 text-xs">
                No expense transactions recorded for this statement period.
              </div>
            ) : (
              <div className="bg-[#121620] rounded-xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0f131a] text-slate-400 border-b border-slate-800 font-medium text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Merchant / Title</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-center">Cuota / Installments</th>
                        <th className="py-2.5 px-3">Statement Period</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {activeStatement?.expenses.map((tx) => {
                        const autoClose = getStatementCloseDateForTx(tx.date, currentRule);
                        const isReassigned = tx.statementCloseDate && tx.statementCloseDate !== autoClose;
                        return (
                          <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                              {tx.date ? tx.date.substring(0, 10) : ''}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-100">
                              {tx.title}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px]">
                                {tx.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {tx.installments ? (
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                                  {tx.installments}
                                </span>
                              ) : (
                                <span className="text-slate-600 text-[10px]">1/1</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {onReassignTransactionPeriod ? (
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={tx.statementCloseDate || 'AUTO'}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      onReassignTransactionPeriod(tx.id, val === 'AUTO' ? undefined : val);
                                    }}
                                    className={`px-2 py-1 bg-[#0f131a] border rounded text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                                      isReassigned
                                        ? 'border-purple-500/80 text-purple-300 font-bold bg-purple-500/10'
                                        : 'border-slate-700 text-slate-300'
                                    }`}
                                  >
                                    <option value="AUTO">
                                      Auto ({autoClose})
                                    </option>
                                    {availablePeriods.map((cDate) => {
                                      const isAutoOption = cDate === autoClose;
                                      return (
                                        <option key={cDate} value={cDate}>
                                          Closing {cDate} {isAutoOption ? '(Auto Default)' : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  {isReassigned && (
                                    <span 
                                      title="Expense reassigned to a custom statement period" 
                                      className="px-1.5 py-0.5 text-[9px] bg-purple-500/20 text-purple-300 rounded border border-purple-500/30 font-semibold"
                                    >
                                      Reassigned
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 font-mono text-[11px]">
                                  {tx.statementCloseDate || autoClose}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-400">
                              {formatCurrency(tx.amount, tx.currency as DisplayCurrency)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Statement Payments History */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
              Recorded Payments & Credits ({activeStatement?.payments.length || 0})
            </h3>

            {activeStatement?.payments.length === 0 ? (
              <div className="p-4 text-center text-slate-500 bg-[#121620] rounded-xl border border-slate-800 text-xs">
                No payments registered for this statement yet. Click "Record Statement Payment" above to record one.
              </div>
            ) : (
              <div className="bg-[#121620] rounded-xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0f131a] text-slate-400 border-b border-slate-800 font-medium text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Reference</th>
                        <th className="py-2.5 px-3">Paid From</th>
                        <th className="py-2.5 px-3">Statement Period</th>
                        <th className="py-2.5 px-3 text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {activeStatement?.payments.map((tx) => {
                        const autoClose = getStatementCloseDateForPayment(tx.date, currentRule);
                        const isReassigned = tx.statementCloseDate && tx.statementCloseDate !== autoClose;
                        return (
                          <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                              {tx.date ? tx.date.substring(0, 10) : ''}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-100">
                              {tx.title}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                                {tx.account}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {onReassignTransactionPeriod ? (
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={tx.statementCloseDate || 'AUTO'}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      onReassignTransactionPeriod(tx.id, val === 'AUTO' ? undefined : val);
                                    }}
                                    className={`px-2 py-1 bg-[#0f131a] border rounded text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                                      isReassigned
                                        ? 'border-purple-500/80 text-purple-300 font-bold bg-purple-500/10'
                                        : 'border-slate-700 text-slate-300'
                                    }`}
                                  >
                                    <option value="AUTO">
                                      Auto ({autoClose})
                                    </option>
                                    {availablePeriods.map((cDate) => {
                                      const isAutoOption = cDate === autoClose;
                                      return (
                                        <option key={cDate} value={cDate}>
                                          Closing {cDate} {isAutoOption ? '(Auto Default)' : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  {isReassigned && (
                                    <span 
                                      title="Payment reassigned to a custom statement period" 
                                      className="px-1.5 py-0.5 text-[9px] bg-purple-500/20 text-purple-300 rounded border border-purple-500/30 font-semibold"
                                    >
                                      Reassigned
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 font-mono text-[11px]">
                                  {tx.statementCloseDate || autoClose}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                              {formatCurrency(tx.receiveAmount || tx.transferAmount || tx.amount, tx.currency as DisplayCurrency)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#121620] border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
