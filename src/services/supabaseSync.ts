import { getSupabaseClient } from '../lib/supabase';
import { Transaction, CategoryItem, AccountItem, BudgetGoal, CreditCardClosingRule, AccountCustomBalance, SharedMember, RecurringRule, DebtItem, DebtPayoffStrategy, TabCustomizationItem } from '../types';

const DELETED_TX_KEY = 'finance_app_deleted_tx_ids';

export function getDeletedTxIds(): Set<string> {
  try {
    const saved = localStorage.getItem(DELETED_TX_KEY);
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {}
  return new Set();
}

export function addDeletedTxIds(ids: string[]) {
  try {
    const current = getDeletedTxIds();
    ids.forEach(id => {
      if (id) {
        current.add(id);
        // Also strip user_id prefix if present, or add with prefix
        const cleanId = id.includes('_') ? id.split('_').slice(1).join('_') : id;
        current.add(cleanId);
      }
    });
    localStorage.setItem(DELETED_TX_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {}
}

export function removeDeletedTxIds(ids: string[]) {
  try {
    const current = getDeletedTxIds();
    ids.forEach(id => {
      current.delete(id);
      const cleanId = id.includes('_') ? id.split('_').slice(1).join('_') : id;
      current.delete(cleanId);
    });
    localStorage.setItem(DELETED_TX_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {}
}

export interface SupabaseUserData {
  transactions: Transaction[];
  categories: CategoryItem[];
  accounts: AccountItem[];
  budgets: BudgetGoal[];
  recurringRules?: RecurringRule[];
  nonRecurringKeys?: string[];
  settings?: {
    ccRulesMap?: Record<string, CreditCardClosingRule>;
    ccMap?: Record<string, boolean>;
    ccPeriodStatuses?: Record<string, 'PAID' | 'OPEN'>;
    customBalances?: Record<string, AccountCustomBalance>;
    accountConfigs?: Record<string, { order?: number; isHiddenFromNewTx?: boolean; icon?: any }>;
    accountsList?: AccountItem[];
    categoryConfigs?: Record<string, { isHiddenFromNewTx?: boolean; color?: string; type?: string }>;
    categoriesList?: CategoryItem[];
    hiddenCategoryIds?: string[];
    recurringRules?: RecurringRule[];
    nonRecurringKeys?: string[];
    onboardingCompleted?: boolean;
    localCurrency?: string;
    displayCurrency?: string;
    enabledCurrencies?: string[];
    workspaceSharing?: {
      isShared?: boolean;
      members?: SharedMember[];
    };
    recurringThresholds?: Record<string, number>;
    globalRecurringThreshold?: number;
    debts?: DebtItem[];
    debtStrategy?: DebtPayoffStrategy;
    debtExtraPayment?: number;
    dismissedRecurring?: string[];
    tabSettings?: TabCustomizationItem[];
    reportSettings?: string[];
  };
}

export async function fetchUserDataFromSupabase(): Promise<SupabaseUserData | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data: { session } } = await client.auth.getSession();
  if (!session?.user) return null;

  const userId = session.user.id;

  try {
    const [catRes, accRes, budRes, setRes, txResFirstPage] = await Promise.all([
      client.from('categories').select('*'),
      client.from('accounts').select('*'),
      client.from('budgets').select('*'),
      client.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
      client.from('transactions').select('*').order('date', { ascending: false }).range(0, 999),
    ]);

    if (catRes.error) console.warn('Supabase fetch categories error:', catRes.error);
    if (accRes.error) console.warn('Supabase fetch accounts error:', accRes.error);
    if (budRes.error) console.warn('Supabase fetch budgets error:', budRes.error);

    let userSettings: SupabaseUserData['settings'] = undefined;
    if (setRes && setRes.data && setRes.data.settings) {
      try {
        userSettings = typeof setRes.data.settings === 'string'
          ? JSON.parse(setRes.data.settings)
          : setRes.data.settings;
      } catch (e) {
        console.warn('Error parsing user_settings from Supabase:', e);
      }
    }

    const ccRulesMap = userSettings?.ccRulesMap || {};
    const ccMap = userSettings?.ccMap || {};
    const accountConfigs = userSettings?.accountConfigs || {};
    const categoryConfigs = userSettings?.categoryConfigs || {};
    const hiddenCategoryIds: string[] = Array.isArray(userSettings?.hiddenCategoryIds) ? userSettings.hiddenCategoryIds : [];

    // Handle transactions (first page already fetched)
    let rawTxRows: any[] = txResFirstPage.data || [];
    if (txResFirstPage.error) console.warn('Supabase fetch transactions error:', txResFirstPage.error);

    if (txResFirstPage.data && txResFirstPage.data.length === 1000) {
      let page = 1;
      const pageSize = 1000;
      let keepGoing = true;

      while (keepGoing) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const txRes = await client
          .from('transactions')
          .select('*')
          .order('date', { ascending: false })
          .range(from, to);

        if (txRes.error) {
          console.warn('Supabase fetch transactions range error:', txRes.error);
          break;
        }

        if (txRes.data && txRes.data.length > 0) {
          rawTxRows = rawTxRows.concat(txRes.data);
          if (txRes.data.length < pageSize) {
            keepGoing = false;
          } else {
            page++;
          }
        } else {
          keepGoing = false;
        }
      }
    }

    const deletedIds = getDeletedTxIds();
    const transactions: Transaction[] = rawTxRows
      .filter((row: any) => {
        const rowId = row.id || '';
        const cleanId = rowId.includes('_') ? rowId.split('_').slice(1).join('_') : rowId;
        return !deletedIds.has(rowId) && !deletedIds.has(cleanId);
      })
      .map((row: any) => {
        const tAccount = row.user_id !== userId ? `${row.account || 'Main'} (Shared)` : (row.account || 'Main');
        const tToAccount = row.to_account ? (row.user_id !== userId ? `${row.to_account} (Shared)` : row.to_account) : undefined;
        
        let finalInstallments = row.installments ? String(row.installments) : undefined;
        if (row.installment_number && row.total_installments) {
          finalInstallments = `${row.installment_number}/${row.total_installments}`;
        }
        
        return {
          id: row.id || `tx-${Math.random().toString(36).substring(2)}`,
          ownerId: row.user_id,
          date: row.date || new Date().toISOString().substring(0, 10),
          title: row.title || 'Untitled',
          amount: Number(row.amount) || 0,
          currency: row.currency || 'ARS',
          category: row.category || 'General',
          account: tAccount,
          type: row.type || 'EXPENSE',
          toAccount: tToAccount,
          installments: finalInstallments,
          installmentNumber: row.installment_number ? Number(row.installment_number) : undefined,
          totalInstallments: row.total_installments ? Number(row.total_installments) : undefined,
          statementCloseDate: row.statement_close_date || undefined,
          transferAmount: row.transfer_amount !== undefined && row.transfer_amount !== null ? Number(row.transfer_amount) : (row.type === 'TRANSFER' ? Number(row.amount) : undefined),
          transferCurrency: row.transfer_currency || (row.type === 'TRANSFER' ? row.currency : undefined),
          receiveAmount: row.receive_amount !== undefined && row.receive_amount !== null ? Number(row.receive_amount) : undefined,
          receiveCurrency: row.receive_currency || undefined,
          description: row.notes || undefined,
        };
      });

    const categories: CategoryItem[] = (catRes.data || []).map((row: any) => {
      const config = categoryConfigs[row.name] ||
                     categoryConfigs[row.name.toLowerCase()] ||
                     {};

      let isHidden: boolean | undefined = undefined;
      if (hiddenCategoryIds.includes(row.id) || hiddenCategoryIds.includes(row.name)) {
        isHidden = true;
      } else if (row.is_hidden_from_new_tx !== undefined && row.is_hidden_from_new_tx !== null) {
        isHidden = !!row.is_hidden_from_new_tx;
      } else if (row.is_hidden !== undefined && row.is_hidden !== null) {
        isHidden = !!row.is_hidden;
      } else if (config.isHiddenFromNewTx !== undefined) {
        isHidden = !!config.isHiddenFromNewTx;
      }

      return {
        id: row.id || `cat-${Math.random().toString(36).substring(2)}`,
        ownerId: row.user_id,
        name: row.name || 'Category',
        type: row.type || 'BOTH',
        description: row.color || '#64748b',
        isHiddenFromNewTx: isHidden,
      };
    });

    // Merge high-fidelity categoriesList from user_settings if present
    const existingCategoryNames = new Set(categories.map(c => c.name.toLowerCase()));
    if (Array.isArray(userSettings?.categoriesList) && userSettings.categoriesList.length > 0) {
      userSettings.categoriesList.forEach((savedCat) => {
        const lowerName = (savedCat.name || '').toLowerCase();
        const found = categories.find(c => c.name.toLowerCase() === lowerName);
        const isHiddenInArray = hiddenCategoryIds.includes(savedCat.id) || hiddenCategoryIds.includes(savedCat.name);
        if (found) {
          if (isHiddenInArray) {
            found.isHiddenFromNewTx = true;
          } else if (savedCat.isHiddenFromNewTx !== undefined) {
            found.isHiddenFromNewTx = savedCat.isHiddenFromNewTx;
          }
          if (savedCat.type) found.type = savedCat.type;
          if (savedCat.description && (!found.description || found.description === '#64748b')) {
            found.description = savedCat.description;
          }
        } else if (savedCat.name) {
          categories.push({
            ...savedCat,
            isHiddenFromNewTx: isHiddenInArray ? true : savedCat.isHiddenFromNewTx,
          });
          existingCategoryNames.add(lowerName);
        }
      });
    }

    // Also include categories that might only exist in categoryConfigs
    Object.entries(categoryConfigs).forEach(([name, config]) => {
      const lowerName = name.toLowerCase();
      if (!existingCategoryNames.has(lowerName)) {
        const isHiddenInArray = hiddenCategoryIds.includes(name);
        categories.push({
          id: `cat-cfg-${Math.random().toString(36).substring(2)}`,
          ownerId: userId,
          name: name,
          type: (config.type as any) || 'EXPENSE',
          description: config.color || '#64748b',
          isHiddenFromNewTx: isHiddenInArray || !!config.isHiddenFromNewTx,
        });
        existingCategoryNames.add(lowerName);
      }
    });

    const accounts: AccountItem[] = (accRes.data || []).map((row: any) => {
      let closingRule: CreditCardClosingRule | undefined = undefined;
      if (row.closing_rule) {
        try {
          closingRule = typeof row.closing_rule === 'string' ? JSON.parse(row.closing_rule) : row.closing_rule;
        } catch (e) {
          console.warn('Error parsing closing_rule on account row:', e);
        }
      }
      if (!closingRule && ccRulesMap[row.name]) {
        closingRule = ccRulesMap[row.name];
      }

      let accType = row.type || 'CHECKING';
      if (ccMap[row.name] !== undefined) {
        if (ccMap[row.name] === true) {
          accType = 'CREDIT_CARD';
        } else if (ccMap[row.name] === false && accType === 'CREDIT_CARD') {
          accType = 'CHECKING';
        }
      }

      const config = accountConfigs[row.name] || 
                     accountConfigs[row.name.replace(' (Shared)', '')] || 
                     accountConfigs[row.name.toLowerCase()] ||
                     accountConfigs[row.name.replace(' (Shared)', '').toLowerCase()] ||
                     {};

      return {
        id: row.id || `acc-${Math.random().toString(36).substring(2)}`,
        ownerId: row.user_id,
        name: row.user_id !== userId ? `${row.name || 'Account'} (Shared)` : (row.name || 'Account'),
        type: accType,
        currency: row.currency || 'ARS',
        initialBalance: (row.initial_balance !== undefined && row.initial_balance !== null) ? Number(row.initial_balance) : 0,
        isShared: row.is_shared || false,
        sharedMembers: Array.isArray(row.shared_members) ? row.shared_members : [],
        closingRule,
        order: typeof config.order === 'number' ? config.order : undefined,
        isHiddenFromNewTx: !!config.isHiddenFromNewTx,
        icon: config.icon,
      };
    });

    // Also include accounts that might only exist in accountConfigs or accountsList
    const existingAccountNames = new Set(accounts.map(a => a.name.toLowerCase()));
    const existingCleanNames = new Set(accounts.map(a => a.name.replace(' (Shared)', '').toLowerCase()));

    // 1. Merge high-fidelity accountsList from user_settings if present
    if (Array.isArray(userSettings?.accountsList) && userSettings.accountsList.length > 0) {
      userSettings.accountsList.forEach((savedAcc, idx) => {
        const lowerName = savedAcc.name.toLowerCase();
        const found = accounts.find(a => a.name.toLowerCase() === lowerName || a.name.replace(' (Shared)', '').toLowerCase() === lowerName);
        if (found) {
          found.order = savedAcc.order !== undefined ? savedAcc.order : idx;
          if (savedAcc.isHiddenFromNewTx !== undefined) found.isHiddenFromNewTx = savedAcc.isHiddenFromNewTx;
          if (savedAcc.icon) found.icon = savedAcc.icon;
          if (savedAcc.type) found.type = savedAcc.type;
          if (savedAcc.closingRule) found.closingRule = savedAcc.closingRule;
          if (savedAcc.initialBalance !== undefined && found.initialBalance === 0) found.initialBalance = savedAcc.initialBalance;
        } else {
          accounts.push({
            ...savedAcc,
            order: savedAcc.order !== undefined ? savedAcc.order : idx,
          });
          existingAccountNames.add(lowerName);
        }
      });
    }

    // 2. Also include accounts that might only exist in accountConfigs (e.g. auto-detected from transactions)
    Object.entries(accountConfigs).forEach(([name, config]) => {
      const lowerName = name.toLowerCase();
      if (!existingAccountNames.has(lowerName) && !existingCleanNames.has(lowerName)) {
        accounts.push({
          id: `acc-cfg-${Math.random().toString(36).substring(2)}`,
          ownerId: userId,
          name: name,
          type: 'CHECKING',
          currency: 'ARS',
          initialBalance: 0,
          order: typeof config.order === 'number' ? config.order : undefined,
          isHiddenFromNewTx: !!config.isHiddenFromNewTx,
          icon: config.icon,
        });
      }
    });

    // Sort accounts by order if available
    accounts.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    const budgets: BudgetGoal[] = (budRes.data || []).map((row: any) => ({
      ownerId: row.user_id,
      category: row.category || 'General',
      monthlyLimitARS: Number(row.monthly_limit) || 0,
    }));

    const recurringRules: RecurringRule[] = Array.isArray(userSettings?.recurringRules) ? userSettings.recurringRules : [];
    const nonRecurringKeys: string[] = Array.isArray(userSettings?.nonRecurringKeys) ? userSettings.nonRecurringKeys : [];

    return { transactions, categories, accounts, budgets, recurringRules, nonRecurringKeys, settings: userSettings };
  } catch (err) {
    console.error('Error fetching data from Supabase:', err);
    return null;
  }
}

export async function saveAllUserDataToSupabase(data: SupabaseUserData): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { data: { session } } = await client.auth.getSession();
  if (!session?.user) return false;

  const userId = session.user.id;

  try {
    // Helper to preserve shared row IDs and user_ids
    const resolveSyncId = (itemId: string | undefined | null, currentUserId: string, ownerHint?: string) => {
      if (!itemId) {
        const owner = ownerHint || currentUserId;
        return { id: `${owner}_${Math.random().toString(36).substring(2)}`, userId: owner };
      }
      if (itemId.includes('_')) {
        const parts = itemId.split('_');
        if (parts[0].length === 36) {
          // Looks like a valid UUID prefix
          return { id: itemId, userId: parts[0] };
        }
      }
      const owner = ownerHint || currentUserId;
      return { id: `${owner}_${itemId}`, userId: owner };
    };

    const accountOwnerMap: Record<string, string> = {};
    let firstForeignOwner: string | undefined = undefined;
    (data.accounts || []).forEach(a => {
      if (a.id && a.id.includes('_')) {
        const parts = a.id.split('_');
        if (parts[0].length === 36) {
          accountOwnerMap[a.name] = parts[0];
          if (parts[0] !== userId && !firstForeignOwner) {
            firstForeignOwner = parts[0];
          }
        }
      }
    });

    // 1. Transactions upsert or clear in batches of 500
    if (data.transactions && data.transactions.length > 0) {
      const txRows = data.transactions.map(t => {
        const ownerHint = (t.account ? accountOwnerMap[t.account] : undefined) || firstForeignOwner;
        const { id: rowId, userId: targetUserId } = resolveSyncId(t.id, userId, ownerHint);
        
        let safeInstallmentNum: number | null = t.installmentNumber || null;
        let safeTotalInstallments: number | null = t.totalInstallments || null;
        let safeInstallments: number | null = null;

        if (typeof t.installments === 'string' && t.installments.includes('/')) {
          const parts = t.installments.split('/');
          if (safeInstallmentNum === null) {
            const n = parseInt(parts[0], 10);
            if (!isNaN(n)) safeInstallmentNum = n;
          }
          if (safeTotalInstallments === null) {
            const total = parseInt(parts[1], 10);
            if (!isNaN(total)) safeTotalInstallments = total;
          }
        } else if (typeof t.installments === 'string') {
           const num = parseInt(t.installments, 10);
           safeInstallments = !isNaN(num) ? num : null;
        } else if (typeof t.installments === 'number') {
           safeInstallments = t.installments;
        }
        
        // Use totalInstallments as the legacy "installments" column value for backwards compatibility
        const finalLegacyInstallments = safeTotalInstallments !== null ? safeTotalInstallments : safeInstallments;

        const rawAmount = (t.amount !== undefined && t.amount !== null && t.amount > 0) ? t.amount : ((t.transferAmount && t.transferAmount > 0) ? t.transferAmount : (t.amount || 0));
        const cleanAmount = Math.round(rawAmount * 100) / 100;
        const cleanAccount = t.account ? t.account.replace(' (Shared)', '') : 'Main';
        const cleanToAccount = t.toAccount ? t.toAccount.replace(' (Shared)', '') : null;

        return {
          id: rowId,
          user_id: targetUserId,
          date: t.date,
          title: t.title,
          amount: cleanAmount,
          currency: t.currency || 'ARS',
          category: t.category || 'General',
          account: cleanAccount,
          type: t.type,
          to_account: cleanToAccount,
          installments: finalLegacyInstallments,
          installment_number: safeInstallmentNum,
          total_installments: safeTotalInstallments,
          statement_close_date: t.statementCloseDate || null,
          transfer_amount: t.transferAmount !== undefined && t.transferAmount !== null ? Math.round(t.transferAmount * 100) / 100 : null,
          transfer_currency: t.transferCurrency || null,
          receive_amount: t.receiveAmount !== undefined && t.receiveAmount !== null ? Math.round(t.receiveAmount * 100) / 100 : null,
          receive_currency: t.receiveCurrency || null,
          notes: t.description || null,
        };
      });

      const batchSize = 500;
      for (let i = 0; i < txRows.length; i += batchSize) {
        const batch = txRows.slice(i, i + batchSize);
        const { error: txErr } = await client.from('transactions').upsert(batch, { onConflict: 'id' });
        if (txErr) {
          console.error(`Error upserting transactions batch ${i} to Supabase:`, txErr);
          // Fallback retry stripping transfer_amount/transfer_currency if column missing in DB schema cache
          if (txErr.code === 'PGRST204' || txErr.message?.includes('transfer_amount') || txErr.message?.includes('transfer_currency')) {
            const fallbackBatch = batch.map(({ transfer_amount, transfer_currency, ...rest }) => rest);
            const { error: fbErr } = await client.from('transactions').upsert(fallbackBatch, { onConflict: 'id' });
            if (fbErr) {
              console.error(`Fallback transactions batch ${i} error:`, fbErr);
            }
          }
        }
      }
    } else if (data.transactions && data.transactions.length === 0) {
      const { error: delTxErr } = await client.from('transactions').delete().eq('user_id', userId);
      if (delTxErr) console.error('Error clearing transactions in Supabase:', delTxErr);
    }

    // 2. Categories upsert
    if (data.categories && data.categories.length > 0) {
      const catRows = data.categories.map(c => {
        const { id: rowId, userId: targetUserId } = resolveSyncId(c.id, userId, firstForeignOwner);
        return {
          id: rowId,
          user_id: targetUserId,
          name: c.name,
          type: c.type || 'BOTH',
          color: c.description || '#64748b',
          is_hidden_from_new_tx: !!c.isHiddenFromNewTx,
        };
      });

      const { error: catErr } = await client.from('categories').upsert(catRows, { onConflict: 'id' });
      if (catErr) {
        console.error('Error upserting categories to Supabase:', catErr);
        // Fallback retry if is_hidden_from_new_tx column does not exist in target database schema
        if (catErr.code === 'PGRST204' || catErr.message?.includes('is_hidden_from_new_tx')) {
          const fallbackCatRows = catRows.map(({ is_hidden_from_new_tx, ...rest }) => rest);
          const { error: fbCatErr } = await client.from('categories').upsert(fallbackCatRows, { onConflict: 'id' });
          if (fbCatErr) console.error('Fallback categories upsert error:', fbCatErr);
        }
      }
    }

    // 3. Accounts upsert
    if (data.accounts && data.accounts.length > 0) {
      const accRows = data.accounts.map(a => {
        const { id: rowId, userId: targetUserId } = resolveSyncId(a.id, userId, firstForeignOwner);
        const cleanName = a.name ? a.name.replace(' (Shared)', '') : 'Account';
        return {
          id: rowId,
          user_id: targetUserId,
          name: cleanName,
          type: a.type || 'CHECKING',
          currency: a.currency || 'ARS',
          initial_balance: a.initialBalance || 0,
          is_shared: a.isShared || false,
          shared_members: a.sharedMembers || [],
          closing_rule: a.closingRule ? a.closingRule : null,
        };
      });

      const { error: accErr } = await client.from('accounts').upsert(accRows, { onConflict: 'id' });
      if (accErr) {
        console.error('Error upserting accounts to Supabase:', accErr);
        // Fallback if closing_rule, is_shared, or shared_members columns do not exist in target database
        if (accErr.code === 'PGRST204' || accErr.message?.includes('closing_rule') || accErr.message?.includes('is_shared') || accErr.message?.includes('shared_members')) {
          const fallbackAccRows = accRows.map(({ closing_rule, is_shared, shared_members, ...rest }) => rest);
          const { error: fbAccErr } = await client.from('accounts').upsert(fallbackAccRows, { onConflict: 'id' });
          if (fbAccErr) console.error('Fallback accounts upsert error:', fbAccErr);
        }
      }
    }

    // 4. Budgets upsert or clear
    if (data.budgets && data.budgets.length > 0) {
      const budRows = data.budgets.map(b => {
        const targetUserId = firstForeignOwner || userId;
        return {
          id: `${targetUserId}_${b.category}`,
          user_id: targetUserId,
          category: b.category,
          monthly_limit: b.monthlyLimitARS,
          currency: 'ARS',
        };
      });

      const { error: budErr } = await client.from('budgets').upsert(budRows, { onConflict: 'id' });
      if (budErr) console.error('Error upserting budgets to Supabase:', budErr);
    } else if (data.budgets && data.budgets.length === 0) {
      const { error: delBudErr } = await client.from('budgets').delete().eq('user_id', userId);
      if (delBudErr) console.error('Error clearing budgets in Supabase:', delBudErr);
    }

    // 5. User Settings upsert (CC Rules, CC Classification map, Period Statuses, Custom Balances, Account Configs, Category Configs)
    const ccRulesMapFromAccs: Record<string, CreditCardClosingRule> = {};
    const ccMapFromAccs: Record<string, boolean> = {};
    const accountConfigs: Record<string, { order?: number; isHiddenFromNewTx?: boolean; icon?: any }> = {
      ...(data.settings?.accountConfigs || {})
    };

    (data.accounts || []).forEach((a, idx) => {
      if (a.closingRule) {
        ccRulesMapFromAccs[a.name] = a.closingRule;
      }
      ccMapFromAccs[a.name] = a.type === 'CREDIT_CARD';
      
      const cleanName = a.name.replace(' (Shared)', '');
      const itemConfig = {
        order: a.order !== undefined ? a.order : idx,
        isHiddenFromNewTx: !!a.isHiddenFromNewTx,
        icon: a.icon
      };
      accountConfigs[cleanName] = itemConfig;
      accountConfigs[cleanName.toLowerCase()] = itemConfig;
      if (a.name !== cleanName) {
        accountConfigs[a.name] = itemConfig;
        accountConfigs[a.name.toLowerCase()] = itemConfig;
      }
    });

    const categoryConfigs: Record<string, { isHiddenFromNewTx?: boolean; color?: string; type?: string }> = {
      ...(data.settings?.categoryConfigs || {})
    };

    (data.categories || []).forEach(c => {
      const itemConfig = {
        isHiddenFromNewTx: !!c.isHiddenFromNewTx,
        color: c.description,
        type: c.type,
      };
      categoryConfigs[c.name] = itemConfig;
      categoryConfigs[c.name.toLowerCase()] = itemConfig;
    });

    const isTourCompleted = data.settings?.onboardingCompleted ?? (
      typeof window !== 'undefined' && (
        localStorage.getItem('levlev_onboarding_completed') === 'true' ||
        localStorage.getItem('finlev_onboarding_completed') === 'true' ||
        localStorage.getItem('finance_app_onboarding_completed') === 'true' ||
        (data.transactions && data.transactions.length > 0)
      )
    );

    const settingsObj = {
      ccRulesMap: { ...ccRulesMapFromAccs, ...(data.settings?.ccRulesMap || {}) },
      ccMap: { ...ccMapFromAccs, ...(data.settings?.ccMap || {}) },
      ccPeriodStatuses: data.settings?.ccPeriodStatuses || {},
      customBalances: data.settings?.customBalances || {},
      workspaceSharing: data.settings?.workspaceSharing || {},
      accountConfigs: accountConfigs,
      accountsList: data.accounts || [],
      categoryConfigs: categoryConfigs,
      categoriesList: data.categories || [],
      hiddenCategoryIds: data.settings?.hiddenCategoryIds || (data.categories || []).filter(c => c.isHiddenFromNewTx).map(c => c.id || c.name),
      recurringRules: data.recurringRules || data.settings?.recurringRules || [],
      nonRecurringKeys: data.nonRecurringKeys || data.settings?.nonRecurringKeys || [],
      onboardingCompleted: !!isTourCompleted,
      localCurrency: data.settings?.localCurrency || (typeof window !== 'undefined' ? localStorage.getItem('finance_app_local_currency') || undefined : undefined),
      displayCurrency: data.settings?.displayCurrency || (typeof window !== 'undefined' ? localStorage.getItem('finance_app_display_currency') || undefined : undefined),
      enabledCurrencies: data.settings?.enabledCurrencies || (typeof window !== 'undefined' ? (() => {
        try {
          const s = localStorage.getItem('finance_app_enabled_currencies');
          return s ? JSON.parse(s) : undefined;
        } catch { return undefined; }
      })() : undefined),
      debts: data.settings?.debts || (typeof window !== 'undefined' ? (() => {
        try {
          const raw = localStorage.getItem('levlev_debts_list') || localStorage.getItem('finance_app_debts');
          return raw ? JSON.parse(raw) : undefined;
        } catch { return undefined; }
      })() : undefined),
      debtStrategy: data.settings?.debtStrategy || (typeof window !== 'undefined' ? localStorage.getItem('levlev_debt_strategy') || undefined : undefined),
      debtExtraPayment: data.settings?.debtExtraPayment !== undefined ? data.settings.debtExtraPayment : (typeof window !== 'undefined' ? (() => {
        const raw = localStorage.getItem('levlev_debt_extra_payment');
        return raw !== null ? parseFloat(raw) : undefined;
      })() : undefined),
      dismissedRecurring: data.settings?.dismissedRecurring || (typeof window !== 'undefined' ? (() => {
        try {
          const raw = localStorage.getItem('levlev_dismissed_recurring') || localStorage.getItem('finance_app_dismissed_recurring');
          return raw ? JSON.parse(raw) : undefined;
        } catch { return undefined; }
      })() : undefined),
      tabSettings: data.settings?.tabSettings || (typeof window !== 'undefined' ? (() => {
        try {
          const raw = localStorage.getItem('finance_app_tab_customization') || localStorage.getItem('levlev_tab_customization');
          return raw ? JSON.parse(raw) : undefined;
        } catch { return undefined; }
      })() : undefined),
      reportSettings: data.settings?.reportSettings || (typeof window !== 'undefined' ? (() => {
        try {
          const raw = localStorage.getItem('finance_app_selected_reports') || localStorage.getItem('levlev_selected_reports');
          return raw ? JSON.parse(raw) : undefined;
        } catch { return undefined; }
      })() : undefined),
    };

    try {
      const { error: setErr } = await client.from('user_settings').upsert({
        id: `${userId}_settings`,
        user_id: userId,
        settings: settingsObj,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (setErr) {
        console.warn('User settings sync note (user_settings table):', setErr.message);
      }
    } catch (e) {
      console.warn('user_settings table sync catch:', e);
    }

    // 6. Purge any pending cached deleted transactions in Supabase
    const pendingDeleted = getDeletedTxIds();
    if (pendingDeleted.size > 0) {
      const pendingIds = Array.from(pendingDeleted);
      const queryIds: string[] = [];
      pendingIds.forEach(id => {
        queryIds.push(id);
        if (!id.startsWith(userId)) queryIds.push(`${userId}_${id}`);
      });
      const { error: delErr } = await client.from('transactions').delete().in('id', queryIds);
      if (!delErr) {
        removeDeletedTxIds(pendingIds);
      }
    }

    return true;
  } catch (err) {
    console.error('Error syncing data to Supabase:', err);
    return false;
  }
}

export async function deleteTransactionFromSupabase(txId: string | string[]): Promise<boolean> {
  const idsArr = Array.isArray(txId) ? txId : [txId];
  if (idsArr.length === 0) return true;

  addDeletedTxIds(idsArr);

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return true;

    const userId = session.user.id;
    const queryIds: string[] = [];
    idsArr.forEach(id => {
      queryIds.push(id);
      if (!id.startsWith(userId)) {
        queryIds.push(`${userId}_${id}`);
      }
    });

    const { error } = await client
      .from('transactions')
      .delete()
      .in('id', queryIds);

    if (error) {
      console.error('Error deleting transaction from Supabase:', error);
      return false;
    }

    removeDeletedTxIds(idsArr);
    return true;
  } catch (e) {
    console.error('Exception deleting transaction from Supabase:', e);
    return false;
  }
}

export async function deleteCategoryFromSupabase(catName: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return false;

    const cleanName = catName ? catName.replace(' (Shared)', '') : catName;

    const { error } = await client
      .from('categories')
      .delete()
      .eq('name', cleanName);
    if (error) {
      console.error('Error deleting category from Supabase:', error);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteAccountFromSupabase(accName: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return false;

    const cleanName = accName ? accName.replace(' (Shared)', '') : accName;

    const { error } = await client
      .from('accounts')
      .delete()
      .eq('name', cleanName);
    if (error) {
      console.error('Error deleting account from Supabase:', error);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteAllUserDataFromSupabase(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return false;

    const userId = session.user.id;

    const [txDel, budDel, catDel, accDel] = await Promise.all([
      client.from('transactions').delete().eq('user_id', userId),
      client.from('budgets').delete().eq('user_id', userId),
      client.from('categories').delete().eq('user_id', userId),
      client.from('accounts').delete().eq('user_id', userId),
    ]);

    if (txDel.error) console.error('Error deleting transactions from Supabase:', txDel.error);
    if (budDel.error) console.error('Error deleting budgets from Supabase:', budDel.error);
    if (catDel.error) console.error('Error deleting categories from Supabase:', catDel.error);
    if (accDel.error) console.error('Error deleting accounts from Supabase:', accDel.error);

    return true;
  } catch (err) {
    console.error('Error deleting user data from Supabase:', err);
    return false;
  }
}
