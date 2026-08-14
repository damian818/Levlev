import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RecurringRule, AccountItem, CategoryItem } from '../types';
import { 
  X, 
  Repeat, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Calendar, 
  Tag, 
  Wallet, 
  Check, 
  Trash2,
  Sparkles,
  Info
} from 'lucide-react';

export interface RecurringRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveRule: (rule: RecurringRule) => void;
  onDeleteRule?: (ruleId: string) => void;
  editingRule?: RecurringRule | null;
  accountsList?: AccountItem[];
  categoriesList?: CategoryItem[];
}

export const RecurringRuleModal: React.FC<RecurringRuleModalProps> = ({
  isOpen,
  onClose,
  onSaveRule,
  onDeleteRule,
  editingRule,
  accountsList = [],
  categoriesList = [],
}) => {
  const { t } = useTranslation();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState('ARS');
  const [category, setCategory] = useState('General');
  const [account, setAccount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [frequency, setFrequency] = useState<'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'YEARLY'>('MONTHLY');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [description, setDescription] = useState('');

  // Default accounts and categories fallback
  const availableAccounts = accountsList.length > 0 
    ? accountsList.map(a => a.name)
    : ['BBVA', 'DollarApp', 'Visa BBVA', 'Efectivo'];

  const availableCategories = categoriesList.length > 0
    ? categoriesList.map(c => c.name)
    : ['Sueldo', 'Facturas y Servicios', 'Hogar', 'Alimentos y Bebidas', 'Suscripciones', 'Inversiones', 'General'];

  useEffect(() => {
    if (editingRule) {
      setTitle(editingRule.title || '');
      setType(editingRule.type || 'EXPENSE');
      setAmount(editingRule.amount ? String(editingRule.amount) : '');
      setCurrency(editingRule.currency || 'ARS');
      setCategory(editingRule.category || 'General');
      setAccount(editingRule.account || availableAccounts[0] || 'Default');
      setDayOfMonth(editingRule.dayOfMonth || 1);
      setFrequency(editingRule.frequency || 'MONTHLY');
      setIsActive(editingRule.isActive !== false);
      setDescription(editingRule.description || '');
    } else {
      setTitle('');
      setType('EXPENSE');
      setAmount('');
      setCurrency('ARS');
      setCategory('Facturas y Servicios');
      setAccount(availableAccounts[0] || 'BBVA');
      setDayOfMonth(1);
      setFrequency('MONTHLY');
      setIsActive(true);
      setDescription('');
    }
  }, [editingRule, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!title.trim() || isNaN(parsedAmount) || parsedAmount <= 0) return;

    const rule: RecurringRule = {
      id: editingRule?.id || `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ownerId: editingRule?.ownerId,
      title: title.trim(),
      type,
      amount: parsedAmount,
      currency,
      category: category.trim() || 'General',
      account: account.trim() || (availableAccounts[0] || 'Default'),
      dayOfMonth: Math.min(31, Math.max(1, Number(dayOfMonth) || 1)),
      frequency,
      isActive,
      description: description.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    onSaveRule(rule);
    onClose();
  };

  const handleQuickPreset = (presetTitle: string, presetType: 'INCOME' | 'EXPENSE', presetCat: string, presetDay: number) => {
    setTitle(presetTitle);
    setType(presetType);
    setCategory(presetCat);
    setDayOfMonth(presetDay);
  };

  return (
    <div id="recurring-rule-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        id="recurring-rule-modal-card"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${type === 'INCOME' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'}`}>
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingRule ? (t('recurring.edit_rule') || 'Edit Recurring Item') : (t('recurring.new_rule') || 'New Recurring Item')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('recurring.rule_modal_subtitle') || 'Auto-estimates pending expenses & incomes across the app'}
              </p>
            </div>
          </div>
          <button
            id="close-recurring-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Quick Presets for New Items */}
          {!editingRule && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('recurring.quick_templates') || 'Quick Templates'}
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickPreset('Sueldo / Salary', 'INCOME', 'Sueldo', 5)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Sueldo (5th)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('Alquiler / Rent', 'EXPENSE', 'Hogar', 10)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                >
                  Alquiler (10th)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('Expensas / Utilities', 'EXPENSE', 'Facturas y Servicios', 15)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                >
                  Expensas (15th)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('Internet / Celular', 'EXPENSE', 'Facturas y Servicios', 20)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                >
                  Servicios (20th)
                </button>
              </div>
            </div>
          )}

          {/* Type Toggle: Expense / Income */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              id="rule-type-expense-btn"
              onClick={() => setType('EXPENSE')}
              className={`flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                type === 'EXPENSE'
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              {t('overview.expense') || 'Expense'}
            </button>
            <button
              type="button"
              id="rule-type-income-btn"
              onClick={() => setType('INCOME')}
              className={`flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                type === 'INCOME'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              {t('overview.income') || 'Income'}
            </button>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span>{t('recurring.merchant_item') || 'Title / Concept'}</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              id="recurring-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sueldo mensual, Alquiler, Spotify, Seguro"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
            />
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>{t('overview.amount') || 'Amount'}</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                id="recurring-amount-input"
                type="number"
                step="any"
                required
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-semibold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('overview.currency') || 'Currency'}
              </label>
              <select
                id="recurring-currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
              >
                <option value="ARS">ARS ($)</option>
                <option value="USD">USD (US$)</option>
                <option value="EUR">EUR (€)</option>
                <option value="BRL">BRL (R$)</option>
              </select>
            </div>
          </div>

          {/* Day of Month & Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('recurring.day_of_month') || 'Day of Month'}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="recurring-day-input"
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-semibold"
                />
                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                  (1 - 31)
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('recurring.frequency') || 'Frequency'}
              </label>
              <select
                id="recurring-frequency-select"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
              >
                <option value="MONTHLY">{t('recurring.monthly') || 'Monthly'}</option>
                <option value="BIWEEKLY">{t('recurring.biweekly') || 'Bi-weekly'}</option>
                <option value="WEEKLY">{t('recurring.weekly') || 'Weekly'}</option>
                <option value="YEARLY">{t('recurring.yearly') || 'Yearly'}</option>
              </select>
            </div>
          </div>

          {/* Category & Account */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('overview.category') || 'Category'}</span>
              </label>
              <select
                id="recurring-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
              >
                {availableCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('overview.account') || 'Account'}</span>
              </label>
              <select
                id="recurring-account-select"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
              >
                {availableAccounts.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Status Checkbox */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('recurring.active_rule_label') || 'Active Recurring Rule'}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isActive 
                  ? (t('recurring.active_rule_desc') || 'Estimated automatically in calendar, overview & reports.')
                  : (t('recurring.paused_rule_desc') || 'Paused (will not appear in estimated pending amounts).')}
              </p>
            </div>
            <input
              id="recurring-is-active-toggle"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 rounded-md text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
            />
          </div>

          {/* Dynamic Sync Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-200 text-xs">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <span>
              {t('recurring.dynamic_sync_hint') || 
                'Future Adjustments: Any change to this rule automatically adjusts all future occurrences and pending estimates in the Calendar, Overview, and Reports.'}
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {editingRule && onDeleteRule ? (
              <button
                type="button"
                id="delete-recurring-rule-btn"
                onClick={() => {
                  if (confirm(t('recurring.confirm_delete_rule') || 'Delete this recurring rule?')) {
                    onDeleteRule(editingRule.id);
                    onClose();
                  }
                }}
                className="px-3.5 py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                {t('recurring.delete_rule') || 'Delete'}
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="cancel-recurring-rule-btn"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                {t('overview.cancel') || 'Cancel'}
              </button>
              <button
                type="submit"
                id="save-recurring-rule-btn"
                className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {editingRule ? (t('recurring.save_changes') || 'Save Changes') : (t('recurring.create_rule') || 'Create Rule')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
export default RecurringRuleModal;
