import React, { useState, useMemo, useEffect } from 'react';
import { 
  CategoryItem, 
  AccountItem, 
  Transaction, 
  BudgetGoal, 
  CreditCardClosingRule, 
  ClosingRuleType, 
  DisplayCurrency 
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
  ExternalLink
} from 'lucide-react';
import { 
  getSupabaseCredentials, 
  getSupabaseClient, 
  isSupabaseConfigured, 
  saveCustomSupabaseCredentials, 
  signInWithGoogle, 
  signOutFromSupabase 
} from '../lib/supabase';

interface SettingsTabProps {
  authUser: any;
  authLoading: boolean;
  categories: CategoryItem[];
  accounts: AccountItem[];
  transactions: Transaction[];
  budgets: BudgetGoal[];
  usdArsRate: number;
  onUpdateRate: (rate: number) => void;
  onAddCategory: (category: CategoryItem) => void;
  onEditCategory: (oldName: string, updatedCategory: CategoryItem, updateTransactions: boolean) => void;
  onDeleteCategory: (categoryName: string, reassignTo?: string) => void;
  onAddAccount: (account: AccountItem) => void;
  onEditAccount: (oldName: string, updatedAccount: AccountItem, updateTransactions: boolean) => void;
  onDeleteAccount: (accountName: string) => void;
  onResetData: () => void;
  onImportBackup?: (data: { transactions: Transaction[]; categories: CategoryItem[]; accounts: AccountItem[]; budgets: BudgetGoal[] }) => void;
  onLogout: () => void;
}

