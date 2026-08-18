import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CategoryItem, 
  AccountItem, 
  Transaction, 
  BudgetGoal, 
  CreditCardClosingRule, 
  ClosingRuleType, 
  DisplayCurrency,
  AccountCustomBalance
} from '../types';
import { 
  Wallet, 
  Tag, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  AlertTriangle, 
  Download, 
  Upload, 
  RefreshCw, 
  CreditCard, 
  Building2, 
  PiggyBank, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sliders,
  DollarSign,
  ShieldAlert,
  Info,
  Database,
  LogIn,
  LogOut,
  UserCheck,
  Globe,
  Key,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Shield,
  Activity,
  CheckCircle2,
  ShieldCheck,
  Users,
  Share2,
  Coins,
  Landmark,
  RotateCcw,
  LayoutDashboard,
  Receipt,
  Target,
  Repeat,
  TrendingDown,
  TrendingUp,
  Sparkles,
  BarChart3,
  ChevronUp,
  ChevronDown,
  GripVertical
} from 'lucide-react';
import { 
  verifyAccountBalances 
} from '../utils/financeUtils';
import { 
  getSupabaseCredentials, 
  getSupabaseClient, 
  isSupabaseConfigured, 
  saveCustomSupabaseCredentials, 
  signInWithGoogle, 
  signOutFromSupabase 
} from '../lib/supabase';
import ImportWizardModal from './ImportWizardModal';
import { TabCustomizationItem, getSavedTabCustomization, saveTabCustomizationToStorage, mergeTabOrder, DEFAULT_TAB_ORDER } from '../utils/tabUtils';

import { TIMEZONE_OPTIONS } from '../utils/timezoneUtils';
import { WORLD_CURRENCIES, CURRENCY_MAP, getFxProviderInfo, getCurrencyName } from '../utils/currencyUtils';

interface SettingsTabProps {
  authUser: any;
  authLoading: boolean;
  categories: CategoryItem[];
  accounts: AccountItem[];
  transactions: Transaction[];
  budgets: BudgetGoal[];
  usdArsRate: number;
  localCurrency?: DisplayCurrency;
  onUpdateLocalCurrency?: (currency: DisplayCurrency) => void;
  displayCurrency?: DisplayCurrency;
  onUpdateDisplayCurrency?: (currency: DisplayCurrency) => void;
  enabledCurrencies?: string[];
  onUpdateEnabledCurrencies?: (currencies: string[]) => void;
  userTimezone?: string;
  onUpdateTimezone?: (tz: string) => void;
  privacyMode?: boolean;
  isWorkspaceShared?: boolean;
  showSharedData?: boolean;
  onToggleShowSharedData?: () => void;
  workspaceMembersCount?: number;
  onOpenShareWorkspaceModal?: () => void;
  customBalances?: Record<string, AccountCustomBalance>;
  onTogglePrivacyMode?: () => void;
  onUpdateRate: (rate: number) => void;
  onAddCategory: (category: CategoryItem) => void;
  onEditCategory: (oldName: string, updatedCategory: CategoryItem, updateTransactions: boolean) => void;
  onDeleteCategory: (categoryName: string, reassignTo?: string) => void;
  onAddAccount: (account: AccountItem) => void;
  onEditAccount: (oldName: string, updatedAccount: AccountItem, updateTransactions: boolean) => void;
  onDeleteAccount: (accountName: string) => void;
  onImportBackup?: (data: { transactions: Transaction[]; categories: CategoryItem[]; accounts: AccountItem[]; budgets: BudgetGoal[] }) => void;
  onOpenImportModal?: () => void;
  onRecalculateBalances?: () => void;
  onLogout: () => void;
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
  requestNotificationPermission?: () => Promise<boolean>;
  hiddenCategoryIds?: string[];
  onUpdateHiddenCategoryIds?: (ids: string[]) => void;
  tabCustomization?: TabCustomizationItem[];
  onUpdateTabCustomization?: (tabs: TabCustomizationItem[]) => void;
}

