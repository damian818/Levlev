/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ViewTab, DisplayCurrency, Transaction, BudgetGoal, AccountCustomBalance, TransactionFilter, InflationPoint, CategoryItem, AccountItem } from './types';
import { Loader2, Heart, ShieldCheck, TrendingUp, Wallet, Sparkles, Globe, ArrowRight, Lock, CheckCircle2, DollarSign } from 'lucide-react';
import { parseTransactions, historicalInflationAndFX, defaultCategoryItems, defaultAccountItems } from './data/defaultTransactions';
import { deriveBudgetsFromTransactions, getGlobalPrivacyMode, setGlobalPrivacyMode, recalculateAccountBalancesFromTransactions } from './utils/financeUtils';
import { getSupabaseClient, signInWithGoogle, signOutFromSupabase } from './lib/supabase';
import { fetchUserDataFromSupabase, saveAllUserDataToSupabase, deleteAllUserDataFromSupabase, deleteTransactionFromSupabase, deleteCategoryFromSupabase, deleteAccountFromSupabase } from './services/supabaseSync';
import { Navbar } from './components/Navbar';
import { OverviewTab } from './components/OverviewTab';
import { ReportsTab } from './components/ReportsTab';
import { TransactionsTab } from './components/TransactionsTab';
import { AccountsTab } from './components/AccountsTab';
import { BudgetTab } from './components/BudgetTab';
import { RecurringTab } from './components/RecurringTab';
import { InflationVsFxTab } from './components/InflationVsFxTab';
import { AiAdvisorTab } from './components/AiAdvisorTab';
import { SettingsTab } from './components/SettingsTab';
import { AddTransactionModal } from './components/AddTransactionModal';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { AiChatWidget } from './components/AiChatWidget';
import { AppPreview } from './components/AppPreview';
import { LevLevIcon } from './components/LevLevLogo';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const isCleared = localStorage.getItem('finance_app_is_cleared');
      if (isCleared === 'true') {
        return [];
      }
      const saved = localStorage.getItem('finance_app_transactions');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load transactions from localStorage', e);
    }
    return [];
  });

  const [budgets, setBudgets] = useState<BudgetGoal[]>(() => {
    try {
      const isCleared = localStorage.getItem('finance_app_is_cleared');
      if (isCleared === 'true') {
        return [];
      }
      const saved = localStorage.getItem('finance_app_budgets');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load budgets from localStorage', e);
    }
    return [];
  });

  // Custom categories list state
  const [categories, setCategories] = useState<CategoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('finance_app_custom_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load custom categories from localStorage');
    }
    return defaultCategoryItems;
  });

  // Custom accounts list state
  const [accounts, setAccounts] = useState<AccountItem[]>(() => {
    try {
      const saved = localStorage.getItem('finance_app_custom_accounts');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load custom accounts from localStorage');
    }
    return defaultAccountItems;
  });

  // Sync custom categories to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('finance_app_custom_categories', JSON.stringify(categories));
    } catch (e) {
      console.warn('Failed to save custom categories to localStorage');
    }
  }, [categories]);

  // Sync custom accounts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('finance_app_custom_accounts', JSON.stringify(accounts));
    } catch (e) {
      console.warn('Failed to save custom accounts to localStorage');
    }
  }, [accounts]);

  // Category Handlers
  const handleAddCategory = (newCat: CategoryItem) => {
    setCategories(prev => [...prev, newCat]);
  };

  const handleEditCategory = (oldName: string, updatedCat: CategoryItem, updateTransactions: boolean) => {
    setCategories(prev => prev.map(c => c.name === oldName ? updatedCat : c));

    if (updateTransactions && oldName !== updatedCat.name) {
      setTransactions(prev => prev.map(t => t.category === oldName ? { ...t, category: updatedCat.name } : t));
      setBudgets(prev => prev.map(b => b.category === oldName ? { ...b, category: updatedCat.name } : b));
    }
  };

  const handleDeleteCategory = (catName: string, reassignTo?: string) => {
    setCategories(prev => prev.filter(c => c.name !== catName));
    setBudgets(prev => prev.filter(b => b.category !== catName));

    if (reassignTo) {
      setTransactions(prev => prev.map(t => t.category === catName ? { ...t, category: reassignTo } : t));
    }
    deleteCategoryFromSupabase(catName);
  };

  // Account Handlers
  const handleAddAccount = (newAcc: AccountItem) => {
    setAccounts(prev => [...prev, newAcc]);
    if (newAcc.initialBalance !== undefined) {
      handleUpdateAccountBalance(newAcc.name, newAcc.initialBalance, newAcc.currency);
    }
  };

  const handleEditAccount = (oldName: string, updatedAcc: AccountItem, updateTransactions: boolean) => {
    setAccounts(prev => prev.map(a => a.name === oldName ? updatedAcc : a));

    if (updatedAcc.initialBalance !== undefined) {
      handleUpdateAccountBalance(updatedAcc.name, updatedAcc.initialBalance, updatedAcc.currency);
    }

    if (updateTransactions && oldName !== updatedAcc.name) {
      setTransactions(prev => prev.map(t => {
        let updated = { ...t };
        if (t.account === oldName) updated.account = updatedAcc.name;
        if (t.toAccount === oldName) updated.toAccount = updatedAcc.name;
        return updated;
      }));
    }
  };

  const handleDeleteAccount = (accName: string) => {
    setAccounts(prev => prev.filter(a => a.name !== accName));
    deleteAccountFromSupabase(accName);
  };

  const handleImportBackup = (data: { transactions: Transaction[]; categories: CategoryItem[]; accounts: AccountItem[]; budgets: BudgetGoal[] }) => {
    if (data.transactions) setTransactions(data.transactions);
    if (data.categories) setCategories(data.categories);
    if (data.accounts) setAccounts(data.accounts);
    if (data.budgets) setBudgets(data.budgets);
  };

  const [currentTab, setCurrentTab] = useState<ViewTab>('overview');
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('ARS');
  const [usdArsRate, setUsdArsRate] = useState<number>(1521);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<InflationPoint[]>(historicalInflationAndFX);

  // Sync transactions to localStorage on update
  useEffect(() => {
    try {
      if (transactions.length > 0) {
        localStorage.removeItem('finance_app_is_cleared');
      }
      localStorage.setItem('finance_app_transactions', JSON.stringify(transactions));
    } catch (e) {
      console.warn('Failed to save transactions to localStorage', e);
    }
  }, [transactions]);

  // Privacy Mode State
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => {
    return getGlobalPrivacyMode();
  });

  const handleTogglePrivacyMode = () => {
    setPrivacyMode(prev => {
      const next = !prev;
      setGlobalPrivacyMode(next);
      return next;
    });
  };

  // Auth State
  const [authUser, setAuthUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [authError, setAuthError] = useState<string | null>(null);

  // Sync Supabase user data
  const syncFromSupabase = React.useCallback(async () => {
    try {
      const data = await fetchUserDataFromSupabase();
      if (data) {
        setTransactions(data.transactions || []);
        if (data.categories && data.categories.length > 0) setCategories(data.categories);
        if (data.accounts && data.accounts.length > 0) setAccounts(data.accounts);
        setBudgets(data.budgets || []);
      }
    } catch (err) {
      console.warn('Failed to fetch user data from Supabase:', err);
    }
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();

    if (!client) {
      setAuthLoading(false);
      return;
    }

    let isMounted = true;

    async function initSession() {
      try {
        const { data: { session }, error } = await client.auth.getSession();
        if (error) {
          console.warn('Supabase getSession error:', error.message);
          if (isMounted) setAuthError(error.message);
        }
        if (isMounted) {
          setAuthUser(session?.user || null);
          if (session?.user) {
            await syncFromSupabase();
          }
        }
      } catch (err: any) {
        console.warn('Auth init error:', err);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
          // Clean hash after session is processed
          if (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('error'))) {
            setTimeout(() => {
              window.history.replaceState(null, '', window.location.pathname);
            }, 300);
          }
        }
      }
    }

    initSession();

    const { data: { subscription } } = client.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setAuthUser(session?.user || null);
      if (session?.user) {
        try {
          await syncFromSupabase();
        } catch (e) {
          console.warn('Sync error on auth state change:', e);
        }
      }
      setAuthLoading(false);
      if (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('error'))) {
        setTimeout(() => {
          window.history.replaceState(null, '', window.location.pathname);
        }, 300);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [syncFromSupabase]);

  // Sync budgets to localStorage on update
  useEffect(() => {
    try {
      localStorage.setItem('finance_app_budgets', JSON.stringify(budgets));
    } catch (e) {
      console.warn('Failed to save budgets to localStorage', e);
    }
  }, [budgets]);

  // Active filter for drill-down navigation
  const [activeFilter, setActiveFilter] = useState<TransactionFilter | undefined>(undefined);

  // User-configured actual live account balances (persisted in localStorage)
  const [customBalances, setCustomBalances] = useState<Record<string, AccountCustomBalance>>(() => {
    try {
      const saved = localStorage.getItem('finance_app_account_balances');
      if (saved !== null) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load custom balances from localStorage');
    }
    return {};
  });

  // Credit card manual period status overrides
  const [periodStatusOverrides, setPeriodStatusOverrides] = useState<Record<string, 'PAID' | 'OPEN'>>(() => {
    try {
      const saved = localStorage.getItem('finance_app_cc_period_statuses');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load credit card period status overrides from localStorage');
    }
    return {};
  });

  const handleUpdatePeriodStatus = (accountName: string, closeDate: string, status?: 'PAID' | 'OPEN') => {
    setPeriodStatusOverrides(prev => {
      const key = `${accountName}|${closeDate}`;
      const updated = { ...prev };
      if (status) {
        updated[key] = status;
      } else {
        delete updated[key];
      }
      try {
        localStorage.setItem('finance_app_cc_period_statuses', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save credit card period status overrides to localStorage');
      }
      return updated;
    });
  };

  const handleReassignTransactionPeriod = (txId: string, statementCloseDate: string | undefined) => {
    setTransactions(prev => prev.map(t => {
      if (t.id === txId) {
        return {
          ...t,
          statementCloseDate: statementCloseDate === '' ? undefined : statementCloseDate
        };
      }
      return t;
    }));
  };

  useEffect(() => {
    // Fetch live FX rates on app mount
    fetch('/api/fx-rates')
      .then(res => res.json())
      .then(data => {
        if (data.rates) {
          const liveMep = data.rates.bolsa?.sell || data.rates.blue?.sell || data.rates.oficial?.sell;
          if (liveMep && liveMep > 0) {
            setUsdArsRate(liveMep);
          }
        }
      })
      .catch(err => console.warn('Using default exchange rate fallback:', err));

    // Fetch historical inflation and FX history
    const oldestDate = transactions.length > 0
      ? new Date(Math.min(...transactions.map(t => new Date(t.date).getTime())))
      : new Date('2024-01-01');
    const startDate = oldestDate.toISOString().substring(0, 10);
    
    fetch(`/api/inflation-fx-history?startDate=${startDate}`)
      .then(res => res.json())
      .then(data => {
        if (data.points && data.points.length > 0) {
          setHistoryData(data.points);
        }
      })
      .catch(err => console.warn('Using default historical data fallback:', err));
  }, []);

  // Save changes to Supabase when user is authenticated
  useEffect(() => {
    if (!authUser) return;
    const timer = setTimeout(() => {
      saveAllUserDataToSupabase({ transactions, categories, accounts, budgets });
    }, 1000);
    return () => clearTimeout(timer);
  }, [transactions, categories, accounts, budgets, authUser]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex flex-col items-center justify-center text-slate-400 p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-rose-500/20 to-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-lg shadow-emerald-950/40">
          <LevLevIcon className="w-6 h-6" variant="emerald" />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mb-2" />
        <p className="font-bold text-slate-200 text-sm">Loading LevLev...</p>
        <p className="text-xs text-slate-500 mt-1">Personal finance with heart</p>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] text-slate-100 flex flex-col justify-between selection:bg-rose-500 selection:text-white">
        {/* Navigation Header */}
        <header className="border-b border-slate-800/80 bg-[#0f131a]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 via-rose-500/20 to-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/40">
                <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight leading-none flex items-center gap-1.5">
                  LevLev
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    GLOBAL
                  </span>
                </h1>
                <p className="text-[10px] text-slate-400 font-medium">Personal Finance with Heart</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  setAuthError(null);
                  const { error } = await signInWithGoogle();
                  if (error) setAuthError(error.message || 'Login failed');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 active:scale-95"
              >
                Sign In <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Hero & Features Body */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 flex-1 flex flex-col items-center justify-center text-center">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold mb-6 shadow-inner">
            <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
            <span>Multi-Currency &amp; Inflation Intelligence Engine</span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-3xl leading-[1.15] mb-6">
            Master your net worth with <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-rose-400 bg-clip-text text-transparent">clarity &amp; heart</span>
          </h2>

          {/* Subheadline */}
          <p className="text-slate-400 text-sm sm:text-lg max-w-2xl mb-10 leading-relaxed font-normal">
            Track multi-currency accounts in ARS &amp; USD, monitor live MEP exchange rates, evaluate real inflation purchasing power, and manage installments effortlessly.
          </p>

          {/* Auth Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mb-6">
            <button
              onClick={async () => {
                setAuthError(null);
                const { error } = await signInWithGoogle();
                if (error) setAuthError(error.message || 'Login failed');
              }}
              className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-900/30 transition-all active:scale-95 flex items-center justify-center gap-2.5 text-base sm:text-lg w-full"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>

          {authError && (
            <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs max-w-md text-left">
              <strong className="block font-semibold mb-0.5">Authentication Note:</strong>
              {authError}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-500 mb-16">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Private &amp; Secure. Your data is encrypted and accessible only by you.</span>
          </div>

          <AppPreview />

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 w-full text-left">
            <div className="bg-[#11151f] border border-slate-800/90 rounded-2xl p-5 hover:border-emerald-500/40 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="text-slate-100 font-bold text-sm mb-1.5">Multi-Currency ARS/USD</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Live MEP, Blue &amp; Official rates automatically convert balances across accounts like Deel, DollarApp, and local banks.
              </p>
            </div>

            <div className="bg-[#11151f] border border-slate-800/90 rounded-2xl p-5 hover:border-rose-500/40 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-slate-100 font-bold text-sm mb-1.5">Inflation Adjustment</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Historical INDEC/IPC inflation tracking reveals your real purchasing power adjusted for economic fluctuations.
              </p>
            </div>

            <div className="bg-[#11151f] border border-slate-800/90 rounded-2xl p-5 hover:border-teal-500/40 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-slate-100 font-bold text-sm mb-1.5">Cuotas &amp; Closing Dates</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Track installment periods, credit card statement closing dates, and settled balances with zero confusion.
              </p>
            </div>

            <div className="bg-[#11151f] border border-slate-800/90 rounded-2xl p-5 hover:border-amber-500/40 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-slate-100 font-bold text-sm mb-1.5">AI Financial Companion</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Contextual AI assistant analyzes trends, compares category spikes, and guides your monthly budget targets.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/60 py-6 bg-[#0f131a]/60 text-center text-xs text-slate-500">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />
              <span className="font-bold text-slate-300">LevLev</span>
              <span>— Personal Finance with Heart</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Multi-currency intelligence tracker for ARS &amp; USD
            </p>
          </div>
        </footer>
      </div>
    );
  }

  const handleUpdateAccountBalance = (accountName: string, currentBalance: number | undefined, currency: string) => {
    setCustomBalances(prev => {
      const updated = { ...prev };
      if (currentBalance === undefined) {
        delete updated[accountName];
      } else {
        updated[accountName] = { accountName, currentBalance, currency };
      }
      try {
        localStorage.setItem('finance_app_account_balances', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save balances to localStorage');
      }
      return updated;
    });
  };

  const handleRecalculateAllBalances = () => {
    setCustomBalances({});
    try {
      localStorage.removeItem('finance_app_account_balances');
    } catch (e) {
      console.warn('Failed to clear custom balances in localStorage');
    }
  };

  const handleNavigateToTransactionsWithFilter = (filter: TransactionFilter) => {
    setActiveFilter(filter);
    setCurrentTab('transactions');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const textReader = new FileReader();
    textReader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const uploadedTx = parseTransactions(text);
        if (uploadedTx.length > 0) {
          setTransactions(prev => {
            const getSig = (t: Transaction) => {
              const d = t.date ? t.date.substring(0, 10) : '';
              const title = (t.title || '').trim().toLowerCase();
              const amt = Number(t.amount || t.transferAmount || 0);
              const acc = (t.account || '').trim().toLowerCase();
              const toAcc = (t.toAccount || '').trim().toLowerCase();
              const curr = (t.currency || '').trim().toUpperCase();
              return `${d}|${title}|${amt}|${acc}|${toAcc}|${curr}`;
            };

            const existingSigs = new Set(prev.map(getSig));
            const newTxs = uploadedTx.filter(t => !existingSigs.has(getSig(t)));

            // If prev is empty, use uploadedTx. Otherwise add newTxs to prev if any exist
            const combined = prev.length === 0 ? uploadedTx : (newTxs.length > 0 ? [...newTxs, ...prev] : prev);
            const sorted = [...combined].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            // Derive budget goals from the updated combined list
            const derived = deriveBudgetsFromTransactions(sorted, budgets);
            setBudgets(derived);
            
            return sorted;
          });
          
            // Register any newly encountered accounts into custom accounts list
            setAccounts(prevAccs => {
              const existingNames = new Set(prevAccs.map(a => a.name));
              const newAccs: AccountItem[] = [];
              uploadedTx.forEach(t => {
                if (t.account && !existingNames.has(t.account)) {
                  existingNames.add(t.account);
                  const isUsd = t.account.toLowerCase().includes('usd') || (t.type === 'TRANSFER' && t.transferCurrency === 'USD');
                  const isCC = t.account.toLowerCase().includes('card') || t.account.toLowerCase().includes('visa') || t.account.toLowerCase().includes('master');
                  newAccs.push({
                    id: `acc-${Math.random().toString(36).substring(2)}`,
                    name: t.account,
                    type: isCC ? 'CREDIT_CARD' : (t.account.toLowerCase().includes('wallet') ? 'WALLET' : 'CHECKING'),
                    currency: (t.type === 'TRANSFER' && t.transferCurrency) ? t.transferCurrency : (t.currency || (isUsd ? 'USD' : 'ARS')),
                    initialBalance: 0,
                  });
                }
                if (t.toAccount && !existingNames.has(t.toAccount)) {
                  existingNames.add(t.toAccount);
                  const isUsd = t.toAccount.toLowerCase().includes('usd') || t.receiveCurrency === 'USD';
                  const isCC = t.toAccount.toLowerCase().includes('card') || t.toAccount.toLowerCase().includes('visa') || t.toAccount.toLowerCase().includes('master');
                  newAccs.push({
                    id: `acc-${Math.random().toString(36).substring(2)}`,
                    name: t.toAccount,
                    type: isCC ? 'CREDIT_CARD' : (t.toAccount.toLowerCase().includes('wallet') ? 'WALLET' : 'CHECKING'),
                    currency: t.receiveCurrency || (isUsd ? 'USD' : 'ARS'),
                    initialBalance: 0,
                  });
                }
              });
              return newAccs.length > 0 ? [...prevAccs, ...newAccs] : prevAccs;
            });

            setCustomBalances({});
            try {
              localStorage.removeItem('finance_app_account_balances');
              localStorage.removeItem('finance_app_is_cleared');
            } catch (e) {}

            setCurrentTab('overview');
        }
      }
    };
    textReader.readAsText(file);
    e.target.value = '';
  };

  const handleDeleteAllData = async () => {
    localStorage.setItem('finance_app_is_cleared', 'true');
    localStorage.setItem('finance_app_transactions', JSON.stringify([]));
    localStorage.setItem('finance_app_budgets', JSON.stringify([]));
    localStorage.setItem('finance_app_custom_accounts', JSON.stringify([]));
    localStorage.setItem('finance_app_account_balances', JSON.stringify({}));

    setAccounts([]);
    setCustomBalances({});
    setTransactions([]);
    setBudgets([]);
    setActiveFilter(undefined);

    try {
      await deleteAllUserDataFromSupabase();
      await saveAllUserDataToSupabase({
        transactions: [],
        categories,
        accounts: [],
        budgets: [],
      });
    } catch (e) {
      console.warn('Failed to delete user data from Supabase:', e);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    deleteTransactionFromSupabase(id);
  };

  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions(prev => [newTx, ...prev]);
  };

  const handleLogout = async () => {
    try {
      await signOutFromSupabase();
    } catch (e) {
      console.warn('Sign out error:', e);
    }
    setAuthUser(null);
    setTransactions([]);
    setBudgets([]);
    localStorage.removeItem('levlev_guest_mode');
    localStorage.removeItem('finlev_guest_mode');
    localStorage.removeItem('finance_app_transactions');
    localStorage.removeItem('finance_app_budgets');
    localStorage.removeItem('finance_app_is_cleared');
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-slate-100 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        setTab={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'transactions') setActiveFilter(undefined);
        }}
        displayCurrency={displayCurrency}
        setDisplayCurrency={setDisplayCurrency}
        usdArsRate={usdArsRate}
        setUsdArsRate={setUsdArsRate}
        privacyMode={privacyMode}
        onTogglePrivacyMode={handleTogglePrivacyMode}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onFileUpload={handleFileUpload}
        onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'overview' && (
          <OverviewTab
            transactions={transactions}
            displayCurrency={displayCurrency}
            usdArsRate={usdArsRate}
            historyData={historyData}
            recurringRules={[]}
            customBalances={customBalances}
            onNavigateTab={setCurrentTab}
            onNavigateToTransactionsWithFilter={handleNavigateToTransactionsWithFilter}
          />
        )}
        {currentTab === 'transactions' && (
          <TransactionsTab
            transactions={transactions}
            displayCurrency={displayCurrency}
            usdArsRate={usdArsRate}
            historyData={historyData}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
            activeFilter={activeFilter}
            onClearFilter={() => setActiveFilter(undefined)}
          />
        )}
        {currentTab === 'accounts' && (
          <AccountsTab
            transactions={transactions}
            displayCurrency={displayCurrency}
            usdArsRate={usdArsRate}
            customBalances={customBalances}
            accounts={accounts}
            periodStatusOverrides={periodStatusOverrides}
            onUpdatePeriodStatus={handleUpdatePeriodStatus}
            onUpdateAccountBalance={handleUpdateAccountBalance}
            onNavigateToTransactionsWithFilter={handleNavigateToTransactionsWithFilter}
            onAddTransaction={handleAddTransaction}
            onReassignTransactionPeriod={handleReassignTransactionPeriod}
          />
        )}
        {currentTab === 'reports' && (
          <ReportsTab
            transactions={transactions}
            displayCurrency={displayCurrency}
            usdArsRate={usdArsRate}
          />
        )}
        {currentTab === 'budgets' && (
          <BudgetTab
            transactions={transactions}
            budgets={budgets}
            onUpdateBudgets={setBudgets}
            displayCurrency={displayCurrency}
            usdArsRate={usdArsRate}
          />
        )}
        {currentTab === 'recurring' && (
          <RecurringTab
            transactions={transactions}
            recurringRules={[]}
            displayCurrency={displayCurrency}
            usdArsRate={usdArsRate}
            historyData={historyData}
          />
        )}
        {currentTab === 'inflation' && <InflationVsFxTab historyData={historyData} />}
        {currentTab === 'ai-advisor' && (
          <AiAdvisorTab transactions={transactions} displayCurrency={displayCurrency} usdArsRate={usdArsRate} />
        )}
        {currentTab === 'settings' && (
          <SettingsTab
            authUser={authUser}
            authLoading={authLoading}
            categories={categories}
            accounts={accounts}
            transactions={transactions}
            budgets={budgets}
            usdArsRate={usdArsRate}
            privacyMode={privacyMode}
            customBalances={customBalances}
            onTogglePrivacyMode={handleTogglePrivacyMode}
            onUpdateRate={setUsdArsRate}
            onAddCategory={handleAddCategory}
            onEditCategory={handleEditCategory}
            onDeleteCategory={handleDeleteCategory}
            onAddAccount={handleAddAccount}
            onEditAccount={handleEditAccount}
            onDeleteAccount={handleDeleteAccount}
            onImportBackup={handleImportBackup}
            onRecalculateBalances={handleRecalculateAllBalances}
            onLogout={handleLogout}
          />
        )}
      </main>

      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddTransaction={handleAddTransaction}
        existingAccounts={accounts.map(a => a.name)}
        existingCategories={categories.map(c => c.name)}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirmDeleteAll={handleDeleteAllData}
      />

      <AiChatWidget
        transactions={transactions}
        displayCurrency={displayCurrency}
        usdArsRate={usdArsRate}
      />
    </div>
  );
}
