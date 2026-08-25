/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { ViewTab, DisplayCurrency, Transaction, BudgetGoal, AccountCustomBalance, TransactionFilter, InflationPoint, CategoryItem, AccountItem, SharedMember, RecurringRule, DebtItem, DebtPayoffStrategy } from './types';
import { Loader2, Heart, ShieldCheck, TrendingUp, Wallet, Sparkles, Globe, ArrowRight, Lock, CheckCircle2, DollarSign } from 'lucide-react';
import { parseTransactions, historicalInflationAndFX, defaultCategoryItems, defaultAccountItems } from './data/defaultTransactions';
import { deriveBudgetsFromTransactions, getGlobalPrivacyMode, setGlobalPrivacyMode, recalculateAccountBalancesFromTransactions, isCreditCardAccount, detectFinancialAnomalies, getCreditCardStatements, getPendingRecurringForMonth, getCurrentMonthKey, getSavedDismissedRecurring, saveDismissedRecurring } from './utils/financeUtils';
import { TabCustomizationItem, getSavedTabCustomization, saveTabCustomizationToStorage, mergeTabOrder } from './utils/tabUtils';
import { getSavedSelectedReports, saveSelectedReports } from './utils/reportsCatalog';
import { getSavedDebts, saveDebtsToStorage, getSavedDebtStrategy, saveDebtStrategyToStorage, getSavedExtraPayment, saveExtraPaymentToStorage } from './utils/debtUtils';
import { useBrowserNotifications } from './hooks/useBrowserNotifications';
import { initializeGlobalFxRates } from './utils/currencyUtils';
import { getSupabaseClient, signInWithGoogle, signOutFromSupabase } from './lib/supabase';
import { fetchUserDataFromSupabase, saveAllUserDataToSupabase, deleteAllUserDataFromSupabase, deleteTransactionFromSupabase, deleteCategoryFromSupabase, deleteAccountFromSupabase } from './services/supabaseSync';
import { Navbar } from './components/Navbar';

// Lazy load non-critical components
const OverviewTab = lazy(() => import('./components/OverviewTab').then(m => ({ default: m.OverviewTab })));
const ReportsTab = lazy(() => import('./components/ReportsTab').then(m => ({ default: m.ReportsTab })));
const TransactionsTab = lazy(() => import('./components/TransactionsTab').then(m => ({ default: m.TransactionsTab })));
const AccountsTab = lazy(() => import('./components/AccountsTab').then(m => ({ default: m.AccountsTab })));
const BudgetTab = lazy(() => import('./components/BudgetTab').then(m => ({ default: m.BudgetTab })));
const RecurringTab = lazy(() => import('./components/RecurringTab').then(m => ({ default: m.RecurringTab })));
const DebtPayoffTab = lazy(() => import('./components/DebtPayoffTab').then(m => ({ default: m.DebtPayoffTab })));
const InflationVsFxTab = lazy(() => import('./components/InflationVsFxTab').then(m => ({ default: m.InflationVsFxTab })));
const AiAdvisorTab = lazy(() => import('./components/AiAdvisorTab').then(m => ({ default: m.AiAdvisorTab })));
const SettingsTab = lazy(() => import('./components/SettingsTab').then(m => ({ default: m.SettingsTab })));
const AddTransactionModal = lazy(() => import('./components/AddTransactionModal').then(m => ({ default: m.AddTransactionModal })));
const ConfirmDeleteModal = lazy(() => import('./components/ConfirmDeleteModal').then(m => ({ default: m.ConfirmDeleteModal })));
const ShareWorkspaceModal = lazy(() => import('./components/ShareWorkspaceModal').then(m => ({ default: m.ShareWorkspaceModal })));
const AiChatWidget = lazy(() => import('./components/AiChatWidget').then(m => ({ default: m.AiChatWidget })));
const ImportWizardModal = lazy(() => import('./components/ImportWizardModal'));

