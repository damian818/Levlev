/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ViewTab, DisplayCurrency, Transaction, BudgetGoal, AccountCustomBalance, TransactionFilter, InflationPoint, CategoryItem, AccountItem } from './types';
import { Loader2 } from 'lucide-react';
import { rawCsvSample, parseTransactions, defaultBudgets, defaultRecurringRules, historicalInflationAndFX, defaultCategoryItems, defaultAccountItems } from './data/defaultTransactions';
import { deriveBudgetsFromTransactions } from './utils/financeUtils';
import { getSupabaseClient, signInWithGoogle } from './lib/supabase';
import { fetchUserDataFromSupabase, saveAllUserDataToSupabase } from './services/supabaseSync';
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

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('finance_app_transactions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load transactions from localStorage', e);
    }
    return parseTransactions(rawCsvSample);
  });

  const [budgets, setBudgets] = useState<BudgetGoal[]>(() => {
    try {
      const saved = localStorage.getItem('finance_app_budgets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load budgets from localStorage', e);
    }
    return defaultBudgets;
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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
      localStorage.setItem('finance_app_transactions', JSON.stringify(transactions));
    } catch (e) {
      console.warn('Failed to save transactions to localStorage', e);
    }
  }, [transactions]);

  // Auth State
  const [authUser, setAuthUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [guestMode, setGuestMode] = useState<boolean>(() => {
    return localStorage.getItem('finlev_guest_mode') === 'true';
  });
  const [authError, setAuthError] = useState<string | null>(null);

  // Sync Supabase user data
  const syncFromSupabase = React.useCallback(async () => {
    try {
      const data = await fetchUserDataFromSupabase();
      if (data) {
        if (data.transactions && data.transactions.length > 0) setTransactions(data.transactions);
        if (data.categories && data.categories.length > 0) setCategories(data.categories);
        if (data.accounts && data.accounts.length > 0) setAccounts(data.accounts);
        if (data.budgets && data.budgets.length > 0) setBudgets(data.budgets);
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
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load custom balances from localStorage');
    }
    // Default initial live balances
    return {
      'Deel': { accountName: 'Deel', currentBalance: 12450, currency: 'USD' },
      'DollarApp': { accountName: 'DollarApp', currentBalance: 3200, currency: 'USD' },
      'Santander (ARS)': { accountName: 'Santander (ARS)', currentBalance: 450000, currency: 'ARS' },
      'BBVA (ARS)': { accountName: 'BBVA (ARS)', currentBalance: 280000, currency: 'ARS' },
      'ICBC (ARS)': { accountName: 'ICBC (ARS)', currentBalance: 150000, currency: 'ARS' },
      'Cocos Capital (ARS)': { accountName: 'Cocos Capital (ARS)', currentBalance: 1850000, currency: 'ARS' },
    };
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
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
        <p className="font-bold text-slate-200">Loading Finlev...</p>
        <p className="text-xs text-slate-500 mt-2">Checking authentication & syncing data</p>
      </div>
    );
  }

  if (!authUser && !guestMode) {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';

    return (
      <div className="min-h-screen bg-[#0a0b0d] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mb-6">
          <span className="text-emerald-400 font-black text-3xl">F</span>
        </div>
        <h1 className="text-4xl font-black text-white mb-2">Welcome to Finlev</h1>
        <p className="text-slate-400 mb-8 max-w-md text-sm">
          Personal finance &amp; expense tracker with multi-currency support, inflation adjustments, and cloud sync.
        </p>

        {authError && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs max-w-sm text-left">
            <strong className="block font-semibold mb-1">Auth Error:</strong>
            {authError}
          </div>
        )}

        <div className="flex flex-col gap-3 w-full max-w-xs mb-8">
          <button
            onClick={async () => {
              setAuthError(null);
              const { error } = await signInWithGoogle();
              if (error) {
                setAuthError(error.message || 'Login failed');
              }
            }}
            className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            Sign in with Google SSO
          </button>

          <button
            onClick={() => {
              setGuestMode(true);
              localStorage.setItem('finlev_guest_mode', 'true');
            }}
            className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 border border-slate-700 text-sm"
          >
            Continue in Guest Mode (Offline)
          </button>
        </div>

        {/* Redirect URL Configuration Guide */}
        <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-2xl p-5 text-left text-xs text-slate-400 shadow-xl">
          <h3 className="font-bold text-slate-200 text-sm mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            OAuth &amp; Redirect URL Setup
          </h3>
          <p className="mb-3 text-slate-400">
            Ensure your Supabase project and Google OAuth credentials match this application&apos;s current origin:
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-emerald-400 font-mono text-[11px] break-all select-all mb-3">
            {currentOrigin}
          </div>
          <ul className="space-y-2 text-slate-400 list-disc list-inside">
            <li>
              <strong className="text-slate-300">Supabase Redirect URL:</strong> Go to Supabase Dashboard &gt; <em>Authentication &gt; URL Configuration</em>, add <code className="text-emerald-400">{currentOrigin}</code> to <strong>Redirect URLs</strong>.
            </li>
            <li>
              <strong className="text-slate-300">Google OAuth Callback:</strong> Ensure Authorized Redirect URI in Google Cloud Console is <code className="text-emerald-400">https://&lt;your-project-ref&gt;.supabase.co/auth/v1/callback</code>.
            </li>
          </ul>
        </div>
      </div>
    );
  }

  const handleUpdateAccountBalance = (accountName: string, currentBalance: number, currency: string) => {
    setCustomBalances(prev => {
      const updated = {
        ...prev,
        [accountName]: { accountName, currentBalance, currency }
      };
      try {
        localStorage.setItem('finance_app_account_balances', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save balances to localStorage');
      }
      return updated;
    });
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
            // Create a set of existing transaction keys for O(1) lookup
            // Key format: date|title|amount|account|currency
            const existingKeys = new Set(prev.map(t => 
              t.id && !t.id.startsWith('tx-') ? t.id : `${t.date}|${t.title}|${t.amount}|${t.account}|${t.currency}`
            ));

            const newTxs = uploadedTx.filter(t => {
              const key = t.id && !t.id.startsWith('tx-') ? t.id : `${t.date}|${t.title}|${t.amount}|${t.account}|${t.currency}`;
              return !existingKeys.has(key);
            });

            if (newTxs.length === 0) {
              // Even if no new transactions, we might want to check budgets
              return prev;
            }
            
            const combined = [...newTxs, ...prev];
            // Sort by date descending
            const sorted = combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            // Derive budget goals from the updated combined list
            const derived = deriveBudgetsFromTransactions(sorted, budgets);
            setBudgets(derived);
            
            return sorted;
          });
          
          setCurrentTab('overview');
        }
      }
    };
    textReader.readAsText(file);
  };

  const handleResetData = () => {
    localStorage.removeItem('finance_app_transactions');
    localStorage.removeItem('finance_app_budgets');
    setTransactions(parseTransactions(rawCsvSample));
    setBudgets(defaultBudgets);
    setActiveFilter(undefined);
  };

  const handleDeleteAllData = () => {
    localStorage.removeItem('finance_app_transactions');
    localStorage.removeItem('finance_app_budgets');
    setTransactions([]);
    setBudgets([]);
    setActiveFilter(undefined);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions(prev => [newTx, ...prev]);
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
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onFileUpload={handleFileUpload}
        onResetData={handleResetData}
        onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'overview' && (
          <OverviewTab
            transactions={transactions}
            displayCurrency={displayCurrency}
            usdArsRate={usdArsRate}
            historyData={historyData}
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
            recurringRules={defaultRecurringRules}
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
            onUpdateRate={setUsdArsRate}
            onAddCategory={handleAddCategory}
            onEditCategory={handleEditCategory}
            onDeleteCategory={handleDeleteCategory}
            onAddAccount={handleAddAccount}
            onEditAccount={handleEditAccount}
            onDeleteAccount={handleDeleteAccount}
            onResetData={handleResetData}
            onImportBackup={handleImportBackup}
            onLogout={() => setAuthUser(null)}
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
        onConfirmResetSample={handleResetData}
      />

      <AiChatWidget
        transactions={transactions}
        displayCurrency={displayCurrency}
        usdArsRate={usdArsRate}
      />
    </div>
  );
}
