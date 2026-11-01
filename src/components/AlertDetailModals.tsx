import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CategoryAnomaly, RecurringDeviationAlert, RecurringAlertSeverity, groupRecurringAlerts, formatCurrency } from '../utils/financeUtils';
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

const SEVERITY_ORDER: RecurringAlertSeverity[] = ['ATTENTION', 'WATCH', 'PENDING', 'INFO'];

const SEVERITY_STYLES: Record<RecurringAlertSeverity, { dot: string; text: string; border: string; badge: string; hoverBorder: string }> = {
  ATTENTION: {
    dot: 'bg-rose-400',
    text: 'text-rose-300',
    border: 'border-rose-500/30',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    hoverBorder: 'hover:border-rose-500/40',
  },
  WATCH: {
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    hoverBorder: 'hover:border-amber-500/40',
  },
  PENDING: {
    dot: 'bg-sky-400',
    text: 'text-sky-300',
    border: 'border-sky-500/30',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    hoverBorder: 'hover:border-sky-500/40',
  },
  INFO: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    hoverBorder: 'hover:border-emerald-500/40',
  },
};

export function RecurringDeviationModal({
  isOpen,
  onClose,
  alerts,
  displayCurrency,
  onNavigateTab,
  onNavigateToTransactions,
}: RecurringDeviationModalProps) {
  const { t } = useTranslation();
  const [showInfo, setShowInfo] = useState(false);

  if (!isOpen) return null;

  const todayDay = new Date().getDate();

  const handleManageInRecurring = () => {
    onClose();
    onNavigateTab('recurring');
  };

  const handleSearchTx = (title: string) => {
    onClose();
    onNavigateToTransactions({ search: title });
  };

  const bySeverity = SEVERITY_ORDER.map(sev => ({
    severity: sev,
    groups: groupRecurringAlerts(alerts.filter(a => a.severity === sev)),
  })).filter(s => s.groups.length > 0);

  const infoCount = alerts.filter(a => a.severity === 'INFO').length;

  const renderVariant = (alert: RecurringDeviationAlert, showTitle: boolean) => {
    const styles = SEVERITY_STYLES[alert.severity];
    const isHigher = alert.direction === 'UP';
    return (
      <div key={alert.id} className="space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${styles.dot} shrink-0`} />
            <div>
              {showTitle && (
                <h4 className="text-sm font-bold text-slate-100">
                  {alert.title}
                </h4>
              )}
              <span className="text-[10px] text-slate-400">
                {alert.category} • {alert.account} • {alert.currency}
              </span>
            </div>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border font-mono ${styles.badge}`}>
            {t('alerts.badge_vs_avg', {
              sign: isHigher ? '+' : '-',
              percent: alert.deviationPercent.toFixed(0),
              threshold: alert.threshold,
            })}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#0f1420] p-2.5 rounded-lg border border-slate-800/80 text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block">{t('alerts.latest_charge')}</span>
            <span className="font-bold text-slate-100">{formatCurrency(alert.latestAmount, displayCurrency)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">
              {alert.isPartialMonth ? t('alerts.baseline_mtd', { day: todayDay }) : t('alerts.baseline')}
            </span>
            <span className="text-slate-300">{formatCurrency(alert.priorAvgAmount, displayCurrency)}</span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-400 block">{t('alerts.variance')}</span>
            <span className={`font-bold ${isHigher ? 'text-rose-400' : 'text-emerald-400'}`}>
              {isHigher ? '+' : ''}{formatCurrency(alert.diff, displayCurrency)}
            </span>
          </div>
        </div>

        {alert.isPartialMonth && (
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {t('alerts.mtd_note')}
            {alert.severity === 'PENDING' && <> {t('alerts.pending_note')}</>}
          </p>
        )}

        <div className="pt-0.5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handleSearchTx(alert.cleanTitle || alert.title)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{t('alerts.search_transactions')}</span>
          </button>
        </div>
      </div>
    );
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
                <span>{t('overview.recurring_deviation')}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                  {alerts.length}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('alerts.modal_subtitle')}
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

        {/* Severity sections */}
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          {bySeverity.map(({ severity, groups }) => {
            const styles = SEVERITY_STYLES[severity];
            const count = groups.reduce((n, g) => n + g.variants.length, 0);
            if (severity === 'INFO' && !showInfo) {
              return (
                <button
                  key={severity}
                  type="button"
                  onClick={() => setShowInfo(true)}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border ${styles.border} ${styles.badge} text-xs font-bold transition-colors cursor-pointer`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${styles.dot}`} />
                    {t('alerts.info_toggle_show', { count })}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              );
            }
            return (
              <div key={severity} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${styles.text}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${styles.dot}`} />
                    {t(`alerts.section_${severity.toLowerCase()}`)}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${styles.badge}`}>{count}</span>
                  </span>
                  {severity === 'INFO' && (
                    <button
                      type="button"
                      onClick={() => setShowInfo(false)}
                      className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      {t('alerts.info_toggle_hide')}
                    </button>
                  )}
                </div>
                {groups.map(group => (
                  <div
                    key={group.key}
                    className={`bg-[#151c2c] border border-slate-800 ${styles.hoverBorder} rounded-xl p-3.5 sm:p-4 space-y-4 transition-all`}
                  >
                    {group.variants.length > 1 && (
                      <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800/80">
                        <h4 className="text-sm font-bold text-slate-100">{group.title}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                          {t('alerts.variants_count', { count: group.variants.length })}
                        </span>
                      </div>
                    )}
                    {group.variants.map(alert => renderVariant(alert, group.variants.length === 1))}
                  </div>
                ))}
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
            {t('common.close')}
          </button>

          <button
            type="button"
            onClick={handleManageInRecurring}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition-all shadow-md cursor-pointer"
          >
            <span>{t('alerts.go_recurring')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
