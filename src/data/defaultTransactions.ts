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
    // Clean numeric values that might contain commas or currency symbols like "9,983.33"
    const cleanNum = (val: any) => {
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') return val;
      const cleaned = val.toString().replace(/[$"'\s]/g, '').replace(/,/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    const dateVal = (row['Date'] && row['Date'].trim()) || 
                    (row['Due Date'] && row['Due Date'].trim()) || 
                    (row['Description'] && row['Description'].startsWith('202') ? row['Description'].trim() : new Date().toISOString());

    const parsedAmount = cleanNum(row['Amount']);
    const parsedTransferAmount = row['Transfer Amount'] ? cleanNum(row['Transfer Amount']) : undefined;
    const finalAmount = (parsedAmount > 0) ? parsedAmount : (parsedTransferAmount || 0);

    const txType = ((row['Type'] as string) || 'EXPENSE').toUpperCase() as any;

    const transferCurrency = row['Transfer Currency'] ? row['Transfer Currency'].trim() : undefined;
    const receiveCurrency = row['Receive Currency'] ? row['Receive Currency'].trim() : undefined;
    const generalCurrency = row['Currency'] ? row['Currency'].trim() : undefined;

    // For a transfer, origin currency is transferCurrency if provided, else general currency
    const originCurrency = (txType === 'TRANSFER' && transferCurrency)
      ? transferCurrency
      : (generalCurrency || transferCurrency || 'ARS');

    return {
      id: row['ID'] || `tx-${index}-${Math.random().toString(36).substring(2, 9)}`,
      date: dateVal,
      title: row['Title'] || row['Category'] || 'Untitled',
      category: row['Category'] || 'General',
      account: row['Account'] ? row['Account'].trim() : 'Cash',
      amount: finalAmount,
      currency: originCurrency,
      type: txType,
      transferAmount: parsedTransferAmount,
      transferCurrency: transferCurrency,
      toAccount: row['To Account'] ? row['To Account'].trim() : undefined,
      receiveAmount: row['Receive Amount'] ? cleanNum(row['Receive Amount']) : undefined,
      receiveCurrency: receiveCurrency,
      description: row['Description'] || undefined,
      dueDate: row['Due Date'] || undefined,
      installments: row['ID'] ? undefined : (row['Description'] && row['Description'].includes('/') ? row['Description'] : undefined),
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