export function SettingsTab({
  authUser,
  authLoading,
  categories,
  accounts,
  transactions,
  budgets,
  usdArsRate,
  localCurrency = 'ARS',
  onUpdateLocalCurrency,
  displayCurrency = 'ARS',
  onUpdateDisplayCurrency,
  enabledCurrencies = ['USD', 'ARS', 'EUR', 'BRL', 'USDT', 'CLP', 'UYU', 'GBP'],
  onUpdateEnabledCurrencies,
  userTimezone = 'America/Argentina/Buenos_Aires',
  onUpdateTimezone,
  privacyMode = false,
  isWorkspaceShared = false,
  showSharedData = true,
  onToggleShowSharedData,
  workspaceMembersCount = 0,
  onOpenShareWorkspaceModal,
  customBalances,
  onTogglePrivacyMode,
  onUpdateRate,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onImportBackup,
  onOpenImportModal,
  onRecalculateBalances,
  onLogout,
  notificationsEnabled = false,
  onToggleNotifications,
  requestNotificationPermission,
  hiddenCategoryIds = [],
  onUpdateHiddenCategoryIds,
  tabCustomization: propsTabCustomization,
  onUpdateTabCustomization,
}: SettingsTabProps) {
  const { t, i18n } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'categories' | 'preferences' | 'sharing'>('accounts');

  // Tab Customization State
  const [localTabCustom, setLocalTabCustom] = useState<TabCustomizationItem[]>(() => getSavedTabCustomization());
  const tabList = propsTabCustomization !== undefined ? mergeTabOrder(propsTabCustomization) : mergeTabOrder(localTabCustom);

  const saveTabs = (next: TabCustomizationItem[]) => {
    const merged = mergeTabOrder(next);
    if (onUpdateTabCustomization) {
      onUpdateTabCustomization(merged);
    } else {
      setLocalTabCustom(merged);
      saveTabCustomizationToStorage(merged);
    }
  };

  const handleMoveTab = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tabList.length) return;
    const next = [...tabList];
    const item = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = item;
    const reordered = next.map((tab, idx) => ({ ...tab, order: idx }));
    saveTabs(reordered);
  };

  const handleToggleTabVisibility = (id: string) => {
    if (id === 'settings') return; // Cannot hide settings
    const next = tabList.map(item => item.id === id ? { ...item, isHidden: !item.isHidden } : item);
    saveTabs(next);
  };

  const handleResetTabs = () => {
    saveTabs([...DEFAULT_TAB_ORDER]);
  };

  const TAB_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
    overview: { label: t('nav.overview'), icon: LayoutDashboard },
    reports: { label: t('nav.reports'), icon: BarChart3 },
    transactions: { label: t('nav.transactions'), icon: Receipt },
    accounts: { label: t('nav.accounts'), icon: Wallet },
    budgets: { label: t('nav.budgets'), icon: Target },
    recurring: { label: t('nav.recurring'), icon: Repeat },
    'debt-payoff': { label: t('nav.debt_payoff') || 'Debt Payoff', icon: TrendingDown },
    inflation: { label: t('nav.inflation'), icon: TrendingUp },
    'ai-advisor': { label: t('nav.ai_advisor'), icon: Sparkles },
    settings: { label: t('nav.settings'), icon: Sliders },
  };

  // Diagnostic State for Balance Verification
  const [diagnosticStatus, setDiagnosticStatus] = useState<{
    ran: boolean;
    totalAccounts: number;
    discrepancyCount: number;
    summaryMessage: string;
  } | null>(null);

  const handleRecalculateBalancesClick = () => {
    if (onRecalculateBalances) {
      onRecalculateBalances();
    }
    // Re-verify balances after recalculation
    const results = verifyAccountBalances(accounts, transactions, undefined);
    setDiagnosticStatus({
      ran: true,
      totalAccounts: results.length,
      discrepancyCount: 0,
      summaryMessage: t('settings.syncing')
    });
  };

  const handleVerifyBalances = () => {
    const results = verifyAccountBalances(accounts, transactions, customBalances);
    const discrepancies = results.filter(r => r.hasDiscrepancy);

    console.group('🔍 Diagnostic: Verify Account Balances');
    console.log(`Verified ${results.length} account(s):`);

    if (discrepancies.length > 0) {
      console.warn(`⚠️ Found ${discrepancies.length} discrepancy/discrepancies among ${results.length} account(s):`);
      discrepancies.forEach(res => {
        console.warn(
          `❌ [DISCREPANCY] Account: "${res.accountName}"\n` +
          `   • Initial Balance: ${res.initialBalance}\n` +
          `   • Sum of Transactions: ${res.sumTransactions}\n` +
          `   • Expected Balance (Initial + Sum): ${res.expectedBalance}\n` +
          `   • UI Calculated Balance: ${res.uiCalculatedBalance}\n` +
          `   • Discrepancy Amount: ${res.discrepancy}`
        );
      });
    } else {
      console.log('✅ All account balances match (Initial Balance + Sum of Transactions = UI Balance).');
      results.forEach(res => {
        console.log(
          `✅ [OK] Account: "${res.accountName}" | Initial: ${res.initialBalance} | Sum Txs: ${res.sumTransactions} | UI Balance: ${res.uiCalculatedBalance}`
        );
      });
    }
    console.groupEnd();

    setDiagnosticStatus({
      ran: true,
      totalAccounts: results.length,
      discrepancyCount: discrepancies.length,
      summaryMessage: discrepancies.length > 0
        ? `Diagnostic complete: ${discrepancies.length} discrepancy/discrepancies found across ${results.length} account(s). Details printed to console log.`
        : `Diagnostic complete: All ${results.length} account balance(s) match (Initial + Sum = UI Balance). Details printed to console log.`
    });
  };

  // Modal States for Category
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryItem | null>(null);
  const [catNameInput, setCatNameInput] = useState('');
  const [catTypeInput, setCatTypeInput] = useState<'EXPENSE' | 'INCOME' | 'BOTH'>('EXPENSE');
  const [catUpdateTxs, setCatUpdateTxs] = useState(true);

  const [deletingCatName, setDeletingCatName] = useState<string | null>(null);
  const [reassignCatTo, setReassignCatTo] = useState<string>('General');

  // Modal States for Account
  const [isAddAccOpen, setIsAddAccOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<AccountItem | null>(null);
  const [accNameInput, setAccNameInput] = useState('');
  const [accTypeInput, setAccTypeInput] = useState<'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'WALLET' | 'INVESTMENT' | 'OTHER'>('CHECKING');
  const [accCurrencyInput, setAccCurrencyInput] = useState<string>('ARS');
  const [accBalanceInput, setAccBalanceInput] = useState<string>('0');
  const [accRuleTypeInput, setAccRuleTypeInput] = useState<ClosingRuleType>('FIXED_DAY');
  const [accFixedDayInput, setAccFixedDayInput] = useState<number>(25);
  const [accWeekdayInput, setAccWeekdayInput] = useState<number>(4); // Thursday
  const [accNthInput, setAccNthInput] = useState<number>(4); // 4th
  const [accDueDaysInput, setAccDueDaysInput] = useState<number>(5);
  const [accUpdateTxs, setAccUpdateTxs] = useState(true);

  const [deletingAccName, setDeletingAccName] = useState<string | null>(null);
  const [currencyToAdd, setCurrencyToAdd] = useState<string>('');

  const handleAddEnabledCurrency = (code: string) => {
    if (!code) return;
    const upper = code.toUpperCase();
    if (!enabledCurrencies.includes(upper)) {
      const updated = [...enabledCurrencies, upper];
      if (onUpdateEnabledCurrencies) {
        onUpdateEnabledCurrencies(updated);
      }
    }
    setCurrencyToAdd('');
  };

  const handleRemoveEnabledCurrency = (code: string) => {
    if (enabledCurrencies.length <= 1) {
      alert('You must keep at least one currency enabled.');
      return;
    }
    const updated = enabledCurrencies.filter(c => c !== code);
    if (onUpdateEnabledCurrencies) {
      onUpdateEnabledCurrencies(updated);
    }
  };

  const handleSetPresetCurrencies = (preset: string[]) => {
    if (onUpdateEnabledCurrencies) {
      onUpdateEnabledCurrencies(preset);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      alert(`Google SSO login failed: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await signOutFromSupabase();
    onLogout();
  };

  // Category usage count map
  const categoryUsageMap = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.category) {
        map[t.category] = (map[t.category] || 0) + 1;
      }
    });
    return map;
  }, [transactions]);

  // Account usage count map
  const accountUsageMap = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.account) map[t.account] = (map[t.account] || 0) + 1;
      if (t.toAccount) map[t.toAccount] = (map[t.toAccount] || 0) + 1;
    });
    return map;
  }, [transactions]);

  // --- Category Handlers ---
  const handleOpenAddCategory = () => {
    setCatNameInput('');
    setCatTypeInput('EXPENSE');
    setIsAddCatOpen(true);
  };

  const handleSaveAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameInput.trim()) return;
    const newCat: CategoryItem = {
      id: `cat-${Date.now()}`,
      name: catNameInput.trim(),
      type: catTypeInput,
    };
    onAddCategory(newCat);
    setIsAddCatOpen(false);
  };

  const handleOpenEditCategory = (cat: CategoryItem) => {
    setEditingCat(cat);
    setCatNameInput(cat.name);
    setCatTypeInput(cat.type);
    setCatUpdateTxs(true);
  };

  const handleSaveEditCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat || !catNameInput.trim()) return;
    const updated: CategoryItem = {
      ...editingCat,
      name: catNameInput.trim(),
      type: catTypeInput,
    };
    onEditCategory(editingCat.name, updated, catUpdateTxs);
    setEditingCat(null);
  };

  const handleConfirmDeleteCategory = () => {
    if (!deletingCatName) return;
    onDeleteCategory(deletingCatName, reassignCatTo);
    setDeletingCatName(null);
  };

  // --- Account Handlers ---
  const handleOpenAddAccount = () => {
    setAccNameInput('');
    setAccTypeInput('CHECKING');
    setAccCurrencyInput('ARS');
    setAccBalanceInput('0');
    setAccRuleTypeInput('FIXED_DAY');
    setAccFixedDayInput(25);
    setAccWeekdayInput(4);
    setAccNthInput(4);
    setAccDueDaysInput(5);
    setIsAddAccOpen(true);
  };

  const handleSaveAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accNameInput.trim()) return;
    const isCC = accTypeInput === 'CREDIT_CARD';
    let closingRule: CreditCardClosingRule | undefined = undefined;

    if (isCC) {
      if (accRuleTypeInput === 'FIXED_DAY') {
        closingRule = { ruleType: 'FIXED_DAY', fixedDay: accFixedDayInput, dueDaysAfterClose: accDueDaysInput };
      } else if (accRuleTypeInput === 'NTH_WEEKDAY') {
        closingRule = { ruleType: 'NTH_WEEKDAY', weekday: accWeekdayInput, nth: accNthInput, dueDaysAfterClose: accDueDaysInput };
      } else {
        closingRule = { ruleType: accRuleTypeInput, weekday: accWeekdayInput, dueDaysAfterClose: accDueDaysInput };
      }
    }

    const newAcc: AccountItem = {
      id: `acc-${Date.now()}`,
      name: accNameInput.trim(),
      type: accTypeInput,
      currency: accCurrencyInput,
      initialBalance: parseFloat(accBalanceInput) || 0,
      closingRule,
    };

    onAddAccount(newAcc);
    setIsAddAccOpen(false);
  };

  const handleOpenEditAccount = (acc: AccountItem) => {
    setEditingAcc(acc);
    setAccNameInput(acc.name);
    setAccTypeInput(acc.type);
    setAccCurrencyInput(acc.currency);
    setAccBalanceInput(String(acc.initialBalance || 0));
    
    if (acc.closingRule) {
      setAccRuleTypeInput(acc.closingRule.ruleType);
      setAccFixedDayInput(acc.closingRule.fixedDay || 25);
      setAccWeekdayInput(acc.closingRule.weekday ?? 4);
      setAccNthInput(acc.closingRule.nth || 4);
      setAccDueDaysInput(acc.closingRule.dueDaysAfterClose || 5);
    } else {
      setAccRuleTypeInput('FIXED_DAY');
      setAccFixedDayInput(25);
      setAccWeekdayInput(4);
      setAccNthInput(4);
      setAccDueDaysInput(5);
    }
    setAccUpdateTxs(true);
  };

  const handleSaveEditAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAcc || !accNameInput.trim()) return;
    const isCC = accTypeInput === 'CREDIT_CARD';
    let closingRule: CreditCardClosingRule | undefined = undefined;

    if (isCC) {
      if (accRuleTypeInput === 'FIXED_DAY') {
        closingRule = { ruleType: 'FIXED_DAY', fixedDay: accFixedDayInput, dueDaysAfterClose: accDueDaysInput };
      } else if (accRuleTypeInput === 'NTH_WEEKDAY') {
        closingRule = { ruleType: 'NTH_WEEKDAY', weekday: accWeekdayInput, nth: accNthInput, dueDaysAfterClose: accDueDaysInput };
      } else {
        closingRule = { ruleType: accRuleTypeInput, weekday: accWeekdayInput, dueDaysAfterClose: accDueDaysInput };
      }
    }

    const updated: AccountItem = {
      ...editingAcc,
      name: accNameInput.trim(),
      type: accTypeInput,
      currency: accCurrencyInput,
      initialBalance: parseFloat(accBalanceInput) || 0,
      closingRule,
    };

    onEditAccount(editingAcc.name, updated, accUpdateTxs);
    setEditingAcc(null);
  };

  const handleConfirmDeleteAccount = () => {
    if (!deletingAccName) return;
    onDeleteAccount(deletingAccName);
    setDeletingAccName(null);
  };

  // --- Export Ivy Wallet CSV ---
  const handleExportIvyCSV = () => {
    // Columns: Date, Title, Amount, Currency, Category, Account, Type, Description, To Account
    const headers = ["Date", "Title", "Amount", "Currency", "Category", "Account", "Type", "Description", "To Account"];
    
    const rows = transactions.map(t => {
      // Format date to YYYY-MM-DD HH:mm:ss
      // If t.date is YYYY-MM-DD, we append 12:00:00
      let dateTime = t.date;
      if (dateTime.length === 10) {
        dateTime += " 12:00:00";
      }

      // Map types to Ivy Wallet expected values
      let type = t.type;
      if (type === 'CC_PAYMENT') type = 'EXPENSE'; 

      return [
        `"${dateTime}"`,
        `"${(t.title || "").replace(/"/g, '""')}"`,
        t.amount,
        `"${t.currency}"`,
        `"${(t.category || "").replace(/"/g, '""')}"`,
        `"${(t.account || "").replace(/"/g, '""')}"`,
        `"${type}"`,
        `"${(t.description || "").replace(/"/g, '""')}"`,
        `"${(t.toAccount || "").replace(/"/g, '""')}"`
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ivy_wallet_export_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // --- Export JSON Backup ---
  const handleExportData = () => {
    const exportObject = {
      app: 'LevLev',
      exportDate: new Date().toISOString(),
      categories,
      accounts,
      transactions,
      budgets,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `levlev_backup_${new Date().toISOString().substring(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // --- Import JSON Backup ---

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121720] p-6 rounded-2xl border border-slate-800/80 shadow-md">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-emerald-400" />
            <span>{t('settings.title')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t('settings.subtitle')}
          </p>
        </div>

        {/* Sub Navigation */}
        <div className="flex max-w-full overflow-x-auto scrollbar-none bg-[#0f131a] p-1.5 rounded-xl border border-slate-800 gap-1 self-start md:self-auto w-full md:w-auto">
          <button
            onClick={() => setActiveSubTab('accounts')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
              activeSubTab === 'accounts'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{t('settings.accounts_management')} ({accounts.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('categories')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
              activeSubTab === 'categories'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Tag className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{t('common.category')} ({categories.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('preferences')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
              activeSubTab === 'preferences'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{t('nav.quick_options')}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('sharing')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
              activeSubTab === 'sharing'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4 text-purple-400 shrink-0" />
            <span>{t('nav.share_household')}</span>
          </button>
        </div>
      </div>

      {/* -------------------- ACCOUNTS SUB-TAB -------------------- */}
      {activeSubTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-200">{t('settings.financial_accounts')}</h3>
              <p className="text-xs text-slate-400">{t('settings.financial_accounts_desc')}</p>
            </div>
            <button
              onClick={handleOpenAddAccount}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{t('settings.add_account')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => {
              const usageCount = accountUsageMap[acc.name] || 0;
              const isCC = acc.type === 'CREDIT_CARD';

              return (
                <div 
                  key={acc.id}
                  className="bg-[#121720] border border-slate-800/90 hover:border-slate-700 rounded-2xl p-5 space-y-4 shadow-sm transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2.5 rounded-xl border ${
                          isCC 
                            ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                            : acc.type === 'INVESTMENT'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : acc.type === 'WALLET'
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}>
                          {isCC ? <CreditCard className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                            <span>{acc.name}</span>
                            {(acc.isShared || (acc.sharedMembers && acc.sharedMembers.length > 0)) && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-1">
                                <Users className="w-2.5 h-2.5" /> {t('settings.shared')} ({acc.sharedMembers?.length || 0})
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {acc.type.replace('_', ' ')} • {acc.currency}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditAccount(acc)}
                          className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/60 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors"
                          title={t('settings.edit_account')}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingAccName(acc.name)}
                          className="p-1.5 text-rose-400/80 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/20 transition-colors"
                          title={t('settings.delete_account')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isCC && acc.closingRule && (
                      <div className="bg-[#0f131a] p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1">
                        <div className="text-slate-400 font-semibold flex items-center justify-between">
                          <span>{t('settings.closing_rule')}:</span>
                          <span className="text-purple-400 font-bold">{acc.closingRule.ruleType}</span>
                        </div>
                        {acc.closingRule.ruleType === 'FIXED_DAY' && (
                          <p className="text-slate-300">{t('settings.closes_on_day')} <strong className="text-white">{acc.closingRule.fixedDay || 25}</strong> {t('settings.of_month')}.</p>
                        )}
                        {acc.closingRule.ruleType === 'NTH_WEEKDAY' && (
                          <p className="text-slate-300">{t('settings.closing_rule')}</p>
                        )}
                        {acc.closingRule.ruleType === 'LAST_WEEKDAY' && (
                          <p className="text-slate-300">{t('settings.closing_rule')}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{t('settings.usage_in_txs')}:</span>
                    <span className="font-semibold text-slate-200 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                      {usageCount} txs
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -------------------- CATEGORIES SUB-TAB -------------------- */}
      {activeSubTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-200">Income & Expense Categories</h3>
              <p className="text-xs text-slate-400">Customize expense and income categories used for budgets, reports, and transaction classification.</p>
            </div>
            <button
              onClick={handleOpenAddCategory}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map((cat) => {
              const usageCount = categoryUsageMap[cat.name] || 0;
              const isExpense = cat.type === 'EXPENSE';
              const isIncome = cat.type === 'INCOME';
              const isHidden = cat.isHiddenFromNewTx || (hiddenCategoryIds && (hiddenCategoryIds.includes(cat.id) || hiddenCategoryIds.includes(cat.name)));

              return (
                <div 
                  key={cat.id}
                  className={`bg-[#121720] border border-slate-800/90 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-all ${
                    isHidden ? 'opacity-50 grayscale-[0.5]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg border ${
                        isExpense 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                          : isIncome 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                      }`}>
                        <Tag className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-100">{cat.name}</h4>
                        <span className={`text-[10px] font-semibold ${
                          isExpense ? 'text-amber-400' : isIncome ? 'text-emerald-400' : 'text-indigo-400'
                        }`}>
                          {cat.type}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const nextState = !isHidden;
                          onEditCategory(cat.name, { ...cat, isHiddenFromNewTx: nextState }, false);
                          if (onUpdateHiddenCategoryIds) {
                            const currentIds = hiddenCategoryIds || [];
                            const updatedIds = nextState
                              ? Array.from(new Set([...currentIds, cat.id, cat.name]))
                              : currentIds.filter(id => id !== cat.id && id !== cat.name);
                            onUpdateHiddenCategoryIds(updatedIds);
                          }
                        }}
                        className={`p-1 rounded border transition-colors ${
                          isHidden 
                            ? 'text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20' 
                            : 'text-slate-400 hover:text-slate-100 bg-slate-800/60 hover:bg-slate-800 border-slate-700/60'
                        }`}
                        title={isHidden ? t('common.hidden') : t('common.visible')}
                      >
                        {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => handleOpenEditCategory(cat)}
                        className="p-1 text-slate-400 hover:text-slate-100 bg-slate-800/60 hover:bg-slate-800 rounded border border-slate-700/60 transition-colors"
                        title="Edit Category"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          setDeletingCatName(cat.name);
                          setReassignCatTo(categories.find(c => c.name !== cat.name)?.name || 'General');
                        }}
                        className="p-1 text-rose-400/80 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded border border-rose-500/20 transition-colors"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Associated Txs:</span>
                    <span className="font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {usageCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -------------------- PREFERENCES & DATA SUB-TAB -------------------- */}
      {activeSubTab === 'preferences' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Regional & Language Settings Box */}
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 space-y-4 md:col-span-2 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Notifications</h3>
                <p className="text-xs text-slate-400">Manage alerts and notifications.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={async () => {
                   if (!notificationsEnabled && requestNotificationPermission) {
                     const granted = await requestNotificationPermission();
                     if (granted && onToggleNotifications) onToggleNotifications();
                   } else if (onToggleNotifications) {
                     onToggleNotifications();
                   }
                }}
                className={`w-12 h-6 rounded-full transition-colors ${notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
              <span className="text-xs text-slate-300">Enable automated notifications for anomalies and budget alerts.</span>
            </div>
          </div>

          {/* Regional & Language Settings Box */}
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 space-y-4 md:col-span-2 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">{t('settings.regional')}</h3>
                <p className="text-xs text-slate-400">{t('settings.auto_detect')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">{t('settings.language')}</label>
                <div className="flex items-center bg-[#161b22] p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => {
                      i18n.changeLanguage('en');
                      try {
                        localStorage.setItem('finance_app_language', 'en');
                        localStorage.setItem('i18nextLng', 'en');
                      } catch (e) {}
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      i18n.language.startsWith('en') ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    English (EN)
                  </button>
                  <button
                    onClick={() => {
                      i18n.changeLanguage('es');
                      try {
                        localStorage.setItem('finance_app_language', 'es');
                        localStorage.setItem('i18nextLng', 'es');
                      } catch (e) {}
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      i18n.language.startsWith('es') ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Español (ES)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Timezone Configuration</label>
                  <button
                    type="button"
                    onClick={() => {
                      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                      if (detected && onUpdateTimezone) onUpdateTimezone(detected);
                    }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-semibold cursor-pointer"
                  >
                    Detect Auto
                  </button>
                </div>
                <select
                  value={userTimezone}
                  onChange={(e) => onUpdateTimezone && onUpdateTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#161b22] border border-slate-800 rounded-xl text-xs font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Transaction imports (Ivy CSV & backup) adjust raw timestamps to this selected timezone.
                </p>
              </div>
            </div>
          </div>

          {/* Local Base Currency Setting Box */}
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 space-y-4 md:col-span-2 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400 shrink-0 mt-0.5">
                  <Landmark className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">Local Currency (Base Domestic Currency)</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase tracking-wider font-mono">
                      {CURRENCY_MAP[localCurrency]?.flag} {localCurrency} ({CURRENCY_MAP[localCurrency]?.symbol || '$'})
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-2xl">
                    Your primary domestic base currency (e.g. for local cash, domestic bank accounts, and localized expense reports). Reports calculate dual breakdowns between this local currency and your reporting currency.
                  </p>
                </div>
              </div>

              {onUpdateLocalCurrency && (
                <div className="shrink-0 w-full sm:w-auto">
                  <select
                    value={localCurrency}
                    onChange={(e) => onUpdateLocalCurrency(e.target.value as DisplayCurrency)}
                    className="w-full sm:w-64 px-3.5 py-2.5 bg-[#161b22] border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-sky-500 cursor-pointer shadow-xs"
                  >
                    <optgroup label="Popular Currencies">
                      {WORLD_CURRENCIES.filter(c => c.isPopular).map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} - {i18n.language.startsWith('es') ? c.nameEs : c.name} ({c.symbol})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="All Global Currencies">
                      {WORLD_CURRENCIES.filter(c => !c.isPopular).map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} - {i18n.language.startsWith('es') ? c.nameEs : c.name} ({c.symbol})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Main Reporting Currency Setting Box */}
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 space-y-4 md:col-span-2 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shrink-0 mt-0.5">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">Main Reporting Currency</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider font-mono">
                      {CURRENCY_MAP[displayCurrency]?.flag} {displayCurrency} ({CURRENCY_MAP[displayCurrency]?.symbol || '$'})
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-2xl">
                    Every transaction and expense across all accounts is converted into this main currency for comprehensive financial reports, dashboard run-rates, charts, and cashflow projections.
                  </p>
                </div>
              </div>

              {onUpdateDisplayCurrency && (
                <div className="shrink-0 w-full sm:w-auto">
                  <select
                    value={displayCurrency}
                    onChange={(e) => onUpdateDisplayCurrency(e.target.value as DisplayCurrency)}
                    className="w-full sm:w-64 px-3.5 py-2.5 bg-[#161b22] border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                  >
                    <optgroup label="Popular Currencies">
                      {WORLD_CURRENCIES.filter(c => c.isPopular).map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} - {i18n.language.startsWith('es') ? c.nameEs : c.name} ({c.symbol})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="All Global Currencies">
                      {WORLD_CURRENCIES.filter(c => !c.isPopular).map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} - {i18n.language.startsWith('es') ? c.nameEs : c.name} ({c.symbol})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}
            </div>

            <div className="bg-[#0f131a] p-3 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400/80 shrink-0" />
                <span>Multi-Currency Engine: <strong>{getFxProviderInfo().provider}</strong></span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {getFxProviderInfo().currenciesCount}+ global currencies active
              </span>
            </div>
          </div>

          {/* Transaction Quick-Currencies Selector Box */}
          <div className="bg-[#121720] border border-indigo-500/30 rounded-2xl p-6 space-y-5 md:col-span-2 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 shrink-0 mt-0.5">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">Transaction Quick-Currencies</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider font-mono">
                      {enabledCurrencies.length} Enabled
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-2xl">
                    Configure which currencies appear in the quick selector when logging or editing transactions. Keep it clean with only your active currencies, or add any of the 170+ world currencies you regularly use.
                  </p>
                </div>
              </div>

              {/* Add Currency Selector */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={currencyToAdd}
                  onChange={(e) => {
                    if (e.target.value) handleAddEnabledCurrency(e.target.value);
                  }}
                  className="w-full sm:w-56 px-3 py-2 bg-[#161b22] border border-indigo-500/30 text-indigo-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-400 cursor-pointer"
                >
                  <option value="">+ Add World Currency...</option>
                  <optgroup label="Popular Currencies">
                    {WORLD_CURRENCIES.filter(c => c.isPopular && !enabledCurrencies.includes(c.code)).map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code} - {i18n.language.startsWith('es') ? c.nameEs : c.name} ({c.symbol})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="All Global Currencies">
                    {WORLD_CURRENCIES.filter(c => !c.isPopular && !enabledCurrencies.includes(c.code)).map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code} - {i18n.language.startsWith('es') ? c.nameEs : c.name} ({c.symbol})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Active Currency Badges */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Active Quick-Selector Currencies:</span>
                <span className="text-[11px] text-slate-500">Click &times; to remove</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {enabledCurrencies.map((code) => {
                  const info = CURRENCY_MAP[code];
                  const isLocal = code === localCurrency;
                  const isDisplay = code === displayCurrency;

                  return (
                    <div
                      key={code}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs ${
                        isLocal
                          ? 'bg-sky-500/15 border-sky-500/40 text-sky-200'
                          : isDisplay
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                          : 'bg-[#161b22] border-slate-700 text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-sm">{info?.flag || '🌐'}</span>
                      <span className="font-mono">{code}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({info?.symbol || '$'})
                      </span>
                      {isLocal && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/30 text-sky-300 font-mono">
                          Local
                        </span>
                      )}
                      {isDisplay && !isLocal && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-mono">
                          Report
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveEnabledCurrency(code)}
                        className="ml-1 text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors"
                        title={`Remove ${code} from quick selector`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Quick Preset Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-500 font-medium mr-1">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => handleSetPresetCurrencies(['USD', 'ARS', 'EUR', 'BRL', 'USDT', 'CLP', 'UYU', 'GBP'])}
                  className="px-2.5 py-1 bg-[#161b22] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>Default Set</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPresetCurrencies(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'USDT'])}
                  className="px-2.5 py-1 bg-[#161b22] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-[11px] font-semibold transition-all"
                >
                  Major Global (G10 + USDT)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPresetCurrencies(['ARS', 'USD', 'BRL', 'CLP', 'COP', 'MXN', 'PEN', 'UYU', 'USDT'])}
                  className="px-2.5 py-1 bg-[#161b22] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-[11px] font-semibold transition-all"
                >
                  Latin America (LATAM)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPresetCurrencies(WORLD_CURRENCIES.map(c => c.code))}
                  className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-[11px] font-semibold transition-all"
                >
                  Enable All (170+)
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Tabs Customization Box */}
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 space-y-5 md:col-span-2 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0 mt-0.5">
                  <Sliders className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">{t('navigation_tabs.title')}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider font-mono">
                      {tabList.filter(item => !item.isHidden).length} / {tabList.length} {t('navigation_tabs.visible')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-2xl">
                    {t('navigation_tabs.description')}
                  </p>
                </div>
              </div>

              {/* Reset to defaults button */}
              <button
                type="button"
                onClick={handleResetTabs}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#161b22] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-all self-start sm:self-center cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('navigation_tabs.reset_defaults')}</span>
              </button>
            </div>

            {/* List of tabs with reorder and toggle controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {tabList.map((item, index) => {
                const meta = TAB_META[item.id] || { label: item.id, icon: Sliders };
                const IconComponent = meta.icon;
                const isHidden = !!item.isHidden;
                const isSettings = item.id === 'settings';

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isHidden
                        ? 'bg-[#0e1218]/80 border-slate-800/60 opacity-60'
                        : 'bg-[#161b22] border-slate-800 hover:border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center text-slate-600">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div className={`p-2 rounded-lg border shrink-0 ${
                        isHidden
                          ? 'bg-slate-800/40 border-slate-700/30 text-slate-500'
                          : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                      }`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1.5">
                          <span>{meta.label}</span>
                          {isSettings && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-normal">
                              Locked
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {isHidden ? t('navigation_tabs.hidden') : t('navigation_tabs.visible')} • Pos #{index + 1}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {/* Move Up */}
                      <button
                        type="button"
                        onClick={() => handleMoveTab(index, 'up')}
                        disabled={index === 0}
                        className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700/50 transition-colors cursor-pointer"
                        title={t('navigation_tabs.move_up')}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        onClick={() => handleMoveTab(index, 'down')}
                        disabled={index === tabList.length - 1}
                        className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700/50 transition-colors cursor-pointer"
                        title={t('navigation_tabs.move_down')}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Visibility Toggle */}
                      {!isSettings ? (
                        <button
                          type="button"
                          onClick={() => handleToggleTabVisibility(item.id)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isHidden
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                          title={isHidden ? t('navigation_tabs.show') : t('navigation_tabs.hide')}
                        >
                          {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      ) : (
                        <div className="w-[29px]" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Authentication Status */}
          <div className="bg-[#121720] border border-emerald-500/30 rounded-2xl p-6 space-y-5 md:col-span-2 shadow-lg relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>Google OAuth Authentication</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Your account is managed via Google Single Sign-On.
                  </p>
                </div>
              </div>

              {/* Authentication Status / SSO Action Button */}
              <div>
                {authUser ? (
                  <div className="flex items-center gap-3 bg-[#0f131a] p-2 px-3 rounded-xl border border-emerald-500/30">
                    {authUser.user_metadata?.avatar_url ? (
                      <img src={authUser.user_metadata.avatar_url} alt="Avatar" className="w-7 h-7 rounded-full border border-emerald-500/40" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                        {authUser.email?.[0].toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-emerald-400" />
                        <span>{authUser?.user_metadata?.full_name || authUser?.email || 'User'}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400/90 font-mono">Connected</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      disabled={authLoading}
                      className="ml-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                      title="Sign Out"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleGoogleLogin}
                    disabled={authLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{authLoading ? 'Connecting...' : 'Sign in with Google SSO'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Privacy Mode Shield */}
          <div className="bg-[#121720] border border-amber-500/30 rounded-2xl p-6 space-y-4 md:col-span-2 shadow-lg shadow-amber-950/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0 mt-0.5">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">Privacy Mode Shield</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                      privacyMode
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {privacyMode ? 'Active (Masked)' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-2xl">
                    Mask sensitive financial figures (total account balances, net worth, individual transaction amounts, and budget limits) with placeholder characters (<code className="text-amber-300 font-mono">••••••</code>) when presenting screen or viewing in public places.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onTogglePrivacyMode}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 border ${
                  privacyMode
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-950/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {privacyMode ? (
                  <>
                    <EyeOff className="w-4 h-4 text-slate-950" />
                    <span>Disable Privacy Mask</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 text-amber-400" />
                    <span>Enable Privacy Mask</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-[#0f131a] p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-400/80 shrink-0" />
                <span>Sample masked display preview:</span>
              </span>
              <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-3 py-1 rounded border border-amber-500/20">
                {privacyMode ? '••••••' : '$ 12,450.00 USD'}
              </span>
            </div>
          </div>

          {/* Show/Hide Shared Data Box */}
          <div className="bg-[#121720] border border-purple-500/30 rounded-2xl p-6 space-y-4 md:col-span-2 shadow-lg shadow-purple-950/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 shrink-0 mt-0.5">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">Visibility: Shared Data</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                      showSharedData
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {showSharedData ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-2xl">
                    Control whether transactions and accounts shared by other household members are visible in your instance. When hidden, reports and charts will reflect only your personal (owned) data.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onToggleShowSharedData}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 border ${
                  showSharedData
                    ? 'bg-purple-500 hover:bg-purple-400 text-slate-950 border-purple-400 shadow-md shadow-purple-950/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {showSharedData ? (
                  <>
                    <EyeOff className="w-4 h-4 text-slate-950" />
                    <span>Hide Shared Records</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 text-purple-400" />
                    <span>Show Shared Records</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Exchange Rate Box */}
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">USD / ARS Exchange Rate</h3>
                <p className="text-xs text-slate-400">Set default parallel / MEP exchange rate multiplier for currency conversions.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">$</span>
                <input
                  type="number"
                  value={usdArsRate}
                  onChange={(e) => onUpdateRate(parseFloat(e.target.value) || 1000)}
                  className="w-full pl-7 pr-4 py-2 bg-[#0f131a] border border-slate-700 rounded-xl font-bold text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <span className="text-xs font-semibold text-slate-400">ARS per 1 USD</span>
            </div>
          </div>

          {/* Backup & Import Box */}
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Backup & Restore</h3>
                <p className="text-xs text-slate-400">Export your complete financial records or restore from JSON backup.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Export JSON Backup</span>
              </button>

              <button
                onClick={handleExportIvyCSV}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <Download className="w-4 h-4 text-indigo-400" />
                <span>Ivy Wallet CSV</span>
              </button>

              {onOpenImportModal && (
                <button
                  onClick={onOpenImportModal}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>Import Data</span>
                </button>
              )}
            </div>
          </div>

          {/* Balance Diagnostic Box */}
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Account Balance Diagnostic</h3>
                <p className="text-xs text-slate-400">
                  Verify that the sum of transactions for each account, when added to its initial balance, matches the current calculated balance in the UI.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleVerifyBalances}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  <Activity className="w-4 h-4" />
                  <span>Verify Balances</span>
                </button>

                <button
                  type="button"
                  onClick={handleRecalculateBalancesClick}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Re-calculate All Balances</span>
                </button>
              </div>

              {diagnosticStatus && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-medium transition-all ${
                    diagnosticStatus.discrepancyCount > 0
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-2 mb-1">
                    {diagnosticStatus.discrepancyCount > 0 ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    )}
                    <span>{diagnosticStatus.summaryMessage}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Open your browser console (`F12` or DevTools Console) to inspect line-by-line initial balances, transaction deltas, expected totals, and any detected discrepancies.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------- HOUSEHOLD SHARING SUB-TAB -------------------- */}
      {activeSubTab === 'sharing' && (
        <div className="space-y-6">
          <div className="bg-[#121620] p-6 rounded-2xl border border-slate-800 space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <span>General Household Workspace Sharing</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      isWorkspaceShared 
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {isWorkspaceShared ? 'Active' : 'Private'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Allow partner, spouse, or family members to access and operate over the same full dataset (transactions, bank accounts, budgets, and AI insights).
                  </p>
                </div>
              </div>

              {onOpenShareWorkspaceModal && (
                <button
                  type="button"
                  onClick={onOpenShareWorkspaceModal}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm shrink-0"
                >
                  <Users className="w-4 h-4" />
                  <span>{isWorkspaceShared ? `Manage Workspace Access (${workspaceMembersCount})` : 'Setup General Share'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[#161b22] border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
                  <Globe className="w-4 h-4" />
                  <span>General Share (Full Workspace)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Shares all accounts, transactions, budgets, recurring rules, and reports together. Ideal for married couples, partners, or households operating out of a unified financial pool.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#161b22] border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs">
                  <Wallet className="w-4 h-4" />
                  <span>Per-Account Share</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Allows sharing specific individual accounts (e.g., a single shared credit card or joint checking account) while keeping other personal accounts private. Configured under the Accounts tab.
                </p>
              </div>
            </div>
          </div>

          {/* List of Accounts with Share Status */}
          <div className="bg-[#121620] p-6 rounded-2xl border border-slate-800 space-y-4 shadow-sm">
            <h4 className="text-sm font-bold text-slate-100 flex items-center justify-between">
              <span>Account Sharing Overview ({accounts.length} Total Accounts)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accounts.map(acc => {
                const accShared = acc.isShared || isWorkspaceShared;
                return (
                  <div key={acc.id} className="p-3.5 rounded-xl bg-[#161b22] border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <span>{acc.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({acc.currency})</span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {acc.type.replace('_', ' ')}
                      </p>
                    </div>

                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold flex items-center gap-1 border ${
                      accShared
                        ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400'
                    }`}>
                      <Users className="w-3 h-3" />
                      {accShared ? (isWorkspaceShared ? 'Shared (General)' : `Shared (${acc.sharedMembers?.length || 0})`) : 'Private'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== ADD CATEGORY MODAL ==================== */}
      {isAddCatOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-4 sm:p-6 max-w-md max-w-[calc(100vw-2rem)] w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-400" />
                <span>Add Category</span>
              </h3>
              <button onClick={() => setIsAddCatOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mascotas, Servicios, Viajes"
                  value={catNameInput}
                  onChange={(e) => setCatNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category Type</label>
                <select
                  value={catTypeInput}
                  onChange={(e) => setCatTypeInput(e.target.value as 'EXPENSE' | 'INCOME' | 'BOTH')}
                  className="w-full max-w-full truncate px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="EXPENSE">EXPENSE (Gasto)</option>
                  <option value="INCOME">INCOME (Ingreso)</option>
                  <option value="BOTH">BOTH (Ambos)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCatOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== EDIT CATEGORY MODAL ==================== */}
      {editingCat && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-4 sm:p-6 max-w-md max-w-[calc(100vw-2rem)] w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>Edit Category</span>
              </h3>
              <button onClick={() => setEditingCat(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  value={catNameInput}
                  onChange={(e) => setCatNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category Type</label>
                <select
                  value={catTypeInput}
                  onChange={(e) => setCatTypeInput(e.target.value as 'EXPENSE' | 'INCOME' | 'BOTH')}
                  className="w-full max-w-full truncate px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="EXPENSE">EXPENSE</option>
                  <option value="INCOME">INCOME</option>
                  <option value="BOTH">BOTH</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="catUpdateTxsCheck"
                  checked={catUpdateTxs}
                  onChange={(e) => setCatUpdateTxs(e.target.checked)}
                  className="rounded border-slate-700 bg-[#0f131a] text-indigo-500 focus:ring-0"
                />
                <label htmlFor="catUpdateTxsCheck" className="text-xs text-slate-300 cursor-pointer">
                  Update existing transactions and budgets using "{editingCat.name}" to "{catNameInput}"
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCat(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                >
                  Update Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== DELETE CATEGORY CONFIRMATION ==================== */}
      {deletingCatName && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-4 sm:p-6 max-w-md max-w-[calc(100vw-2rem)] w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Delete Category "{deletingCatName}"?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete this category? There are currently <strong className="text-amber-400">{categoryUsageMap[deletingCatName] || 0} transactions</strong> assigned to this category.
            </p>

            {categoryUsageMap[deletingCatName] > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Reassign existing transactions to:</label>
                <select
                  value={reassignCatTo}
                  onChange={(e) => setReassignCatTo(e.target.value)}
                  className="w-full max-w-full truncate px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none"
                >
                  {categories.filter(c => c.name !== deletingCatName).map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingCatName(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ADD ACCOUNT MODAL ==================== */}
      {isAddAccOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-4 sm:p-6 max-w-md max-w-[calc(100vw-2rem)] w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Add Account</span>
              </h3>
              <button onClick={() => setIsAddAccOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Galicia (ARS), Mastercard Santander"
                  value={accNameInput}
                  onChange={(e) => setAccNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Type</label>
                  <select
                    value={accTypeInput}
                    onChange={(e) => setAccTypeInput(e.target.value as any)}
                    className="w-full max-w-full truncate px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="CHECKING">Checking / Bank</option>
                    <option value="SAVINGS">Savings Account</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="WALLET">Digital Wallet</option>
                    <option value="INVESTMENT">Investment Broker</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Currency</label>
                  <select
                    value={accCurrencyInput}
                    onChange={(e) => setAccCurrencyInput(e.target.value)}
                    className="w-full max-w-full truncate px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <optgroup label="Popular Currencies">
                      {WORLD_CURRENCIES.filter(c => c.isPopular).map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} - {c.name} ({c.symbol})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="All Global Currencies">
                      {WORLD_CURRENCIES.filter(c => !c.isPopular).map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} - {c.name} ({c.symbol})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Initial / Current Balance</label>
                <input
                  type="number"
                  value={accBalanceInput}
                  onChange={(e) => setAccBalanceInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Credit Card Specific Settings */}
              {accTypeInput === 'CREDIT_CARD' && (
                <div className="bg-[#0f131a] p-4 rounded-xl border border-purple-500/30 space-y-3">
                  <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Credit Card Closing Rule</span>
                  </h4>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Rule Type</label>
                    <select
                      value={accRuleTypeInput}
                      onChange={(e) => setAccRuleTypeInput(e.target.value as ClosingRuleType)}
                      className="w-full max-w-full truncate px-2.5 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                    >
                      <option value="FIXED_DAY">Fixed Day of Month (e.g. 25th)</option>
                      <option value="LAST_WEEKDAY">Last Weekday of Month</option>
                      <option value="PREVIOUS_TO_LAST_WEEKDAY">Previous to Last Weekday</option>
                      <option value="NTH_WEEKDAY">Nth Weekday of Month (e.g. 4th Thu)</option>
                    </select>
                  </div>

                  {accRuleTypeInput === 'FIXED_DAY' ? (
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Closing Day (1-31)</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={accFixedDayInput}
                        onChange={(e) => setAccFixedDayInput(parseInt(e.target.value) || 25)}
                        className="w-full px-2.5 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Weekday</label>
                        <select
                          value={accWeekdayInput}
                          onChange={(e) => setAccWeekdayInput(parseInt(e.target.value) ?? 4)}
                          className="w-full max-w-full truncate px-2 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
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
                      {accRuleTypeInput === 'NTH_WEEKDAY' && (
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Nth Occurrence</label>
                          <select
                            value={accNthInput}
                            onChange={(e) => setAccNthInput(parseInt(e.target.value) || 1)}
                            className="w-full max-w-full truncate px-2 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                          >
                            <option value={1}>1st</option>
                            <option value={2}>2nd</option>
                            <option value={3}>3rd</option>
                            <option value={4}>4th</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Due Date (Days after closing)</label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={accDueDaysInput}
                      onChange={(e) => setAccDueDaysInput(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddAccOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== EDIT ACCOUNT MODAL ==================== */}
      {editingAcc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-4 sm:p-6 max-w-md max-w-[calc(100vw-2rem)] w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <span className="truncate">Edit Account "{editingAcc.name}"</span>
              </h3>
              <button onClick={() => setEditingAcc(null)} className="text-slate-400 hover:text-slate-200 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  value={accNameInput}
                  onChange={(e) => setAccNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Type</label>
                  <select
                    value={accTypeInput}
                    onChange={(e) => setAccTypeInput(e.target.value as any)}
                    className="w-full max-w-full truncate px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="CHECKING">Checking / Bank</option>
                    <option value="SAVINGS">Savings Account</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="WALLET">Digital Wallet</option>
                    <option value="INVESTMENT">Investment Broker</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Currency</label>
                  <select
                    value={accCurrencyInput}
                    onChange={(e) => setAccCurrencyInput(e.target.value)}
                    className="w-full max-w-full truncate px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <optgroup label="Popular Currencies">
                      {WORLD_CURRENCIES.filter(c => c.isPopular).map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} - {c.name} ({c.symbol})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="All Global Currencies">
                      {WORLD_CURRENCIES.filter(c => !c.isPopular).map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} - {c.name} ({c.symbol})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Current Balance</label>
                <input
                  type="number"
                  value={accBalanceInput}
                  onChange={(e) => setAccBalanceInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Credit Card Settings */}
              {accTypeInput === 'CREDIT_CARD' && (
                <div className="bg-[#0f131a] p-4 rounded-xl border border-purple-500/30 space-y-3">
                  <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Credit Card Closing Rule</span>
                  </h4>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Rule Type</label>
                    <select
                      value={accRuleTypeInput}
                      onChange={(e) => setAccRuleTypeInput(e.target.value as ClosingRuleType)}
                      className="w-full max-w-full truncate px-2.5 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                    >
                      <option value="FIXED_DAY">Fixed Day of Month (e.g. 25th)</option>
                      <option value="LAST_WEEKDAY">Last Weekday of Month</option>
                      <option value="PREVIOUS_TO_LAST_WEEKDAY">Previous to Last Weekday</option>
                      <option value="NTH_WEEKDAY">Nth Weekday of Month (e.g. 4th Thu)</option>
                    </select>
                  </div>

                  {accRuleTypeInput === 'FIXED_DAY' ? (
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Closing Day (1-31)</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={accFixedDayInput}
                        onChange={(e) => setAccFixedDayInput(parseInt(e.target.value) || 25)}
                        className="w-full px-2.5 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Weekday</label>
                        <select
                          value={accWeekdayInput}
                          onChange={(e) => setAccWeekdayInput(parseInt(e.target.value) ?? 4)}
                          className="w-full max-w-full truncate px-2 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
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
                      {accRuleTypeInput === 'NTH_WEEKDAY' && (
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Nth Occurrence</label>
                          <select
                            value={accNthInput}
                            onChange={(e) => setAccNthInput(parseInt(e.target.value) || 1)}
                            className="w-full max-w-full truncate px-2 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                          >
                            <option value={1}>1st</option>
                            <option value={2}>2nd</option>
                            <option value={3}>3rd</option>
                            <option value={4}>4th</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Due Date (Days after closing)</label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={accDueDaysInput}
                      onChange={(e) => setAccDueDaysInput(parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="accUpdateTxsCheck"
                  checked={accUpdateTxs}
                  onChange={(e) => setAccUpdateTxs(e.target.checked)}
                  className="rounded border-slate-700 bg-[#0f131a] text-emerald-500 focus:ring-0"
                />
                <label htmlFor="accUpdateTxsCheck" className="text-xs text-slate-300 cursor-pointer">
                  Update existing transactions under "{editingAcc.name}" to "{accNameInput}"
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAcc(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                >
                  Update Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== DELETE ACCOUNT CONFIRMATION ==================== */}
      {deletingAccName && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-4 sm:p-6 max-w-md max-w-[calc(100vw-2rem)] w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100 truncate">Delete Account "{deletingAccName}"?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete this account? There are currently <strong className="text-amber-400">{accountUsageMap[deletingAccName] || 0} transactions</strong> associated with this account.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingAccName(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
