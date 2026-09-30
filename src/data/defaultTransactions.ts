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

// Historical inflation index (INDEC monthly Argentina CPI index 2024-2026) vs USD/ARS MEP rate
export const historicalInflationAndFX: InflationPoint[] = [
  { month: '2024-01', monthlyInflation: 20.6, inflationIndex: 100.0, usdArsRate: 1177.0 },
  { month: '2024-02', monthlyInflation: 13.2, inflationIndex: 113.2, usdArsRate: 1031.0 },
  { month: '2024-03', monthlyInflation: 11.0, inflationIndex: 125.7, usdArsRate: 1020.5 },
  { month: '2024-04', monthlyInflation: 8.8, inflationIndex: 136.8, usdArsRate: 1044.7 },
  { month: '2024-05', monthlyInflation: 4.2, inflationIndex: 142.5, usdArsRate: 1215.5 },
  { month: '2024-06', monthlyInflation: 4.6, inflationIndex: 149.1, usdArsRate: 1348.6 },
  { month: '2024-07', monthlyInflation: 4.0, inflationIndex: 155.1, usdArsRate: 1307.7 },
  { month: '2024-08', monthlyInflation: 4.2, inflationIndex: 161.6, usdArsRate: 1284.8 },
  { month: '2024-09', monthlyInflation: 3.5, inflationIndex: 167.3, usdArsRate: 1213.3 },
  { month: '2024-10', monthlyInflation: 2.7, inflationIndex: 171.8, usdArsRate: 1128.7 },
  { month: '2024-11', monthlyInflation: 2.4, inflationIndex: 175.9, usdArsRate: 1075.9 },
  { month: '2024-12', monthlyInflation: 2.7, inflationIndex: 180.7, usdArsRate: 1169.5 },
  { month: '2025-01', monthlyInflation: 2.2, inflationIndex: 184.7, usdArsRate: 1168.2 },
  { month: '2025-02', monthlyInflation: 2.4, inflationIndex: 189.1, usdArsRate: 1231.3 },
  { month: '2025-03', monthlyInflation: 3.7, inflationIndex: 196.1, usdArsRate: 1319.6 },
  { month: '2025-04', monthlyInflation: 2.8, inflationIndex: 201.6, usdArsRate: 1182.8 },
  { month: '2025-05', monthlyInflation: 1.5, inflationIndex: 204.6, usdArsRate: 1193.5 },
  { month: '2025-06', monthlyInflation: 1.6, inflationIndex: 207.9, usdArsRate: 1211.3 },
  { month: '2025-07', monthlyInflation: 1.9, inflationIndex: 211.9, usdArsRate: 1363.8 },
  { month: '2025-08', monthlyInflation: 1.9, inflationIndex: 215.9, usdArsRate: 1371.9 },
  { month: '2025-09', monthlyInflation: 2.1, inflationIndex: 220.4, usdArsRate: 1503.2 },
  { month: '2025-10', monthlyInflation: 2.3, inflationIndex: 225.5, usdArsRate: 1495.2 },
  { month: '2025-11', monthlyInflation: 2.5, inflationIndex: 231.1, usdArsRate: 1482.9 },
  { month: '2025-12', monthlyInflation: 2.8, inflationIndex: 237.6, usdArsRate: 1501.5 },
  { month: '2026-01', monthlyInflation: 2.9, inflationIndex: 244.5, usdArsRate: 1464.6 },
  { month: '2026-02', monthlyInflation: 2.9, inflationIndex: 251.6, usdArsRate: 1427.4 },
  { month: '2026-03', monthlyInflation: 3.4, inflationIndex: 260.2, usdArsRate: 1430.8 },
  { month: '2026-04', monthlyInflation: 2.6, inflationIndex: 266.9, usdArsRate: 1448.5 },
  { month: '2026-05', monthlyInflation: 2.1, inflationIndex: 272.5, usdArsRate: 1434.8 },
  { month: '2026-06', monthlyInflation: 1.9, inflationIndex: 277.7, usdArsRate: 1519.0 },
  { month: '2026-07', monthlyInflation: 2.1, inflationIndex: 283.5, usdArsRate: 1522.1 },
  { month: '2026-08', monthlyInflation: 1.7, inflationIndex: 288.3, usdArsRate: 1538.8 },
  { month: '2026-09', monthlyInflation: 1.8, inflationIndex: 293.5, usdArsRate: 1557.0 },
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

