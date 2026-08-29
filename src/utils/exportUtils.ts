import { Transaction, CreditCardStatement } from '../types';

/**
 * Cleanly escapes a string or value for RFC4180 CSV compliance.
 */
export function escapeCsvField(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Triggers a browser download of a CSV file with UTF-8 BOM so Excel and spreadsheet apps
 * properly render accented and special characters without encoding glitches.
 */
export function downloadCsvFile(csvContent: string, filename: string): void {
  // UTF-8 BOM (\uFEFF) ensures Excel and spreadsheet applications decode accented characters properly
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', url);
  downloadAnchor.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  document.body.removeChild(downloadAnchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports a list of transactions (e.g. filtered view from Transactions tab) to a standardized CSV.
 */
export function exportTransactionsToCSV(
  transactions: Transaction[],
  customFilename?: string
): void {
  const headers = [
    'Date',
    'Title',
    'Category',
    'Amount',
    'Currency',
    'Account',
    'To Account',
    'Type',
    'Installments',
    'Statement Close Date',
    'Description',
    'Notes',
  ];

  const rows = transactions.map((t) => {
    const dateStr = t.date ? (t.date.length === 10 ? t.date : t.date.substring(0, 10)) : '';
    const amountVal = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount || 0));

    return [
      escapeCsvField(dateStr),
      escapeCsvField(t.title || ''),
      escapeCsvField(t.category || ''),
      isNaN(amountVal) ? 0 : amountVal,
      escapeCsvField(t.currency || 'ARS'),
      escapeCsvField(t.account || ''),
      escapeCsvField(t.toAccount || ''),
      escapeCsvField(t.type || 'EXPENSE'),
      escapeCsvField(t.installments || (t.totalInstallments ? `${t.installmentNumber || 1}/${t.totalInstallments}` : '')),
      escapeCsvField(t.statementCloseDate || ''),
      escapeCsvField(t.description || ''),
      escapeCsvField(t.notes || ''),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const dateSuffix = new Date().toISOString().substring(0, 10);
  const filename = customFilename || `transactions_export_${dateSuffix}.csv`;
  downloadCsvFile(csvContent, filename);
}

/**
 * Exports a Credit Card Resume / Statement including all itemized expenses and payments.
 */
export function exportCreditCardResumeCSV(
  statement: CreditCardStatement,
  accountName: string
): void {
  const cleanAccName = accountName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `cc_resume_${cleanAccName}_closing_${statement.closeDate || 'statement'}.csv`;

  const headers = [
    'Section',
    'Date',
    'Title / Merchant',
    'Category',
    'Amount',
    'Currency',
    'Installments',
    'Card Account',
    'Statement Close Date',
    'Statement Due Date',
    'Statement Status',
    'Type',
    'Description',
  ];

  const statusLabel = statement.isPaid ? 'PAID' : 'OPEN / PENDING';
  const dueDateStr = statement.dueDate || '';

  const expenseRows = (statement.expenses || []).map((t) => {
    const dateStr = t.date ? (t.date.length === 10 ? t.date : t.date.substring(0, 10)) : '';
    const amountVal = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount || 0));
    return [
      escapeCsvField('EXPENSE'),
      escapeCsvField(dateStr),
      escapeCsvField(t.title || ''),
      escapeCsvField(t.category || ''),
      isNaN(amountVal) ? 0 : amountVal,
      escapeCsvField(t.currency || statement.currency || 'ARS'),
      escapeCsvField(t.installments || (t.totalInstallments ? `${t.installmentNumber || 1}/${t.totalInstallments}` : '1/1')),
      escapeCsvField(accountName),
      escapeCsvField(statement.closeDate),
      escapeCsvField(dueDateStr),
      escapeCsvField(statusLabel),
      escapeCsvField(t.type || 'EXPENSE'),
      escapeCsvField(t.description || ''),
    ].join(',');
  });

  const paymentRows = (statement.payments || []).map((t) => {
    const dateStr = t.date ? (t.date.length === 10 ? t.date : t.date.substring(0, 10)) : '';
    const pmtAmt = t.receiveAmount || t.transferAmount || t.amount || 0;
    const amountVal = typeof pmtAmt === 'number' ? pmtAmt : parseFloat(String(pmtAmt || 0));
    return [
      escapeCsvField('PAYMENT'),
      escapeCsvField(dateStr),
      escapeCsvField(t.title || `Payment from ${t.account}`),
      escapeCsvField(t.category || 'Tarjetas de Crédito'),
      isNaN(amountVal) ? 0 : amountVal,
      escapeCsvField(t.currency || statement.currency || 'ARS'),
      escapeCsvField(''),
      escapeCsvField(accountName),
      escapeCsvField(statement.closeDate),
      escapeCsvField(dueDateStr),
      escapeCsvField(statusLabel),
      escapeCsvField(t.type || 'CC_PAYMENT'),
      escapeCsvField(t.description || `Paid from ${t.account}`),
    ].join(',');
  });

  const allRows = [...expenseRows, ...paymentRows];
  const csvContent = [headers.join(','), ...allRows].join('\r\n');
  downloadCsvFile(csvContent, filename);
}

/**
 * Exports all expenses associated with a credit card account across all statements.
 */
export function exportAllCreditCardExpensesCSV(
  transactions: Transaction[],
  accountName: string
): void {
  const cleanAccName = accountName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `cc_all_expenses_${cleanAccName}_${new Date().toISOString().substring(0, 10)}.csv`;

  // Filter transactions belonging to this card (either account or toAccount for CC payments)
  const cardTransactions = transactions.filter(
    (t) => t.account === accountName || (t.toAccount === accountName && t.type === 'CC_PAYMENT')
  );

  exportTransactionsToCSV(cardTransactions, filename);
}