export function SettingsTab({
  authUser,
  authLoading,
  categories,
  accounts,
  transactions,
  budgets,
  usdArsRate,
  onUpdateRate,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onResetData,
  onImportBackup,
  onLogout,
}: SettingsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'categories' | 'preferences'>('accounts');

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
  const [accCurrencyInput, setAccCurrencyInput] = useState<'ARS' | 'USD'>('ARS');
  const [accBalanceInput, setAccBalanceInput] = useState<string>('0');
  const [accRuleTypeInput, setAccRuleTypeInput] = useState<ClosingRuleType>('FIXED_DAY');
  const [accFixedDayInput, setAccFixedDayInput] = useState<number>(25);
  const [accWeekdayInput, setAccWeekdayInput] = useState<number>(4); // Thursday
  const [accNthInput, setAccNthInput] = useState<number>(4); // 4th
  const [accDueDaysInput, setAccDueDaysInput] = useState<number>(10);
  const [accUpdateTxs, setAccUpdateTxs] = useState(true);

  const [deletingAccName, setDeletingAccName] = useState<string | null>(null);

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
    setAccDueDaysInput(10);
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
        closingRule = { ruleType: accRuleTypeInput, dueDaysAfterClose: accDueDaysInput };
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
      setAccDueDaysInput(acc.closingRule.dueDaysAfterClose || 10);
    } else {
      setAccRuleTypeInput('FIXED_DAY');
      setAccFixedDayInput(25);
      setAccWeekdayInput(4);
      setAccNthInput(4);
      setAccDueDaysInput(10);
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
        closingRule = { ruleType: accRuleTypeInput, dueDaysAfterClose: accDueDaysInput };
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

  // --- Export JSON Backup ---
  const handleExportData = () => {
    const exportObject = {
      app: 'Finlev',
      exportDate: new Date().toISOString(),
      categories,
      accounts,
      transactions,
      budgets,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `finlev_backup_${new Date().toISOString().substring(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // --- Import JSON Backup ---
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportBackup) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && (json.transactions || json.accounts || json.categories)) {
          onImportBackup({
            transactions: json.transactions || [],
            categories: json.categories || [],
            accounts: json.accounts || [],
            budgets: json.budgets || [],
          });
          alert('Backup data imported successfully!');
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        alert('Failed to parse backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121720] p-6 rounded-2xl border border-slate-800/80 shadow-md">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-emerald-400" />
            <span>Settings & Master Data</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure accounts, custom income/expense categories, exchange rates, and data preferences.
          </p>
        </div>

        {/* Sub Navigation */}
        <div className="flex bg-[#0f131a] p-1.5 rounded-xl border border-slate-800 gap-1 self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab('accounts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'accounts'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>Accounts ({accounts.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('categories')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'categories'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Tag className="w-4 h-4 text-indigo-400" />
            <span>Categories ({categories.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('preferences')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'preferences'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Preferences & Data</span>
          </button>
        </div>
      </div>

      {/* -------------------- ACCOUNTS SUB-TAB -------------------- */}
      {activeSubTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-200">Financial Accounts</h3>
              <p className="text-xs text-slate-400">Manage bank checking accounts, credit cards, investments, and digital wallets.</p>
            </div>
            <button
              onClick={handleOpenAddAccount}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Account</span>
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
                          <h4 className="text-sm font-bold text-slate-100">{acc.name}</h4>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {acc.type.replace('_', ' ')} • {acc.currency}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditAccount(acc)}
                          className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/60 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors"
                          title="Edit Account"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingAccName(acc.name)}
                          className="p-1.5 text-rose-400/80 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/20 transition-colors"
                          title="Delete Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isCC && acc.closingRule && (
                      <div className="bg-[#0f131a] p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1">
                        <div className="text-slate-400 font-semibold flex items-center justify-between">
                          <span>Statement Closing Rule:</span>
                          <span className="text-purple-400 font-bold">{acc.closingRule.ruleType}</span>
                        </div>
                        {acc.closingRule.ruleType === 'FIXED_DAY' && (
                          <p className="text-slate-300">Closes on day <strong className="text-white">{acc.closingRule.fixedDay || 25}</strong> of each month.</p>
                        )}
                        {acc.closingRule.ruleType === 'NTH_WEEKDAY' && (
                          <p className="text-slate-300">Closes on the nth weekday of the month.</p>
                        )}
                        {acc.closingRule.ruleType === 'LAST_WEEKDAY' && (
                          <p className="text-slate-300">Closes on the last weekday of the month.</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Usage in Transactions:</span>
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

              return (
                <div 
                  key={cat.id}
                  className="bg-[#121720] border border-slate-800/90 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-all"
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

              {onImportBackup && (
                <label className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>Import JSON Backup</span>
                  <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Reset System Data */}
          <div className="bg-[#121720] border border-rose-950/40 rounded-2xl p-6 space-y-4 md:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Reset Application State</h3>
                  <p className="text-xs text-slate-400">Restore default transactions, initial budgets, categories, and account settings.</p>
                </div>
              </div>

              <button
                onClick={onResetData}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset to Sample Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ADD CATEGORY MODAL ==================== */}
      {isAddCatOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
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
                  className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
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
                  className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
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
                  className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Type</label>
                  <select
                    value={accTypeInput}
                    onChange={(e) => setAccTypeInput(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500"
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
                    onChange={(e) => setAccCurrencyInput(e.target.value as 'ARS' | 'USD')}
                    className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ARS">ARS ($)</option>
                    <option value="USD">USD ($)</option>
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
                      className="w-full px-2.5 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                    >
                      <option value="FIXED_DAY">Fixed Day of Month (e.g. 25th)</option>
                      <option value="LAST_WEEKDAY">Last Weekday of Month</option>
                      <option value="PREVIOUS_TO_LAST_WEEKDAY">Previous to Last Weekday of Month</option>
                      <option value="NTH_WEEKDAY">Nth Weekday of Month (e.g. 4th Thursday)</option>
                    </select>
                  </div>

                  {accRuleTypeInput === 'FIXED_DAY' && (
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
                  )}

                  {accRuleTypeInput === 'NTH_WEEKDAY' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Nth Occurrence</label>
                        <select
                          value={accNthInput}
                          onChange={(e) => setAccNthInput(parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                        >
                          <option value={1}>1st</option>
                          <option value={2}>2nd</option>
                          <option value={3}>3rd</option>
                          <option value={4}>4th</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Weekday</label>
                        <select
                          value={accWeekdayInput}
                          onChange={(e) => setAccWeekdayInput(parseInt(e.target.value) || 4)}
                          className="w-full px-2 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                        >
                          <option value={1}>Monday</option>
                          <option value={2}>Tuesday</option>
                          <option value={3}>Wednesday</option>
                          <option value={4}>Thursday</option>
                          <option value={5}>Friday</option>
                        </select>
                      </div>
                    </div>
                  )}
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <span>Edit Account "{editingAcc.name}"</span>
              </h3>
              <button onClick={() => setEditingAcc(null)} className="text-slate-400 hover:text-slate-200">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Type</label>
                  <select
                    value={accTypeInput}
                    onChange={(e) => setAccTypeInput(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500"
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
                    onChange={(e) => setAccCurrencyInput(e.target.value as 'ARS' | 'USD')}
                    className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ARS">ARS ($)</option>
                    <option value="USD">USD ($)</option>
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
                      className="w-full px-2.5 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                    >
                      <option value="FIXED_DAY">Fixed Day of Month (e.g. 25th)</option>
                      <option value="LAST_WEEKDAY">Last Weekday of Month</option>
                      <option value="PREVIOUS_TO_LAST_WEEKDAY">Previous to Last Weekday of Month</option>
                      <option value="NTH_WEEKDAY">Nth Weekday of Month (e.g. 4th Thursday)</option>
                    </select>
                  </div>

                  {accRuleTypeInput === 'FIXED_DAY' && (
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
                  )}

                  {accRuleTypeInput === 'NTH_WEEKDAY' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Nth Occurrence</label>
                        <select
                          value={accNthInput}
                          onChange={(e) => setAccNthInput(parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                        >
                          <option value={1}>1st</option>
                          <option value={2}>2nd</option>
                          <option value={3}>3rd</option>
                          <option value={4}>4th</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Weekday</label>
                        <select
                          value={accWeekdayInput}
                          onChange={(e) => setAccWeekdayInput(parseInt(e.target.value) || 4)}
                          className="w-full px-2 py-1.5 bg-[#121720] border border-slate-700 rounded-lg text-xs font-semibold text-slate-100"
                        >
                          <option value={1}>Monday</option>
                          <option value={2}>Tuesday</option>
                          <option value={3}>Wednesday</option>
                          <option value={4}>Thursday</option>
                          <option value={5}>Friday</option>
                        </select>
                      </div>
                    </div>
                  )}
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121720] border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Delete Account "{deletingAccName}"?</h3>
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
