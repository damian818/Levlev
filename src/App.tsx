/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ViewTab, DisplayCurrency, Transaction, BudgetGoal, AccountCustomBalance, TransactionFilter, InflationPoint, CategoryItem, AccountItem, SharedMember } from './types';
import { Loader2, Heart, ShieldCheck, TrendingUp, Wallet, Sparkles, Globe, ArrowRight, Lock, CheckCircle2, DollarSign } from 'lucide-react';
import { parseTransactions, historicalInflationAndFX, defaultCategoryItems, defaultAccountItems } from './data/defaultTransactions';
import { deriveBudgetsFromTransactions, getGlobalPrivacyMode, setGlobalPrivacyMode, recalculateAccountBalancesFromTransactions, isCreditCardAccount } from './utils/financeUtils';
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
import { ShareWorkspaceModal } from './components/ShareWorkspaceModal';
import { AiChatWidget } from './components/AiChatWidget';
import { LandingPage } from './components/LandingPage';
import ImportWizardModal from './components/ImportWizardModal';
import { LevLevIcon, LevLevLogo } from './components/LevLevLogo';

export default function App() {
  const [isWorkspaceShared, setIsWorkspaceShared] = useState<boolean>(() => {
    try {
      return localStorage.getItem('finance_app_workspace_is_shared') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [userTimezone, setUserTimezone] = useState<string>(() => {
    try {
      return localStorage.getItem('finance_app_user_timezone') || 'America/Argentina/Buenos_Aires';
    } catch (e) {
      return 'America/Argentina/Buenos_Aires';
    }
  });

  const [showSharedData, setShowSharedData] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('finance_app_show_shared_data');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  const [workspaceMembers, setWorkspaceMembers] = useState<SharedMember[]>(() => {
    try {
      const saved = localStorage.getItem('finance_app_workspace_members');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load workspace members from localStorage');
    }
    return [];
  });

  const [isShareWorkspaceModalOpen, setIsShareWorkspaceModalOpen] = useState(false);
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

  // Sync general workspace sharing to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('finance_app_workspace_is_shared', String(isWorkspaceShared));
      localStorage.setItem('finance_app_workspace_members', JSON.stringify(workspaceMembers));
      localStorage.setItem('finance_app_show_shared_data', String(showSharedData));
      localStorage.setItem('finance_app_user_timezone', userTimezone);
    } catch (e) {
      console.warn('Failed to save workspace sharing state to localStorage');
    }
  }, [isWorkspaceShared, workspaceMembers, showSharedData, userTimezone]);

  const handleUpdateWorkspaceSharing = (isShared: boolean, members: SharedMember[]) => {
    setIsWorkspaceShared(isShared);
    setWorkspaceMembers(members);
  };

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
    if (newAcc.closingRule) {
      try {
        const saved = localStorage.getItem('finance_app_cc_rules');
        const map = saved ? JSON.parse(saved) : {};
        map[newAcc.name] = newAcc.closingRule;
        localStorage.setItem('finance_app_cc_rules', JSON.stringify(map));
      } catch (e) {}
    }
  };

  const handleEditAccount = (oldName: string, updatedAcc: AccountItem, updateTransactions: boolean) => {
    setAccounts(prev => prev.map(a => a.name === oldName ? updatedAcc : a));

    if (updatedAcc.initialBalance !== undefined) {
      handleUpdateAccountBalance(updatedAcc.name, updatedAcc.initialBalance, updatedAcc.currency);
    }

    if (updatedAcc.closingRule) {
      try {
        const saved = localStorage.getItem('finance_app_cc_rules');
        const map = saved ? JSON.parse(saved) : {};
        map[updatedAcc.name] = updatedAcc.closingRule;
        if (oldName !== updatedAcc.name && map[oldName]) {
          delete map[oldName];
        }
        localStorage.setItem('finance_app_cc_rules', JSON.stringify(map));
      } catch (e) {}
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

  const handleUpdateAccountSharing = (accName: string, isShared: boolean, sharedMembers: SharedMember[]) => {
    setAccounts(prev => {
      return prev.map(a => {
        if (a.name === accName) {
          return {
            ...a,
            isShared,
            sharedMembers,
          };
        }
        return a;
      });
    });
  };

  const handleImportBackup = (data: { transactions: Transaction[]; categories: CategoryItem[]; accounts: AccountItem[]; budgets: BudgetGoal[]; isFullBackup?: boolean }) => {
    if (data.isFullBackup) {
      if (data.transactions) setTransactions(data.transactions);
      if (data.categories) setCategories(data.categories);
      if (data.accounts) setAccounts(data.accounts);
      if (data.budgets) setBudgets(data.budgets);
    } else {
      if (data.transactions) {
        setTransactions(data.transactions);
        
        // Auto-generate missing accounts and categories from imported transactions
        setAccounts(prev => {
          const merged = [...prev];
          const newAccNames = new Set<string>();
          data.transactions.forEach(t => {
            if (t.account) newAccNames.add(t.account);
            if (t.toAccount) newAccNames.add(t.toAccount);
          });
          newAccNames.forEach(name => {
            if (name && !merged.find(a => a.name.toLowerCase() === name.toLowerCase())) {
              const sample = data.transactions.find(t => t.account === name || t.toAccount === name);
              merged.push({
                id: `acc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name: name,
                type: isCreditCardAccount(name) ? 'CREDIT_CARD' : 'CHECKING',
                currency: sample?.currency || 'ARS'
              });
            }
          });
          return merged;
        });

        setCategories(prev => {
          const merged = [...prev];
          const newCatNames = new Set<string>();
          data.transactions.forEach(t => {
            if (t.category) newCatNames.add(t.category);
          });
          newCatNames.forEach(name => {
            if (name && !merged.find(c => c.name.toLowerCase() === name.toLowerCase())) {
              merged.push({
                id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name: name,
                type: 'EXPENSE',
              });
            }
          });
          return merged;
        });
      }
    }
  };

  const [currentTab, setCurrentTab] = useState<ViewTab>('overview');
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('ARS');
  const [usdArsRate, setUsdArsRate] = useState<number>(1521);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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

  const [hasInitialSynced, setHasInitialSynced] = useState(false);

  // Sync Supabase user data
  const syncFromSupabase = React.useCallback(async () => {
    try {
      const data = await fetchUserDataFromSupabase();
      if (data) {
        setTransactions(data.transactions || []);
        if (data.categories && data.categories.length > 0) setCategories(data.categories);
        if (data.accounts && data.accounts.length > 0) setAccounts(data.accounts);
        setBudgets(data.budgets || []);

        if (data.settings) {
          if (data.settings.ccPeriodStatuses) {
            setPeriodStatusOverrides(data.settings.ccPeriodStatuses);
            try {
              localStorage.setItem('finance_app_cc_period_statuses', JSON.stringify(data.settings.ccPeriodStatuses));
            } catch (e) {}
          }
          if (data.settings.customBalances) {
            setCustomBalances(data.settings.customBalances);
            try {
              localStorage.setItem('finance_app_account_balances', JSON.stringify(data.settings.customBalances));
            } catch (e) {}
          }
          if (data.settings.ccRulesMap) {
            try {
              localStorage.setItem('finance_app_cc_rules', JSON.stringify(data.settings.ccRulesMap));
            } catch (e) {}
          }
          if (data.settings.ccMap) {
            try {
              localStorage.setItem('finance_app_cc_map', JSON.stringify(data.settings.ccMap));
            } catch (e) {}
          }
          if (data.settings.workspaceSharing) {
            if (data.settings.workspaceSharing.isShared !== undefined) {
              setIsWorkspaceShared(data.settings.workspaceSharing.isShared);
              try {
                localStorage.setItem('finance_app_workspace_is_shared', String(data.settings.workspaceSharing.isShared));
              } catch (e) {}
            }
            if (data.settings.workspaceSharing.members) {
              setWorkspaceMembers(data.settings.workspaceSharing.members);
              try {
                localStorage.setItem('finance_app_workspace_members', JSON.stringify(data.settings.workspaceSharing.members));
              } catch (e) {}
            }
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch user data from Supabase:', err);
    } finally {
      setHasInitialSynced(true);
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
    if (!authUser || !hasInitialSynced) return;
    const timer = setTimeout(() => {
      saveAllUserDataToSupabase({
        transactions,
        categories,
        accounts,
        budgets,
        settings: {
          ccPeriodStatuses: periodStatusOverrides,
          customBalances,
          workspaceSharing: {
            isShared: isWorkspaceShared,
            members: workspaceMembers,
          },
        },
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [transactions, categories, accounts, budgets, periodStatusOverrides, customBalances, isWorkspaceShared, workspaceMembers, authUser, hasInitialSynced]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex flex-col items-center justify-center text-slate-400 p-4">
        <div className="w-14 h-14 rounded-2xl bg-[#0f131a] border border-slate-800 flex items-center justify-center mb-4 shadow-xl shadow-emerald-950/20">
          <LevLevIcon className="w-8 h-8" variant="white" />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mb-2" />
        <p className="font-bold text-slate-200 text-sm">Loading LevLev...</p>
        <p className="text-xs text-slate-500 mt-1">Personal finance with heart</p>
      </div>
    );
  }

  if (!authUser) {
    return (
      <LandingPage
        onSignInWithGoogle={async () => {
          setAuthError(null);
          const { error } = await signInWithGoogle();
          if (error) setAuthError(error.message || 'Login failed');
        }}
        onEnterGuestMode={() => {
          setAuthUser({
            id: 'guest-user',
            email: 'guest@levlev.app',
            user_metadata: { full_name: 'Guest User' },
          });
          localStorage.setItem('levlev_guest_mode', 'true');
        }}
        authError={authError}
        usdArsRate={usdArsRate}
      />
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
  };  const handleNavigateToTransactionsWithFilter = (filter: TransactionFilter) => {
    setActiveFilter(filter);
    setCurrentTab('transactions');
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

  const handleUpdateTransaction = (idOrIds: string | string[], updates: Partial<Transaction>) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    setTransactions(prev => {
      const updated = prev.map(t => ids.includes(t.id) ? { ...t, ...updates } : t);
      try {
        localStorage.setItem('finance_app_transactions', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsAddModalOpen(true);
  };

  const handleDuplicateTransaction = (tx: Transaction) => {
    const duplicatedTx = {
      ...tx,
      id: '', // Empty ID means it's a new transaction
      title: `${tx.title} (Copy)`,
    };
    setEditingTransaction(duplicatedTx);
    setIsAddModalOpen(true);
  };

  const handleDeleteTransaction = (idOrIds: string | string[]) => {
    const idsToDelete = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (idsToDelete.length === 0) return;

    setTransactions(prev => {
      const updated = prev.filter(t => !idsToDelete.includes(t.id));
      try {
        localStorage.setItem('finance_app_transactions', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    deleteTransactionFromSupabase(idsToDelete);
  };

  const handleAddTransaction = (newTx: Transaction | Transaction[]) => {
    if (Array.isArray(newTx)) {
      setTransactions(prev => [...newTx, ...prev]);
    } else {
      setTransactions(prev => [newTx, ...prev]);
    }
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
    <div className="min-h-screen max-w-full overflow-x-hidden bg-[#0a0b0d] text-slate-100 flex flex-col font-sans">
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
        isWorkspaceShared={isWorkspaceShared}
        workspaceMembersCount={workspaceMembers.length}
        onOpenShareWorkspaceModal={() => setIsShareWorkspaceModalOpen(true)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-8 max-w-full overflow-x-hidden">
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
            currentUserId={authUser?.id}
            showSharedData={showSharedData}
            userTimezone={userTimezone}
          />
        )}
        {currentTab === 'transactions' && (
          <TransactionsTab
            transactions={transactions}
            displayCurrency={displayCurrency}
            usdArsRate={usdArsRate}
            historyData={historyData}
            onDeleteTransaction={handleDeleteTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onEditTransaction={handleEditTransaction}
            onDuplicateTransaction={handleDuplicateTransaction}
            categoriesList={categories}
            accountsList={accounts}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
            activeFilter={activeFilter}
            onClearFilter={() => setActiveFilter(undefined)}
            currentUserId={authUser?.id}
            showSharedData={showSharedData}
            userTimezone={userTimezone}
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
            isWorkspaceShared={isWorkspaceShared}
            workspaceMembersCount={workspaceMembers.length}
            onOpenShareWorkspaceModal={() => setIsShareWorkspaceModalOpen(true)}
            onUpdatePeriodStatus={handleUpdatePeriodStatus}
            onUpdateAccountBalance={handleUpdateAccountBalance}
            onNavigateToTransactionsWithFilter={handleNavigateToTransactionsWithFilter}
            onAddTransaction={handleAddTransaction}
            onReassignTransactionPeriod={handleReassignTransactionPeriod}
            onUpdateAccountSharing={handleUpdateAccountSharing}
            onEditAccount={handleEditAccount}
            onAddAccount={handleAddAccount}
            currentUserId={authUser?.id}
            showSharedData={showSharedData}
            userTimezone={userTimezone}
          />
        )}
        {currentTab === 'reports' && (
          <ReportsTab
            transactions={transactions}
            displayCurrency={displayCurrency}
            usdArsRate={usdArsRate}
            currentUserId={authUser?.id}
            showSharedData={showSharedData}
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
            userTimezone={userTimezone}
            onUpdateTimezone={setUserTimezone}
            privacyMode={privacyMode}
            isWorkspaceShared={isWorkspaceShared}
            showSharedData={showSharedData}
            onToggleShowSharedData={() => setShowSharedData(prev => !prev)}
            workspaceMembersCount={workspaceMembers.length}
            onOpenShareWorkspaceModal={() => setIsShareWorkspaceModalOpen(true)}
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
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onRecalculateBalances={handleRecalculateAllBalances}
            onLogout={handleLogout}
          />
        )}
      </main>

      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTransaction(null);
        }}
        onAddTransaction={handleAddTransaction}
        onUpdateTransaction={handleUpdateTransaction}
        editingTx={editingTransaction}
        accountsList={accounts}
        existingAccounts={accounts.map(a => a.name)}
        existingCategories={categories.map(c => c.name)}
        existingTransactions={transactions}
        onAddCategory={handleAddCategory}
        onAddAccount={handleAddAccount}
        usdArsRate={usdArsRate}
      />

      <ImportWizardModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={(data) => {
          handleImportBackup(data);
          alert('Data imported successfully!');
        }}
        existingAccounts={accounts}
        existingCategories={categories}
        userTimezone={userTimezone}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirmDeleteAll={handleDeleteAllData}
      />

      <ShareWorkspaceModal
        isOpen={isShareWorkspaceModalOpen}
        onClose={() => setIsShareWorkspaceModalOpen(false)}
        isWorkspaceShared={isWorkspaceShared}
        workspaceMembers={workspaceMembers}
        onUpdateWorkspaceSharing={handleUpdateWorkspaceSharing}
      />

      <AiChatWidget
        transactions={transactions}
        displayCurrency={displayCurrency}
        usdArsRate={usdArsRate}
      />
    </div>
  );
}
