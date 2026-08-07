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
      id: row.id,
      date: row.date,
      title: row.title,
      amount: Number(row.amount),
      currency: row.currency || 'ARS',
      category: row.category,
      account: row.account,
      type: row.type,
      toAccount: row.to_account || undefined,
      installments: row.installments ? String(row.installments) : undefined,
      statementCloseDate: row.statement_close_date || undefined,
      receiveAmount: row.receive_amount ? Number(row.receive_amount) : undefined,
      receiveCurrency: row.receive_currency || undefined,
      description: row.notes || undefined,
    }));

    const categories: CategoryItem[] = (catRes.data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type || 'BOTH',
      description: row.color,
    }));

    const accounts: AccountItem[] = (accRes.data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type || 'CHECKING',
      currency: row.currency || 'ARS',
      initialBalance: row.initial_balance ? Number(row.initial_balance) : undefined,
    }));

    const budgets: BudgetGoal[] = (budRes.data || []).map((row: any) => ({
      category: row.category,
      monthlyLimitARS: Number(row.monthly_limit),
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
    // 1. Transactions upsert
    if (data.transactions && data.transactions.length > 0) {
      const txRows = data.transactions.map(t => ({
        id: t.id,
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
        notes: t.description || null,
      }));

      const { error: txErr } = await client.from('transactions').upsert(txRows, { onConflict: 'id' });
      if (txErr) console.error('Error upserting transactions to Supabase:', txErr);
    }

    // 2. Categories upsert
    if (data.categories && data.categories.length > 0) {
      const catRows = data.categories.map(c => ({
        id: c.id,
        user_id: userId,
        name: c.name,
        type: c.type || 'BOTH',
        color: c.description || '#64748b',
      }));

      const { error: catErr } = await client.from('categories').upsert(catRows, { onConflict: 'id' });
      if (catErr) console.error('Error upserting categories to Supabase:', catErr);
    }

    // 3. Accounts upsert
    if (data.accounts && data.accounts.length > 0) {
      const accRows = data.accounts.map(a => ({
        id: a.id,
        user_id: userId,
        name: a.name,
        type: a.type || 'CHECKING',
        currency: a.currency || 'ARS',
        initial_balance: a.initialBalance || 0,
      }));

      const { error: accErr } = await client.from('accounts').upsert(accRows, { onConflict: 'id' });
      if (accErr) console.error('Error upserting accounts to Supabase:', accErr);
    }

    // 4. Budgets upsert
    if (data.budgets && data.budgets.length > 0) {
      const budRows = data.budgets.map(b => ({
        id: b.category, // using category name as ID for budget rows
        user_id: userId,
        category: b.category,
        monthly_limit: b.monthlyLimitARS,
        currency: 'ARS',
      }));

      const { error: budErr } = await client.from('budgets').upsert(budRows, { onConflict: 'id' });
      if (budErr) console.error('Error upserting budgets to Supabase:', budErr);
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
    const { error } = await client.from('transactions').delete().eq('id', txId);
    if (error) {
      console.error('Error deleting transaction from Supabase:', error);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}
