import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  REPORT_CATALOG, 
  REPORT_CATEGORIES, 
  REPORT_PRESETS, 
  DEFAULT_SELECTED_REPORTS, 
  ReportDefinition, 
  ReportCategoryId 
} from '../../utils/reportsCatalog';
import { 
  X, Check, Sparkles, Sliders, RotateCcw, Search, 
  CheckCircle2, AlertCircle, Info, ChevronRight, Layers, LayoutGrid
} from 'lucide-react';

interface ReportsCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedReportIds: string[];
  onSaveSelectedReports: (reportIds: string[]) => void;
}

export const ReportsCustomizerModal: React.FC<ReportsCustomizerModalProps> = ({
  isOpen,
  onClose,
  selectedReportIds,
  onSaveSelectedReports,
}) => {
  const { t, i18n } = useTranslation();
  const isEs = i18n.language.startsWith('es');

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return selectedReportIds && selectedReportIds.length > 0
      ? selectedReportIds.slice(0, 5)
      : [...DEFAULT_SELECTED_REPORTS];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  if (!isOpen) return null;

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(item => item !== id));
    } else {
      if (selectedIds.length >= 5) {
        return; // Max 5 limit
      }
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleApplyPreset = (presetIds: string[]) => {
    setSelectedIds(presetIds.slice(0, 5));
  };

  const handleResetDefaults = () => {
    setSelectedIds([...DEFAULT_SELECTED_REPORTS]);
  };

  const handleSave = () => {
    if (selectedIds.length === 0) {
      onSaveSelectedReports([...DEFAULT_SELECTED_REPORTS]);
    } else {
      onSaveSelectedReports(selectedIds);
    }
    onClose();
  };

  // Filter catalog
  const filteredCatalog = REPORT_CATALOG.filter(report => {
    if (activeCategory !== 'ALL' && report.category !== activeCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = isEs ? (t(report.titleKey, report.defaultTitle)) : report.defaultTitle;
      const desc = isEs ? (t(report.descKey, report.defaultDesc)) : report.defaultDesc;
      return title.toLowerCase().includes(q) || desc.toLowerCase().includes(q) || report.badge.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-[#0f131a] border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-4 bg-[#121620]">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100">
                  {t('reports_customizer.title', 'Reports & Analytics Library')}
                </h3>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  selectedIds.length === 5 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {selectedIds.length} / 5 {t('reports_customizer.selected', 'Selected')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {t('reports_customizer.subtitle', 'Select up to 5 focused reports to display on your primary Reports dashboard.')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="px-5 sm:px-6 py-3 bg-[#161b24] border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
          <span className="text-slate-400 font-bold shrink-0 flex items-center gap-1.5 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {t('reports_customizer.preset_label', 'Presets:')}
          </span>
          {REPORT_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset.reportIds)}
              className="px-3 py-1.5 rounded-lg bg-[#0e1218] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-all shrink-0 font-medium cursor-pointer"
              title={isEs ? preset.descEs : preset.descEn}
            >
              {isEs ? preset.nameEs : preset.nameEn}
            </button>
          ))}
        </div>

        {/* Filters & Search */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#121620]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('reports_customizer.search_placeholder', 'Search 20 analytical reports...')}
              className="w-full bg-[#0a0d12] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeCategory === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-[#161b24] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {t('reports_customizer.filter_all', 'All (20)')}
            </button>
            {REPORT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-[#161b24] text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {isEs ? cat.labelEs : cat.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* 20 Reports Grid */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-[#0a0d12]">
          {filteredCatalog.map((report) => {
            const Icon = report.icon;
            const isSelected = selectedIds.includes(report.id);
            const isMaxReached = !isSelected && selectedIds.length >= 5;
            const title = t(report.titleKey, report.defaultTitle);
            const desc = t(report.descKey, report.defaultDesc);

            return (
              <div
                key={report.id}
                onClick={() => !isMaxReached && handleToggle(report.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30'
                    : isMaxReached
                    ? 'bg-[#121620]/50 border-slate-800/40 opacity-50 cursor-not-allowed'
                    : 'bg-[#121620] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2.5 rounded-xl border ${
                        isSelected 
                          ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' 
                          : 'bg-slate-800/60 border-slate-700/50 text-slate-400'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-100 line-clamp-1">{title}</h4>
                        <span className="text-[10px] text-indigo-400/90 font-semibold font-mono">{report.badge}</span>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-500 text-white' 
                        : 'border-slate-700 bg-slate-800/40'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mt-1">
                    {desc}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/60 text-[11px]">
                  <span className={`font-semibold ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {isSelected ? '✓ On Dashboard' : isMaxReached ? 'Max 5 Selected' : '+ Click to Select'}
                  </span>
                  {report.isDefault && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      Recommended
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#121620]">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('reports_customizer.reset_defaults', 'Reset to Recommended 5')}
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 border border-slate-700 transition-all cursor-pointer"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-md shadow-indigo-950/30 cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {t('reports_customizer.apply_selection', 'Apply Selection')} ({selectedIds.length}/5)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
