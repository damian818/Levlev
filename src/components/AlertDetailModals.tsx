import React from 'react';
import { useTranslation } from 'react-i18next';
import { CategoryAnomaly, RecurringDeviationAlert, formatCurrency } from '../utils/financeUtils';
import { DisplayCurrency, ViewTab } from '../types';
import { 
  ShieldAlert, 
  Repeat, 
  X, 
  ArrowRight, 
  TrendingUp, 
  AlertTriangle,
  Search,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface AnomalyModalProps {
  isOpen: boolean;
  onClose: () => void;
  anomalies: CategoryAnomaly[];
  selectedMonth: string;
  displayCurrency: DisplayCurrency;
  onNavigateToTransactions: (filters: { category?: string; month?: string; search?: string }) => void;
}

export function AnomalyAlertModal({
  isOpen,
  onClose,
  anomalies,
  selectedMonth,
  displayCurrency,
  onNavigateToTransactions,
}: AnomalyModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleViewCategory = (category: string) => {
    onClose();
    onNavigateToTransactions({
      category,
      month: selectedMonth !== 'ALL' ? selectedMonth : undefined,
    });
  };

  const handleViewAll = () => {
    onClose();
    onNavigateToTransactions({
      month: selectedMonth !== 'ALL' ? selectedMonth : undefined,
    });
  };

  return (
    <div 
      id="anomaly-alert-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="anomaly-alert-modal-dialog"
        className="bg-[#111622] border border-amber-500/30 rounded-2xl max-w-xl w-full p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl my-auto max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>{t('overview.anomalies_detected') || 'Financial Anomalies Detected'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                  {anomalies.length}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Spending spikes exceeding 50% above your 3-month rolling baseline for <span className="font-mono text-slate-300">{selectedMonth}</span>.
              </p>
            </div>
          </div>
          <button
            id="close-anomaly-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Anomalies List */}
        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {anomalies.map((item, idx) => {
            const difference = item.currentAmount - item.averageAmount;
            return (
              <div
                key={idx}
                className="bg-[#151c2c] border border-slate-800 hover:border-amber-500/40 rounded-xl p-3.5 sm:p-4 space-y-3 transition-all group"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                      {item.category}
                    </h4>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                    +{item.percentageIncrease.toFixed(0)}% jump
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#0f1420] p-2.5 rounded-lg border border-slate-800/80 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{selectedMonth} Spent</span>
                    <span className="font-bold text-rose-400">{formatCurrency(item.currentAmount, displayCurrency)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">3-Mo Average</span>
                    <span className="text-slate-300">{formatCurrency(item.averageAmount, displayCurrency)}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 block">Difference</span>
                    <span className="font-bold text-amber-300">+{formatCurrency(difference, displayCurrency)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Spending in <strong className="text-slate-200">{item.category}</strong> is {item.percentageIncrease.toFixed(0)}% higher than typical. Review recent transactions to confirm whether this is a one-off expense or budget creep.
                </p>

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleViewCategory(item.category)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <span>View {item.category} Transactions</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors cursor-pointer"
          >
            {t('common.close') || 'Close'}
          </button>
          
          <button
            type="button"
            onClick={handleViewAll}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md cursor-pointer"
          >
            <span>{t('overview.view_all_transactions') || 'Go to Transactions Tab'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface RecurringDeviationModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: RecurringDeviationAlert[];
  displayCurrency: DisplayCurrency;
  onNavigateTab: (tab: ViewTab) => void;
  onNavigateToTransactions: (filters: { category?: string; month?: string; search?: string }) => void;
}

export function RecurringDeviationModal({
  isOpen,
  onClose,
  alerts,
  displayCurrency,
  onNavigateTab,
  onNavigateToTransactions,
}: RecurringDeviationModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleManageInRecurring = () => {
    onClose();
    onNavigateTab('recurring');
  };

  const handleSearchTx = (title: string) => {
    onClose();
    onNavigateToTransactions({ search: title });
  };

  return (
    <div 
      id="recurring-deviation-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="recurring-deviation-modal-dialog"
        className="bg-[#111622] border border-rose-500/30 rounded-2xl max-w-xl w-full p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl my-auto max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>{t('overview.recurring_deviation') || 'Recurring Deviation Alerts'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                  {alerts.length}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Charges that exceeded your set variation threshold vs historical average.
              </p>
            </div>
          </div>
          <button
            id="close-deviation-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts List */}
        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {alerts.map((alert) => {
            const isHigher = alert.diff > 0;
            return (
              <div
                key={alert.id}
                className="bg-[#151c2c] border border-slate-800 hover:border-rose-500/40 rounded-xl p-3.5 sm:p-4 space-y-3 transition-all group"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 group-hover:text-rose-300 transition-colors">
                        {alert.title}
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {alert.category} • {alert.account}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono">
                    {isHigher ? '+' : '-'}{alert.deviationPercent.toFixed(0)}% vs avg (limit: ±{alert.threshold}%)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#0f1420] p-2.5 rounded-lg border border-slate-800/80 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Latest Charge</span>
                    <span className="font-bold text-rose-400">{formatCurrency(alert.latestAmount, displayCurrency)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Historical Avg</span>
                    <span className="text-slate-300">{formatCurrency(alert.priorAvgAmount, displayCurrency)}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 block">Variance</span>
                    <span className={`font-bold ${isHigher ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {isHigher ? '+' : ''}{formatCurrency(alert.diff, displayCurrency)}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Latest charge of <strong className="text-slate-200">{formatCurrency(alert.latestAmount, displayCurrency)}</strong> {alert.latestDate ? `on ${alert.latestDate}` : ''} deviates by <strong className="text-rose-300">{alert.deviationPercent.toFixed(0)}%</strong> from the baseline of {formatCurrency(alert.priorAvgAmount, displayCurrency)}.
                </p>

                <div className="pt-1 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleSearchTx(alert.cleanTitle || alert.title)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Search Transactions</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleManageInRecurring}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <span>Manage in Recurring</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors cursor-pointer"
          >
            {t('common.close') || 'Close'}
          </button>
          
          <button
            type="button"
            onClick={handleManageInRecurring}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition-all shadow-md cursor-pointer"
          >
            <span>Go to Recurring & Subscriptions</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
