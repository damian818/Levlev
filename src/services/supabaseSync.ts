import { getSupabaseClient } from '../lib/supabase';
import { Transaction, CategoryItem, AccountItem, BudgetGoal } from '../types';

export interface SupabaseUserData {
  transactions: Transaction[];
  categories: CategoryItem[];
  accounts: AccountItem[];
  budgets: BudgetGoal[];
}

export async function fetchUserDataFromSupabase(): Promise<SupabaseUserData | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data: { session } } = await client.auth.getSession();
  if (!session?.user) return null;

  try {
    const [txRes, catRes, accRes, budRes] = await Promise.all([
      client.from('transactions').select('*').order('date', { ascending: false }),
      client.from('categories').select('*'),
      client.from('accounts').select('*'),
      client.from('budgets').select('*'),
    ]);

    if (txRes.error) console.warn('Supabase fetch transactions error:', txRes.error);
    if (catRes.error) console.warn('Supabase fetch categories error:', catRes.error);
    if (accRes.error) console.warn('Supabase fetch accounts error:', accRes.error);
    if (budRes.error) console.warn('Supabase fetch budgets error:', budRes.error);

    const transactions: Transaction[] = (txRes.data || []).map((row: any) => ({
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
      receiveAmount: row.receive_amount ? Number(row.receive_amount) : undefined,
      receiveCurrency: row.receive_currency || undefined,
      transferAmount: (row.transfer_amount !== undefined && row.transfer_amount !== null) ? Number(row.transfer_amount) : undefined,
      transferCurrency: row.transfer_currency || undefined,
      description: row.notes || undefined,
    }));

    const categories: CategoryItem[] = (catRes.data || []).map((row: any) => ({
      id: row.id || `cat-${Math.random().toString(36).substring(2)}`,
      name: row.name || 'Category',
      type: row.type || 'BOTH',
      description: row.color || '#64748b',
    }));

    const accounts: AccountItem[] = (accRes.data || []).map((row: any) => ({
      id: row.id || `acc-${Math.random().toString(36).substring(2)}`,
      name: row.name || 'Account',
      type: row.type || 'CHECKING',
      currency: row.currency || 'ARS',
      initialBalance: (row.initial_balance !== undefined && row.initial_balance !== null) ? Number(row.initial_balance) : 0,
    }));

    const budgets: BudgetGoal[] = (budRes.data || []).map((row: any) => ({
      category: row.category || 'General',
      monthlyLimitARS: Number(row.monthly_limit) || 0,
    }));

    return { transactions, categories, accounts, budgets };
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
    // 1. Transactions upsert or clear
    if (data.transactions && data.transactions.length > 0) {
      const txRows = data.transactions.map(t => {
        const rowId = (t.id && t.id.startsWith(userId)) ? t.id : `${userId}_${t.id || Math.random().toString(36).substring(2)}`;
        return {
          id: rowId,
          user_id: userId,
          date: t.date,
          title: t.title,
          amount: t.amount,
          currency: t.currency || 'ARS',
          category: t.category || 'General',
          account: t.account || 'Main',
          type: t.type,
          to_account: t.toAccount || null,
          installments: t.installments || null,
          statement_close_date: t.statementCloseDate || null,
          receive_amount: t.receiveAmount || null,
          receive_currency: t.receiveCurrency || null,
          transfer_amount: t.transferAmount || null,
          transfer_currency: t.transferCurrency || null,
          notes: t.description || null,
        };
      });

      const { error: txErr } = await client.from('transactions').upsert(txRows, { onConflict: 'id' });
      if (txErr) console.error('Error upserting transactions to Supabase:', txErr);
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
        };
      });

      const { error: accErr } = await client.from('accounts').upsert(accRows, { onConflict: 'id' });
      if (accErr) console.error('Error upserting accounts to Supabase:', accErr);
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
