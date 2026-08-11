import { getSupabaseClient } from '../lib/supabase';
import { Transaction, CategoryItem, AccountItem, BudgetGoal, CreditCardClosingRule, AccountCustomBalance, SharedMember } from '../types';

export interface SupabaseUserData {
  transactions: Transaction[];
  categories: CategoryItem[];
  accounts: AccountItem[];
  budgets: BudgetGoal[];
  settings?: {
    ccRulesMap?: Record<string, CreditCardClosingRule>;
    ccMap?: Record<string, boolean>;
    ccPeriodStatuses?: Record<string, 'PAID' | 'OPEN'>;
    customBalances?: Record<string, AccountCustomBalance>;
    workspaceSharing?: {
      isShared?: boolean;
      members?: SharedMember[];
    };
  };
}

export async function fetchUserDataFromSupabase(): Promise<SupabaseUserData | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data: { session } } = await client.auth.getSession();
  if (!session?.user) return null;

  try {
    const [catRes, accRes, budRes, setRes] = await Promise.all([
      client.from('categories').select('*'),
      client.from('accounts').select('*'),
      client.from('budgets').select('*'),
      client.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
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

    // Fetch transactions in paginated chunks of 1000 to bypass PostgREST max row limit
    let rawTxRows: any[] = [];
    let page = 0;
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

    const transactions: Transaction[] = rawTxRows.map((row: any) => ({
      id: row.id || `tx-${Math.random().toString(36).substring(2)}`,
      date: row.date || new Date().toISOString().substring(0, 10),
      title: row.title || 'Untitled',
      amount: Number(row.amount) || 0,
      currency: row.currency || 'ARS',
      category: row.category || 'General',
      account: row.account || 'Main',
      type: row.type || 'EXPENSE',
      toAccount: row.to_account || undefined,
      installments: row.installments ? String(row.installments) : undefined,
      statementCloseDate: row.statement_close_date || undefined,
      transferAmount: row.transfer_amount !== undefined && row.transfer_amount !== null ? Number(row.transfer_amount) : (row.type === 'TRANSFER' ? Number(row.amount) : undefined),
      transferCurrency: row.transfer_currency || (row.type === 'TRANSFER' ? row.currency : undefined),
      receiveAmount: row.receive_amount !== undefined && row.receive_amount !== null ? Number(row.receive_amount) : undefined,
      receiveCurrency: row.receive_currency || undefined,
      description: row.notes || undefined,
    }));

    const categories: CategoryItem[] = (catRes.data || []).map((row: any) => ({
      id: row.id || `cat-${Math.random().toString(36).substring(2)}`,
      name: row.name || 'Category',
      type: row.type || 'BOTH',
      description: row.color || '#64748b',
    }));

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

      return {
        id: row.id || `acc-${Math.random().toString(36).substring(2)}`,
        name: row.name || 'Account',
        type: accType,
        currency: row.currency || 'ARS',
        initialBalance: (row.initial_balance !== undefined && row.initial_balance !== null) ? Number(row.initial_balance) : 0,
        isShared: row.is_shared || false,
        sharedMembers: Array.isArray(row.shared_members) ? row.shared_members : [],
        closingRule,
      };
    });

    const budgets: BudgetGoal[] = (budRes.data || []).map((row: any) => ({
      category: row.category || 'General',
      monthlyLimitARS: Number(row.monthly_limit) || 0,
    }));

    return { transactions, categories, accounts, budgets, settings: userSettings };
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
    // 1. Transactions upsert or clear in batches of 500
    if (data.transactions && data.transactions.length > 0) {
      const txRows = data.transactions.map(t => {
        const rowId = (t.id && t.id.startsWith(userId)) ? t.id : `${userId}_${t.id || Math.random().toString(36).substring(2)}`;
        
        let safeInstallments: number | null = null;
        if (t.totalInstallments && typeof t.totalInstallments === 'number') {
          safeInstallments = t.totalInstallments;
        } else if (typeof t.installments === 'number') {
          safeInstallments = t.installments;
        } else if (typeof t.installments === 'string') {
          if (t.installments.includes('/')) {
            const parts = t.installments.split('/');
            const total = parseInt(parts[1], 10);
            safeInstallments = !isNaN(total) ? total : (parseInt(parts[0], 10) || null);
          } else {
            const num = parseInt(t.installments, 10);
            safeInstallments = !isNaN(num) ? num : null;
          }
        }

        const rawAmount = (t.amount !== undefined && t.amount !== null && t.amount > 0) ? t.amount : ((t.transferAmount && t.transferAmount > 0) ? t.transferAmount : (t.amount || 0));
        const cleanAmount = Math.round(rawAmount * 100) / 100;

        return {
          id: rowId,
          user_id: userId,
          date: t.date,
          title: t.title,
          amount: cleanAmount,
          currency: t.currency || 'ARS',
          category: t.category || 'General',
          account: t.account || 'Main',
          type: t.type,
          to_account: t.toAccount || null,
          installments: safeInstallments,
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
        const rowId = (c.id && c.id.startsWith(userId)) ? c.id : `${userId}_${c.id || Math.random().toString(36).substring(2)}`;
        return {
          id: rowId,
          user_id: userId,
          name: c.name,
          type: c.type || 'BOTH',
          color: c.description || '#64748b',
        };
      });

      const { error: catErr } = await client.from('categories').upsert(catRows, { onConflict: 'id' });
      if (catErr) console.error('Error upserting categories to Supabase:', catErr);
    }

    // 3. Accounts upsert
    if (data.accounts && data.accounts.length > 0) {
      const accRows = data.accounts.map(a => {
        const rowId = (a.id && a.id.startsWith(userId)) ? a.id : `${userId}_${a.id || Math.random().toString(36).substring(2)}`;
        return {
          id: rowId,
          user_id: userId,
          name: a.name,
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
      const budRows = data.budgets.map(b => ({
        id: `${userId}_${b.category}`,
        user_id: userId,
        category: b.category,
        monthly_limit: b.monthlyLimitARS,
        currency: 'ARS',
      }));

      const { error: budErr } = await client.from('budgets').upsert(budRows, { onConflict: 'id' });
      if (budErr) console.error('Error upserting budgets to Supabase:', budErr);
    } else if (data.budgets && data.budgets.length === 0) {
      const { error: delBudErr } = await client.from('budgets').delete().eq('user_id', userId);
      if (delBudErr) console.error('Error clearing budgets in Supabase:', delBudErr);
    }

    // 5. User Settings upsert (CC Rules, CC Classification map, Period Statuses, Custom Balances)
    const ccRulesMapFromAccs: Record<string, CreditCardClosingRule> = {};
    const ccMapFromAccs: Record<string, boolean> = {};

    (data.accounts || []).forEach(a => {
      if (a.closingRule) {
        ccRulesMapFromAccs[a.name] = a.closingRule;
      }
      ccMapFromAccs[a.name] = a.type === 'CREDIT_CARD';
    });

    const settingsObj = {
      ccRulesMap: { ...ccRulesMapFromAccs, ...(data.settings?.ccRulesMap || {}) },
      ccMap: { ...ccMapFromAccs, ...(data.settings?.ccMap || {}) },
      ccPeriodStatuses: data.settings?.ccPeriodStatuses || {},
      customBalances: data.settings?.customBalances || {},
      workspaceSharing: data.settings?.workspaceSharing || {},
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

    return true;
  } catch (err) {
    console.error('Error syncing data to Supabase:', err);
    return false;
  }
}

export async function deleteTransactionFromSupabase(txId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return false;

    const userId = session.user.id;
    const scopedId = (txId && txId.startsWith(userId)) ? txId : `${userId}_${txId}`;

    const { error } = await client
      .from('transactions')
      .delete()
      .or(`id.eq.${txId},id.eq.${scopedId}`)
      .eq('user_id', userId);
    if (error) {
      console.error('Error deleting transaction from Supabase:', error);
      return false;
    }
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

    const { error } = await client
      .from('categories')
      .delete()
      .eq('name', catName)
      .eq('user_id', session.user.id);
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

    const { error } = await client
      .from('accounts')
      .delete()
      .eq('name', accName)
      .eq('user_id', session.user.id);
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
