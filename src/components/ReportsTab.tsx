import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, DisplayCurrency, RecurringRule, AccountItem, CategoryItem } from '../types';
import { convertCurrency, formatCurrency, formatCurrencyCompact, getPendingRecurringForMonth } from '../utils/financeUtils';
import { BarChart3, Download, FileText, Settings, LayoutGrid } from 'lucide-react';
import jsPDF from 'jspdf';
import { EmptyState } from './EmptyState';
import { ReportWidgetRenderer } from './reports/ReportWidgets';
import { ReportsCustomizerModal } from './reports/ReportsCustomizerModal';
import { getSavedSelectedReports, saveSelectedReports, REPORT_CATALOG } from '../utils/reportsCatalog';

interface ReportsTabProps {
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  localCurrency?: DisplayCurrency;
  enabledCurrencies?: string[];
  usdArsRate: number;
  recurringRules?: RecurringRule[];
  accounts?: AccountItem[];
  categories?: CategoryItem[];
  nonRecurringKeys?: string[];
  currentUserId?: string;
  showSharedData?: boolean;
}

export const ReportsTab = React.memo(function ReportsTab({
  transactions,
  displayCurrency,
  localCurrency = 'EUR',
  enabledCurrencies = ['USD', 'ARS', 'EUR', 'BRL', 'USDT', 'CLP', 'UYU', 'GBP'],
  usdArsRate,
  recurringRules = [],
  accounts = [],
  categories = [],
  nonRecurringKeys = [],
  currentUserId,
  showSharedData = true,
}: ReportsTabProps) {
  const { t, i18n } = useTranslation();
  const isEs = i18n.language.startsWith('es');
  
  // Time range & general state
  const [timeRange, setTimeRange] = useState<'6M' | '12M' | 'ALL'>('12M');
  const [chartMode, setChartMode] = useState<'NATIVE_CURRENCY' | 'CONVERTED'>('NATIVE_CURRENCY');
  
  // Customizer state
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);

  useEffect(() => {
    setSelectedReports(getSavedSelectedReports());
    
    const handleUpdate = (e: CustomEvent<string[]>) => {
      setSelectedReports(e.detail);
    };
    window.addEventListener('finance_app_reports_settings_updated', handleUpdate as EventListener);
    return () => window.removeEventListener('finance_app_reports_settings_updated', handleUpdate as EventListener);
  }, []);

  const handleSaveReports = (ids: string[]) => {
    saveSelectedReports(ids);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('LevLev Financial Report', 14, 22);
    doc.setFontSize(10);
    doc.text(`Timeframe: ${timeRange}`, 14, 30);
    doc.save(`LevLev_Financial_Report_${displayCurrency}_${timeRange}.pdf`);
  };

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <BarChart3 className="w-6 h-6 text-emerald-500" />
            </div>
            {t('reports.title', 'Financial Reports & Projections')}
          </h2>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
          <EmptyState
            icon={FileText}
            title={t('reports.no_data_title', { defaultValue: 'No Financial Reports Available' })}
            description={t('reports.no_data_desc', { defaultValue: 'We need some transactions to generate your financial insights. Start by adding your first income or expense.' })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="bg-[#121620] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                {t('reports.title', 'Reports & Cashflow Trends')}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                  {selectedReports.length}/5 Active
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('reports.subtitle', 'Comprehensive historical reports and multi-currency breakdowns.')}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Time Range Selector */}
          <div className="bg-[#0f131a] p-1 border border-slate-800 rounded-xl flex items-center text-xs">
            <button
              onClick={() => setTimeRange('6M')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                timeRange === '6M' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('reports.time_6m', '6M')}
            </button>
            <button
              onClick={() => setTimeRange('12M')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                timeRange === '12M' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('reports.time_12m', '12M')}
            </button>
            <button
              onClick={() => setTimeRange('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                timeRange === 'ALL' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('reports.time_all', 'All')}
            </button>
          </div>

          <button
            onClick={() => setIsCustomizerOpen(true)}
            className="px-3.5 py-1.5 bg-[#161b24] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{t('reports.customize', 'Customize Dashboard')}</span>
          </button>
          
          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ml-auto md:ml-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dynamic Report Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {selectedReports.map((reportId, idx) => {
          const reportDef = REPORT_CATALOG.find(r => r.id === reportId);
          if (!reportDef) return null;
          const title = t(reportDef.titleKey, reportDef.defaultTitle);
          
          return (
            <div 
              key={reportId} 
              className={`bg-[#121620] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs ${
                idx === 0 && selectedReports.length % 2 !== 0 ? 'lg:col-span-2' : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                <reportDef.icon className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">{title}</h3>
              </div>
              <ReportWidgetRenderer
                reportId={reportId}
                transactions={transactions}
                displayCurrency={displayCurrency}
                localCurrency={localCurrency}
                usdArsRate={usdArsRate}
                timeRange={timeRange}
                chartMode={chartMode}
                recurringRules={recurringRules}
                accounts={accounts}
                categories={categories}
                currentUserId={currentUserId}
                showSharedData={showSharedData}
              />
            </div>
          );
        })}
      </div>

      <ReportsCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        selectedReportIds={selectedReports}
        onSaveSelectedReports={handleSaveReports}
      />
    </div>
  );
});

export default ReportsTab;
