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

  // Sync Supabase user data
  const syncFromSupabase = React.useCallback(async () => {
    const data = await fetchUserDataFromSupabase();
    if (data) {
      if (data.transactions && data.transactions.length > 0) setTransactions(data.transactions);
      if (data.categories && data.categories.length > 0) setCategories(data.categories);
      if (data.accounts && data.accounts.length > 0) setAccounts(data.accounts);
      if (data.budgets && data.budgets.length > 0) setBudgets(data.budgets);
    }
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    
    // Handle hash cleanup once on load if needed
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    if (client) {
      // 1. Initial Session Check
      client.auth.getSession().then(async ({ data: { session } }) => {
        setAuthUser(session?.user || null);
        if (session?.user) {
          await syncFromSupabase();
        }
        setAuthLoading(false);
      });

      // 2. Auth Subscription
      const { data: { subscription } } = client.auth.onAuthStateChange(async (_e, session) => {
        setAuthUser(prev => (prev?.id === session?.user?.id ? prev : (session?.user || null)));
        if (session?.user) {
          await syncFromSupabase();
        }
        setAuthLoading(false);
      });
      return () => subscription.unsubscribe();
    } else {
      setAuthLoading(false);
    }
  }, [syncFromSupabase]);
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Finlev...</p>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl font-black text-white mb-6">Finlev</h1>
        <p className="text-slate-400 mb-8 max-w-sm">Securely manage your personal finances with persistent data synchronization.</p>
        <button
          onClick={async () => {
            const { error } = await signInWithGoogle();
            if (error) alert(`Login failed: ${error.message}`);
          }}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
        >
          Sign in with Google SSO
        </button>
      </div>
    );
  }

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

  // Sync Supabase user data on auth login - redundant logic removed

  // Save changes to Supabase when user is authenticated
  useEffect(() => {
    const timer = setTimeout(() => {
      saveAllUserDataToSupabase({ transactions, categories, accounts, budgets });
    }, 1000);
    return () => clearTimeout(timer);
  }, [transactions, categories, accounts, budgets]);

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
