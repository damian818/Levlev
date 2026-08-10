import { Transaction, BudgetGoal, RecurringRule, InflationPoint, CategoryItem, AccountItem } from '../types';
import Papa from 'papaparse';

export const rawCsvSample = '';

export function parseTransactions(csvText: string): Transaction[] {
  if (!csvText || !csvText.trim()) return [];

  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rawRows = result.data as any[];
  return rawRows.map((row, index) => {
    // Helper to get value from row matching any key variant case-insensitively
    const getVal = (...keys: string[]): any => {
      if (!row || typeof row !== 'object') return undefined;
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
        const lowerK = k.toLowerCase().replace(/[\s_]/g, '');
        for (const rowKey of Object.keys(row)) {
          if (rowKey.toLowerCase().replace(/[\s_]/g, '') === lowerK) {
            if (row[rowKey] !== undefined && row[rowKey] !== null && String(row[rowKey]).trim() !== '') {
              return row[rowKey];
            }
          }
        }
      }
      return undefined;
    };

    // Clean numeric values that might contain commas or currency symbols like "9,983.33"
    const cleanNum = (val: any) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (typeof val === 'number') return val;
      const cleaned = val.toString().replace(/[$"'\s]/g, '').replace(/,/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    };

    const rawDate = getVal('Date', 'date', 'Due Date', 'due_date');
    const rawDesc = getVal('Description', 'description', 'Title', 'title', 'notes');
    
    let dateVal = rawDate ? String(rawDate).trim() : undefined;
    if (!dateVal && rawDesc && String(rawDesc).startsWith('202')) {
      dateVal = String(rawDesc).trim();
    }
    if (!dateVal) {
      dateVal = new Date().toISOString().substring(0, 10);
    }

    const parsedAmount = cleanNum(getVal('Amount', 'amount')) || 0;
    const parsedTransferAmount = cleanNum(getVal('Transfer Amount', 'transfer_amount', 'transferamount'));
    const parsedReceiveAmount = cleanNum(getVal('Receive Amount', 'receive_amount', 'receiveamount'));
    const finalAmount = (parsedAmount > 0) ? parsedAmount : (parsedTransferAmount || parsedReceiveAmount || 0);

    const rawType = getVal('Type', 'type');
    const txType = (rawType ? String(rawType).toUpperCase() : 'EXPENSE') as any;

    const transferCurrency = getVal('Transfer Currency', 'transfer_currency');
    const receiveCurrency = getVal('Receive Currency', 'receive_currency');
    const generalCurrency = getVal('Currency', 'currency');

    const originCurrency = (txType === 'TRANSFER' && transferCurrency)
      ? String(transferCurrency).trim()
      : (generalCurrency ? String(generalCurrency).trim() : (transferCurrency ? String(transferCurrency).trim() : 'ARS'));

    const rawTitle = getVal('Title', 'title', 'Category', 'category', 'Description', 'description');
    const titleVal = rawTitle ? String(rawTitle).trim() : 'Untitled';

    const rawCategory = getVal('Category', 'category');
    const categoryVal = rawCategory ? String(rawCategory).trim() : 'General';

    const rawAccount = getVal('Account', 'account', 'From Account', 'from_account');
    const accountVal = rawAccount ? String(rawAccount).trim() : 'Cash';

    const rawToAccount = getVal('To Account', 'to_account', 'Destination Account', 'destination_account');
    const toAccountVal = rawToAccount ? String(rawToAccount).trim() : undefined;

    const rawId = getVal('ID', 'id');
    const idVal = rawId ? String(rawId).trim() : `tx-${index}-${Math.random().toString(36).substring(2, 9)}`;

    const descriptionVal = getVal('Description', 'description', 'notes') ? String(getVal('Description', 'description', 'notes')).trim() : undefined;
    const dueDateVal = getVal('Due Date', 'due_date') ? String(getVal('Due Date', 'due_date')).trim() : undefined;

    return {
      id: idVal,
      date: dateVal,
      title: titleVal,
      category: categoryVal,
      account: accountVal,
      amount: finalAmount,
      currency: originCurrency,
      type: txType,
      transferAmount: parsedTransferAmount,
      transferCurrency: transferCurrency ? String(transferCurrency).trim() : undefined,
      toAccount: toAccountVal,
      receiveAmount: parsedReceiveAmount,
      receiveCurrency: receiveCurrency ? String(receiveCurrency).trim() : undefined,
      description: descriptionVal,
      dueDate: dueDateVal,
      installments: rawId ? undefined : (descriptionVal && descriptionVal.includes('/') ? descriptionVal : undefined),
    };
  }).filter(t => t.date && (!isNaN(t.amount) || (t.transferAmount && !isNaN(t.transferAmount))));
}

export const defaultBudgets: BudgetGoal[] = [];

export const defaultRecurringRules: RecurringRule[] = [];

// Historical inflation index (simulated monthly Argentina CPI index 2024-2026) vs USD/ARS rate
export const historicalInflationAndFX: InflationPoint[] = [
  { month: '2024-09', inflationIndex: 100, usdArsRate: 1250 },
  { month: '2024-10', inflationIndex: 103.5, usdArsRate: 1280 },
  { month: '2024-11', inflationIndex: 106.2, usdArsRate: 1310 },
  { month: '2024-12', inflationIndex: 109.0, usdArsRate: 1350 },
  { month: '2025-01', inflationIndex: 112.2, usdArsRate: 1380 },
  { month: '2025-02', inflationIndex: 115.0, usdArsRate: 1400 },
  { month: '2025-03', inflationIndex: 117.8, usdArsRate: 1430 },
  { month: '2025-04', inflationIndex: 120.5, usdArsRate: 1460 },
  { month: '2025-05', inflationIndex: 123.1, usdArsRate: 1490 },
  { month: '2025-06', inflationIndex: 125.8, usdArsRate: 1520 },
  { month: '2025-07', inflationIndex: 128.5, usdArsRate: 1550 },
  { month: '2025-08', inflationIndex: 131.2, usdArsRate: 1580 },
  { month: '2025-09', inflationIndex: 134.0, usdArsRate: 1610 },
  { month: '2025-10', inflationIndex: 136.8, usdArsRate: 1640 },
  { month: '2025-11', inflationIndex: 139.7, usdArsRate: 1670 },
  { month: '2025-12', inflationIndex: 142.6, usdArsRate: 1700 },
  { month: '2026-01', inflationIndex: 145.8, usdArsRate: 1450 },
  { month: '2026-02', inflationIndex: 149.0, usdArsRate: 1400 },
  { month: '2026-03', inflationIndex: 152.2, usdArsRate: 1380 },
  { month: '2026-04', inflationIndex: 155.5, usdArsRate: 1448.5 },
  { month: '2026-05', inflationIndex: 158.8, usdArsRate: 1410 },
  { month: '2026-06', inflationIndex: 162.2, usdArsRate: 1480 },
  { month: '2026-07', inflationIndex: 165.6, usdArsRate: 1485 },
  { month: '2026-08', inflationIndex: 169.1, usdArsRate: 1496 },
];

export const defaultCategoryItems: CategoryItem[] = [
  { id: 'cat-1', name: 'Alimentos y Bebidas', type: 'EXPENSE' },
  { id: 'cat-2', name: 'Transporte', type: 'EXPENSE' },
  { id: 'cat-3', name: 'Restaurant', type: 'EXPENSE' },
  { id: 'cat-4', name: 'Hogar', type: 'EXPENSE' },
  { id: 'cat-5', name: 'Salud', type: 'EXPENSE' },
  { id: 'cat-6', name: 'Ropa', type: 'EXPENSE' },
  { id: 'cat-7', name: 'Facturas y tarifas', type: 'EXPENSE' },
  { id: 'cat-8', name: 'Educación', type: 'EXPENSE' },
  { id: 'cat-9', name: 'Regalos', type: 'EXPENSE' },
  { id: 'cat-10', name: 'Inversiones', type: 'BOTH' },
  { id: 'cat-11', name: 'Sueldo', type: 'INCOME' },
  { id: 'cat-12', name: 'Freelance', type: 'INCOME' },
  { id: 'cat-13', name: 'Tarjetas de Crédito', type: 'BOTH' },
  { id: 'cat-14', name: 'Transferencias', type: 'BOTH' },
  { id: 'cat-15', name: 'Entretenimiento', type: 'EXPENSE' },
  { id: 'cat-16', name: 'General', type: 'BOTH' },
];

export const defaultAccountItems: AccountItem[] = [];