import { LandingPage } from './components/LandingPage';
import { LevLevIcon, LevLevLogo } from './components/LevLevLogo';
import i18n from './i18n';
import { ReloadPrompt } from './components/ReloadPrompt';
import { OnboardingTour } from './components/OnboardingTour';
import { WifiOff } from 'lucide-react';

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  const { permission, requestPermission, sendNotification } = useBrowserNotifications();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('finance_app_notifications_enabled') === 'true';
    } catch {
      return false;
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

  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('finance_app_hidden_category_ids');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return categories.filter(c => c.isHiddenFromNewTx).map(c => c.id || c.name);
  });

  useEffect(() => {
    try {
      localStorage.setItem('finance_app_hidden_category_ids', JSON.stringify(hiddenCategoryIds));
    } catch (e) {}
  }, [hiddenCategoryIds]);

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

  // Tab Customization State
  const [tabCustomization, setTabCustomization] = useState<TabCustomizationItem[]>(() => getSavedTabCustomization());

  // Reports Customization State
  const [reportSettings, setReportSettings] = useState<string[]>(() => getSavedSelectedReports());

  // Debts & Strategy States
  const [debts, setDebts] = useState<DebtItem[]>(() => getSavedDebts());
  const [debtStrategy, setDebtStrategy] = useState<DebtPayoffStrategy>(() => getSavedDebtStrategy());
  const [debtExtraPayment, setDebtExtraPayment] = useState<number>(() => getSavedExtraPayment());

  // Recurring Dismissed State
  const [dismissedRecurring, setDismissedRecurring] = useState<string[]>(() => getSavedDismissedRecurring());

  // Real-time custom event listeners across modules
  useEffect(() => {
    const handleDismissed = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) setDismissedRecurring(e.detail);
    };
    const handleTabs = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) setTabCustomization(e.detail);
    };
    const handleReports = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) setReportSettings(e.detail);
    };
    const handleDebts = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) setDebts(e.detail);
    };
    const handleStrategy = (e: any) => {
      if (e.detail) setDebtStrategy(e.detail);
    };
    const handleExtraPay = (e: any) => {
      if (typeof e.detail === 'number') setDebtExtraPayment(e.detail);
    };

    window.addEventListener('finance_app_dismissed_updated', handleDismissed);
    window.addEventListener('finance_app_tab_settings_updated', handleTabs);
    window.addEventListener('finance_app_reports_settings_updated', handleReports);
    window.addEventListener('finance_app_debts_updated', handleDebts);
    window.addEventListener('finance_app_debt_strategy_updated', handleStrategy);
    window.addEventListener('finance_app_debt_extra_payment_updated', handleExtraPay);

    return () => {
      window.removeEventListener('finance_app_dismissed_updated', handleDismissed);
      window.removeEventListener('finance_app_tab_settings_updated', handleTabs);
      window.removeEventListener('finance_app_reports_settings_updated', handleReports);
      window.removeEventListener('finance_app_debts_updated', handleDebts);
      window.removeEventListener('finance_app_debt_strategy_updated', handleStrategy);
      window.removeEventListener('finance_app_debt_extra_payment_updated', handleExtraPay);
    };
  }, []);

  // Trigger notifications
  // (Moved to after recurringRules declaration)

  const handleUpdateWorkspaceSharing = (isShared: boolean, members: SharedMember[]) => {
    setIsWorkspaceShared(isShared);
    setWorkspaceMembers(members);
  };

  // Category Handlers
  const handleAddCategory = (newCat: CategoryItem) => {
    setCategories(prev => {
      const updated = [...prev, newCat];
      try {
        localStorage.setItem('finance_app_custom_categories', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleEditCategory = (oldName: string, updatedCat: CategoryItem, updateTransactions: boolean) => {
    let nextCategories: CategoryItem[] = [];
    setCategories(prev => {
      nextCategories = prev.map(c => c.name === oldName ? updatedCat : c);
      try {
        localStorage.setItem('finance_app_custom_categories', JSON.stringify(nextCategories));
      } catch (e) {}
      return nextCategories;
    });

    if (updateTransactions && oldName !== updatedCat.name) {
      setTransactions(prev => prev.map(t => t.category === oldName ? { ...t, category: updatedCat.name } : t));
      setBudgets(prev => prev.map(b => b.category === oldName ? { ...b, category: updatedCat.name } : b));
    }

    if (authUser && hasInitialSynced) {
      saveAllUserDataToSupabase({
        transactions,
        categories: nextCategories.length > 0 ? nextCategories : categories.map(c => c.name === oldName ? updatedCat : c),
        accounts,
        budgets,
        settings: {
          hiddenCategoryIds: Array.from(new Set([
            ...hiddenCategoryIds,
            ...categories.filter(c => c.isHiddenFromNewTx).map(c => c.id),
            ...categories.filter(c => c.isHiddenFromNewTx).map(c => c.name),
          ])),
          localCurrency,
          displayCurrency,
          enabledCurrencies,
          ccPeriodStatuses: periodStatusOverrides,
          customBalances,
          workspaceSharing: {
            isShared: isWorkspaceShared,
            members: workspaceMembers,
          },
          recurringThresholds,
          globalRecurringThreshold,
        },
      });
    }
  };

  const handleDeleteCategory = (catName: string, reassignTo?: string) => {
    setCategories(prev => {
      const updated = prev.filter(c => c.name !== catName);
      try {
        localStorage.setItem('finance_app_custom_categories', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
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

  const handleReorderAccounts = (reordered: AccountItem[]) => {
    const withOrder = reordered.map((acc, index) => ({
      ...acc,
      order: index,
    }));
    setAccounts(withOrder);
    try {
      localStorage.setItem('finance_app_custom_accounts', JSON.stringify(withOrder));
    } catch (e) {}

    // Immediate sync save to Supabase to guarantee cross-device sync
    if (authUser && hasInitialSynced) {
      saveAllUserDataToSupabase({
        transactions,
        categories,
        accounts: withOrder,
        budgets,
        settings: {
          localCurrency,
          displayCurrency,
          enabledCurrencies,
          ccPeriodStatuses: periodStatusOverrides,
          customBalances,
          workspaceSharing: {
            isShared: isWorkspaceShared,
            members: workspaceMembers,
          },
        },
      });
    }
  };

  const handleImportBackup = (data: { transactions: Transaction[]; categories: CategoryItem[]; accounts: AccountItem[]; budgets: BudgetGoal[]; isFullBackup?: boolean }) => {
    if (data.isFullBackup) {
      if (data.transactions) setTransactions(data.transactions);
      if (data.categories) setCategories(data.categories);
      if (data.accounts) setAccounts(data.accounts);
      if (data.budgets) setBudgets(data.budgets);
    } else {
      if (data.transactions && data.transactions.length > 0) {
        setTransactions(prev => {
          const existingMap = new Map<string, Transaction>();
          prev.forEach(t => {
            if (t.id) existingMap.set(t.id, t);
          });

          data.transactions.forEach(t => {
            const txId = t.id || `tx_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            existingMap.set(txId, { ...t, id: txId });
          });

          const mergedTransactions = Array.from(existingMap.values());
          try {
            localStorage.setItem('finance_app_transactions', JSON.stringify(mergedTransactions));
          } catch (e) {}
          return mergedTransactions;
        });
        
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
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>(() => {
    try {
      const saved = localStorage.getItem('finance_app_display_currency');
      if (saved) return saved as DisplayCurrency;
    } catch (e) {}
    return 'ARS';
  });

  const [localCurrency, setLocalCurrency] = useState<DisplayCurrency>(() => {
    try {
      const saved = localStorage.getItem('finance_app_local_currency');
      if (saved) return saved as DisplayCurrency;
    } catch (e) {}
    return 'ARS';
  });

  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('finance_app_enabled_currencies');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return ['USD', 'ARS', 'EUR', 'BRL', 'USDT', 'CLP', 'UYU', 'GBP'];
  });

  // Sync display currency to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('finance_app_display_currency', displayCurrency);
    } catch (e) {
      console.warn('Failed to save display currency to localStorage');
    }
  }, [displayCurrency]);

  // Sync local currency to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('finance_app_local_currency', localCurrency);
    } catch (e) {}
  }, [localCurrency]);

  // Sync enabled currencies to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('finance_app_enabled_currencies', JSON.stringify(enabledCurrencies));
    } catch (e) {}
  }, [enabledCurrencies]);

  // Restore persistent language preference on mount
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('finance_app_language') || localStorage.getItem('i18nextLng');
      if (savedLang && (savedLang.startsWith('es') || savedLang.startsWith('en'))) {
        const targetLang = savedLang.startsWith('es') ? 'es' : 'en';
        if (i18n.language !== targetLang) {
          i18n.changeLanguage(targetLang);
        }
      }
    } catch (e) {}
  }, []);

  const [usdArsRate, setUsdArsRate] = useState<number>(1521);

  // Fetch live global FX rates and MEP rate on mount
  useEffect(() => {
    initializeGlobalFxRates((rates, mep) => {
      if (mep && mep > 0) {
        setUsdArsRate(mep);
      }
    });
  }, []);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<InflationPoint[]>(historicalInflationAndFX);
  const hasHandledShareRef = useRef(false);
  const lastAddedTxRef = useRef<{ txHash: string; time: number } | null>(null);

  // Parse incoming data from Web Share Target API
  useEffect(() => {
    if (hasHandledShareRef.current) return;
    const handleSharedData = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const title = params.get('title');
        const text = params.get('text');
        const url = params.get('url');

        if (title || text || url) {
          hasHandledShareRef.current = true;
          const sharedText = [title, text, url].filter(Boolean).join(' - ');
          
          // Show the modal immediately with the text as title as a fallback
          setEditingTransaction({
            id: '',
            title: sharedText,
            amount: 0,
            date: new Date().toISOString().substring(0, 10),
            type: 'EXPENSE',
            category: 'General',
            account: accounts[0]?.name || 'BBVA',
            currency: 'ARS',
            timestamp: new Date().toISOString()
          } as Transaction);
          setIsAddModalOpen(true);
          
          // Try to use AI to parse it in the background
          try {
            const accNames = accounts.map(a => a.name);
            const catNames = categories.map(c => c.name);
            const res = await fetch('/api/ai-parse-tx', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: sharedText, accounts: accNames, categories: catNames })
            });
            if (res.ok) {
              const parsed = await res.json();
              setEditingTransaction(prev => ({
                ...(prev || {} as Transaction),
                id: '',
                title: parsed.title || sharedText,
                amount: parsed.amount || 0,
                type: parsed.type || 'EXPENSE',
                category: parsed.category || 'General',
                account: parsed.account || accounts[0]?.name || 'BBVA',
                currency: parsed.currency || 'ARS',
                date: parsed.date || new Date().toISOString().substring(0, 10),
              }));
            }
          } catch (apiErr) {
            console.warn('AI parsing failed, falling back to basic parsing', apiErr);
            // Fallback parsing
            let guessedAmount = 0;
            const amountMatch = sharedText.match(/(?:\$|ARS|USD)?\s*(\d+(?:[.,]\d{1,2})?)/);
            if (amountMatch && amountMatch[1]) {
              guessedAmount = parseFloat(amountMatch[1].replace(',', '.'));
            }
            setEditingTransaction(prev => ({
              ...(prev || {} as Transaction),
              amount: guessedAmount || 0,
            }));
          }

          // Clean URL to prevent re-opening on reload
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (e) {
        console.warn('Error handling share target params', e);
      }
    };
    handleSharedData();
  }, [accounts, categories]);

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
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
          try {
            localStorage.setItem('finance_app_custom_categories', JSON.stringify(data.categories));
          } catch (e) {}
        }
        if (Array.isArray(data.settings?.hiddenCategoryIds)) {
          setHiddenCategoryIds(data.settings.hiddenCategoryIds);
          try {
            localStorage.setItem('finance_app_hidden_category_ids', JSON.stringify(data.settings.hiddenCategoryIds));
          } catch (e) {}
        }
        if (data.accounts && data.accounts.length > 0) {
          setAccounts(data.accounts);
          try {
            localStorage.setItem('finance_app_custom_accounts', JSON.stringify(data.accounts));
          } catch (e) {}
        }
        setBudgets(data.budgets || []);

        if (data.settings?.onboardingCompleted || (data.transactions && data.transactions.length > 0)) {
          try {
            localStorage.setItem('levlev_onboarding_completed', 'true');
            localStorage.setItem('finlev_onboarding_completed', 'true');
            localStorage.setItem('finance_app_onboarding_completed', 'true');
          } catch (e) {}
        }

        if (data.settings) {
          if (data.settings.localCurrency) {
            setLocalCurrency(data.settings.localCurrency as DisplayCurrency);
          }
          if (data.settings.displayCurrency) {
            setDisplayCurrency(data.settings.displayCurrency as DisplayCurrency);
          }
          if (Array.isArray(data.settings.enabledCurrencies) && data.settings.enabledCurrencies.length > 0) {
            setEnabledCurrencies(data.settings.enabledCurrencies);
          }
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
          if (data.settings.recurringThresholds) {
            setRecurringThresholds(data.settings.recurringThresholds);
            try {
              localStorage.setItem('finance_app_recurring_thresholds', JSON.stringify(data.settings.recurringThresholds));
            } catch (e) {}
          }
          if (data.settings.globalRecurringThreshold !== undefined) {
            setGlobalRecurringThreshold(data.settings.globalRecurringThreshold);
            try {
              localStorage.setItem('finance_app_global_recurring_threshold', String(data.settings.globalRecurringThreshold));
            } catch (e) {}
          }
          if (data.settings.debts && Array.isArray(data.settings.debts)) {
            setDebts(data.settings.debts);
            saveDebtsToStorage(data.settings.debts);
          }
          if (data.settings.debtStrategy) {
            setDebtStrategy(data.settings.debtStrategy);
            saveDebtStrategyToStorage(data.settings.debtStrategy);
          }
          if (data.settings.debtExtraPayment !== undefined) {
            setDebtExtraPayment(data.settings.debtExtraPayment);
            saveExtraPaymentToStorage(data.settings.debtExtraPayment);
          }
          if (data.settings.dismissedRecurring && Array.isArray(data.settings.dismissedRecurring)) {
            setDismissedRecurring(data.settings.dismissedRecurring);
            saveDismissedRecurring(data.settings.dismissedRecurring);
          }
          if (data.settings.tabSettings && Array.isArray(data.settings.tabSettings)) {
            const merged = mergeTabOrder(data.settings.tabSettings);
            setTabCustomization(merged);
            saveTabCustomizationToStorage(merged);
          }
          if (data.settings.reportSettings && Array.isArray(data.settings.reportSettings)) {
            setReportSettings(data.settings.reportSettings);
            saveSelectedReports(data.settings.reportSettings);
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
          const user = session?.user || null;
          setAuthUser(user);
          
          // Set loading false as soon as we know the auth state, 
          // allowing the app to show cached data while syncing in background.
          setAuthLoading(false);

          if (user) {
            syncFromSupabase(); // Don't await here to avoid blocking UI
          }
        }
      } catch (err: any) {
        console.warn('Auth init error:', err);
        if (isMounted) setAuthLoading(false);
      } finally {
        if (isMounted) {
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

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      const user = session?.user || null;
      setAuthUser(user);
      if (user) {
        syncFromSupabase();
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

  // Auto-sync when switching tabs/apps or returning to mobile browser
  useEffect(() => {
    if (!authUser) return;

    let isThrottled = false;
    const triggerSync = () => {
      if (document.visibilityState === 'visible' && !isThrottled) {
        isThrottled = true;
        syncFromSupabase();
        setTimeout(() => {
          isThrottled = false;
        }, 6000);
      }
    };

    window.addEventListener('visibilitychange', triggerSync);
    window.addEventListener('focus', triggerSync);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncFromSupabase();
      }
    }, 45000);

    return () => {
      window.removeEventListener('visibilitychange', triggerSync);
      window.removeEventListener('focus', triggerSync);
      clearInterval(interval);
    };
  }, [authUser, syncFromSupabase]);

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

  // Recurring rules and exclusions state
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>(() => {
    try {
      const saved = localStorage.getItem('finance_app_recurring_rules');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [nonRecurringKeys, setNonRecurringKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('levlev_non_recurring_keys') || localStorage.getItem('finance_app_non_recurring_keys');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [recurringThresholds, setRecurringThresholds] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('finance_app_recurring_thresholds');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [globalRecurringThreshold, setGlobalRecurringThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('finance_app_global_recurring_threshold');
      return saved !== null ? Number(saved) : 15;
    } catch {
      return 15;
    }
  });

  // Trigger notifications
  useEffect(() => {
    if (!notificationsEnabled || permission !== 'granted') return;

    // Check anomalies
    const anomalies = detectFinancialAnomalies(transactions, displayCurrency, 1, 'ALL');
    anomalies.forEach(anomaly => {
        const key = `notified_anomaly_${anomaly.category}`;
        if (!localStorage.getItem(key)) {
            sendNotification('Anomaly Detected', `Category "${anomaly.category}" has unusual spending.`);
            localStorage.setItem(key, 'true');
        }
    });

    // Check budget caps
    budgets.forEach(budget => {
        const spent = transactions
            .filter(t => t.category === budget.category)
            .reduce((sum, t) => sum + t.amount, 0);
        
        if (spent > budget.monthlyLimitARS * 0.9) {
            const key = `notified_budget_${budget.category}`;
            if (!localStorage.getItem(key)) {
                sendNotification('Budget Alert', `You have spent over 90% of your ${budget.category} budget.`);
                localStorage.setItem(key, 'true');
            }
        }
    });
    
    // Check pending recurring
    const currentMonthKey = getCurrentMonthKey();
    const pendingResult = getPendingRecurringForMonth(currentMonthKey, transactions, recurringRules);
    pendingResult.pendingItems.forEach(item => {
        const key = `notified_recurring_${item.title}_${currentMonthKey}`;
        if (!localStorage.getItem(key)) {
             sendNotification('Missed Expense', `Expected recurring payment for "${item.title}" hasn't been recorded yet.`);
             localStorage.setItem(key, 'true');
        }
    });
    
    // Check credit card due dates
    const ccAccounts = accounts.filter(acc => isCreditCardAccount(acc.name, accounts));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    ccAccounts.forEach(acc => {
        const statements = getCreditCardStatements(transactions, acc.name, acc.closingRule, periodStatusOverrides);
        statements.forEach(stmt => {
            if (!stmt.isPaid && stmt.netDue > 0 && stmt.dueDate) {
                const due = new Date(stmt.dueDate + 'T00:00:00'); // parse safely
                due.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
                
                if (diffDays <= 5) {
                    const key = `notified_cc_due_${acc.name}_${stmt.closeDate}`;
                    if (!localStorage.getItem(key)) {
                        let daysText = '';
                        if (diffDays === 0) daysText = 'today';
                        else if (diffDays > 0) daysText = `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
                        else daysText = `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`;
                        
                        sendNotification('Credit Card Due', `Your ${acc.name} card has a balance due ${daysText}.`);
                        localStorage.setItem(key, 'true');
                    }
                }
            }
        });
    });

  }, [transactions, budgets, recurringRules, accounts, periodStatusOverrides, notificationsEnabled, permission]);

  const handleSaveRecurringThreshold = (title: string, threshold: number) => {
    setRecurringThresholds(prev => {
      const next = { ...prev, [title.toLowerCase().trim()]: threshold };
      try {
        localStorage.setItem('finance_app_recurring_thresholds', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleSaveGlobalRecurringThreshold = (threshold: number) => {
    setGlobalRecurringThreshold(threshold);
    try {
      localStorage.setItem('finance_app_global_recurring_threshold', String(threshold));
    } catch (e) {}
  };

  const handleSaveRecurringRule = (rule: RecurringRule) => {
    setRecurringRules(prev => {
      const exists = prev.some(r => r.id === rule.id);
      const next = exists ? prev.map(r => r.id === rule.id ? rule : r) : [...prev, rule];
      try {
        localStorage.setItem('finance_app_recurring_rules', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleDeleteRecurringRule = (ruleId: string) => {
    setRecurringRules(prev => {
      const next = prev.filter(r => r.id !== ruleId);
      try {
        localStorage.setItem('finance_app_recurring_rules', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleUpdateNonRecurringKeys = (keys: string[]) => {
    setNonRecurringKeys(keys);
    try {
      localStorage.setItem('levlev_non_recurring_keys', JSON.stringify(keys));
      localStorage.setItem('finance_app_non_recurring_keys', JSON.stringify(keys));
    } catch (e) {}
  };

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
          hiddenCategoryIds: Array.from(new Set([
            ...hiddenCategoryIds,
            ...categories.filter(c => c.isHiddenFromNewTx).map(c => c.id),
            ...categories.filter(c => c.isHiddenFromNewTx).map(c => c.name),
          ])),
          localCurrency,
          displayCurrency,
          enabledCurrencies,
          ccPeriodStatuses: periodStatusOverrides,
          customBalances,
          workspaceSharing: {
            isShared: isWorkspaceShared,
            members: workspaceMembers,
          },
          recurringThresholds,
          globalRecurringThreshold,
          debts,
          debtStrategy,
          debtExtraPayment,
          dismissedRecurring,
          tabSettings: tabCustomization,
          reportSettings,
        },
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [transactions, categories, accounts, budgets, periodStatusOverrides, customBalances, isWorkspaceShared, workspaceMembers, localCurrency, displayCurrency, enabledCurrencies, authUser, hasInitialSynced, recurringThresholds, globalRecurringThreshold, hiddenCategoryIds, debts, debtStrategy, debtExtraPayment, dismissedRecurring, tabCustomization, reportSettings]);

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
    const txArray = Array.isArray(newTx) ? newTx : [newTx];
    if (txArray.length === 0) return;

    const now = Date.now();
    // Guard against rapid duplicate submission of identical transactions
    const firstTx = txArray[0];
    const txHash = `${firstTx.title}|${firstTx.amount}|${firstTx.date}|${firstTx.account}|${firstTx.type}|${firstTx.currency}`;
    if (
      lastAddedTxRef.current &&
      lastAddedTxRef.current.txHash === txHash &&
      now - lastAddedTxRef.current.time < 2500
    ) {
      console.warn('Blocked rapid duplicate transaction submission:', txHash);
      return;
    }
    lastAddedTxRef.current = { txHash, time: now };

    setTransactions(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const filtered = txArray.filter(t => !existingIds.has(t.id));
      if (filtered.length === 0) return prev;
      const updated = [...filtered, ...prev];
      try {
        localStorage.setItem('finance_app_transactions', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
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
        isOnline={isOnline}
        tabCustomization={tabCustomization}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-8 max-w-full overflow-x-hidden">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-emerald-500/50" />
            <p className="text-sm font-medium animate-pulse">Loading view...</p>
          </div>
        }>
          {currentTab === 'overview' && (
            <OverviewTab
              transactions={transactions}
              displayCurrency={displayCurrency}
              usdArsRate={usdArsRate}
              historyData={historyData}
              recurringRules={recurringRules}
              nonRecurringKeys={nonRecurringKeys}
              accountList={accounts}
              periodStatusOverrides={periodStatusOverrides}
              customBalances={customBalances}
              onNavigateTab={setCurrentTab}
              onNavigateToTransactionsWithFilter={handleNavigateToTransactionsWithFilter}
              currentUserId={authUser?.id}
              showSharedData={showSharedData}
              userTimezone={userTimezone}
              recurringThresholds={recurringThresholds}
              globalRecurringThreshold={globalRecurringThreshold}
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
              onReorderAccounts={handleReorderAccounts}
              currentUserId={authUser?.id}
              showSharedData={showSharedData}
              userTimezone={userTimezone}
            />
          )}
          {currentTab === 'reports' && (
            <ReportsTab
              transactions={transactions}
              displayCurrency={displayCurrency}
              localCurrency={localCurrency}
              enabledCurrencies={enabledCurrencies}
              usdArsRate={usdArsRate}
              recurringRules={recurringRules}
              nonRecurringKeys={nonRecurringKeys}
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
              historyData={historyData}
              onNavigateToTransactionsWithFilter={handleNavigateToTransactionsWithFilter}
              onEditTransaction={handleEditTransaction}
            />
          )}
          {currentTab === 'recurring' && (
            <RecurringTab
              transactions={transactions}
              recurringRules={recurringRules}
              onSaveRecurringRule={handleSaveRecurringRule}
              onDeleteRecurringRule={handleDeleteRecurringRule}
              nonRecurringKeys={nonRecurringKeys}
              onUpdateNonRecurringKeys={handleUpdateNonRecurringKeys}
              displayCurrency={displayCurrency}
              usdArsRate={usdArsRate}
              historyData={historyData}
              accountsList={accounts}
              categoriesList={categories}
              recurringThresholds={recurringThresholds}
              globalRecurringThreshold={globalRecurringThreshold}
              onSaveRecurringThreshold={handleSaveRecurringThreshold}
              onSaveGlobalRecurringThreshold={handleSaveGlobalRecurringThreshold}
            />
          )}
          {currentTab === 'debt-payoff' && (
            <DebtPayoffTab
              displayCurrency={displayCurrency}
              usdArsRate={usdArsRate}
              currentUserId={authUser?.id}
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
              displayCurrency={displayCurrency}
              onUpdateDisplayCurrency={setDisplayCurrency}
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
              localCurrency={localCurrency}
              onUpdateLocalCurrency={setLocalCurrency}
              enabledCurrencies={enabledCurrencies}
              onUpdateEnabledCurrencies={setEnabledCurrencies}
              notificationsEnabled={notificationsEnabled}
              onToggleNotifications={() => {
                const newValue = !notificationsEnabled;
                setNotificationsEnabled(newValue);
                localStorage.setItem('finance_app_notifications_enabled', String(newValue));
              }}
              requestNotificationPermission={requestPermission}
              hiddenCategoryIds={hiddenCategoryIds}
              onUpdateHiddenCategoryIds={setHiddenCategoryIds}
              tabCustomization={tabCustomization}
              onUpdateTabCustomization={(tabs) => {
                setTabCustomization(tabs);
                saveTabCustomizationToStorage(tabs);
              }}
            />
          )}
        </Suspense>
      </main>

      <Suspense fallback={null}>
        {isAddModalOpen && (
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
            categoriesList={categories}
            existingAccounts={accounts.map(a => a.name)}
            existingCategories={categories.map(c => c.name)}
            existingTransactions={transactions}
            onAddCategory={handleAddCategory}
            onAddAccount={handleAddAccount}
            usdArsRate={usdArsRate}
            enabledCurrencies={enabledCurrencies}
            localCurrency={localCurrency}
          />
        )}

        {isImportModalOpen && (
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
        )}

        {isDeleteModalOpen && (
          <ConfirmDeleteModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirmDeleteAll={handleDeleteAllData}
          />
        )}

        {isShareWorkspaceModalOpen && (
          <ShareWorkspaceModal
            isOpen={isShareWorkspaceModalOpen}
            onClose={() => setIsShareWorkspaceModalOpen(false)}
            isWorkspaceShared={isWorkspaceShared}
            workspaceMembers={workspaceMembers}
            onUpdateWorkspaceSharing={handleUpdateWorkspaceSharing}
          />
        )}

        <AiChatWidget
          transactions={transactions}
          displayCurrency={displayCurrency}
          usdArsRate={usdArsRate}
        />

        <OnboardingTour 
          hasExistingData={transactions.length > 0 || accounts.some(a => (a.initialBalance || 0) > 0)}
        />
        <ReloadPrompt />
      </Suspense>
    </div>
  );
}
