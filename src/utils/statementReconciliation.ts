import { Transaction, StatementParsedData, StatementParsedItem, StatementReconciliationItem, StatementReconciliationSummary, StatementItemDiff } from '../types';

/**
 * Normalizes text for merchant & description comparison
 */
export function normalizeMerchantText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ') // alphanumeric only
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates day difference between two YYYY-MM-DD date strings
 */
export function getDaysDiff(date1Str: string, date2Str: string): number {
  if (!date1Str || !date2Str) return 999;
  const d1 = new Date(date1Str.substring(0, 10));
  const d2 = new Date(date2Str.substring(0, 10));
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 999;
  const diffMs = Math.abs(d1.getTime() - d2.getTime());
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Computes token similarity between two strings
 */
export function computeTextSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeMerchantText(str1);
  const norm2 = normalizeMerchantText(str2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.85;

  const tokens1 = new Set(norm1.split(' ').filter(w => w.length > 2));
  const tokens2 = new Set(norm2.split(' ').filter(w => w.length > 2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  tokens1.forEach(t => {
    if (tokens2.has(t)) intersection++;
  });

  const union = new Set([...tokens1, ...tokens2]).size;
  return intersection / union;
}

/**
 * Reconciles parsed statement data against existing transactions in the app
 */
export function reconcileStatementWithApp(
  statement: StatementParsedData,
  existingTransactions: Transaction[],
  targetAccountName: string
): {
  reconciliationItems: StatementReconciliationItem[];
  summary: StatementReconciliationSummary;
} {
  const normTargetAccount = (targetAccountName || '').toLowerCase().trim();

  // Filter app expenses for this credit card account
  const cardTransactions = existingTransactions.filter(t => {
    const accMatch = (t.account || '').toLowerCase().trim() === normTargetAccount;
    return accMatch && t.type === 'EXPENSE';
  });

  // Calculate statement date boundaries
  const pStart = statement.periodStart ? statement.periodStart.substring(0, 10) : '2000-01-01';
  const pEnd = (statement.periodEnd || statement.closeDate) ? (statement.periodEnd || statement.closeDate).substring(0, 10) : '2099-12-31';

  // Find candidate app transactions within or near period (±8 days buffer for bank clearing)
  const candidateTxs = cardTransactions.filter(t => {
    if (!t.date) return false;
    const txDate = t.date.substring(0, 10);
    // If statementCloseDate is explicitly assigned and matches
    if (t.statementCloseDate && statement.closeDate && t.statementCloseDate === statement.closeDate) {
      return true;
    }
    // Date within period window with buffer
    const bufferBefore = new Date(pStart);
    bufferBefore.setDate(bufferBefore.getDate() - 7);
    const bufferAfter = new Date(pEnd);
    bufferAfter.setDate(bufferAfter.getDate() + 7);

    const currentD = new Date(txDate);
    return currentD >= bufferBefore && currentD <= bufferAfter;
  });

  const matchedTxIds = new Set<string>();
  const modifiedTxIds = new Set<string>();
  const reconciliationItems: StatementReconciliationItem[] = [];

  // Pass 1: Find Exact and High-confidence Matches
  const statementItemsWithMatch: {
    item: StatementParsedItem;
    matchedTx?: Transaction;
    status?: 'MATCHED' | 'MODIFIED' | 'NEW';
    diffs?: StatementItemDiff[];
  }[] = statement.items.map(item => ({ item }));

  for (const sObj of statementItemsWithMatch) {
    const sItem = sObj.item;
    const itemCurrency = (sItem.currency || statement.currency || 'ARS').toUpperCase();
    const itemAmount = Number(sItem.amount || 0);

    // Look for exact amount + close date + similar title
    let bestMatch: Transaction | null = null;
    let bestScore = -1;

    for (const tx of candidateTxs) {
      if (matchedTxIds.has(tx.id) || modifiedTxIds.has(tx.id)) continue;

      const txCurrency = (tx.currency || 'ARS').toUpperCase();
      if (txCurrency !== itemCurrency) continue;

      const amountDiff = Math.abs(Number(tx.amount || 0) - itemAmount);
      const daysDiff = getDaysDiff(tx.date, sItem.date);
      const textSim = computeTextSimilarity(tx.title || '', sItem.cleanTitle || sItem.rawDescription || '');

      // Score calculation
      let score = 0;
      if (amountDiff < 0.05) score += 50;
      else if (amountDiff < 2.0) score += 20;

      if (daysDiff === 0) score += 30;
      else if (daysDiff <= 2) score += 20;
      else if (daysDiff <= 4) score += 10;

      score += Math.round(textSim * 30);

      // Require high threshold for exact match
      if (score >= 60 && score > bestScore) {
        bestScore = score;
        bestMatch = tx;
      }
    }

    if (bestMatch) {
      matchedTxIds.add(bestMatch.id);
      sObj.matchedTx = bestMatch;

      const diffs: StatementItemDiff[] = [];
      const hasInstallmentOnStatement = Boolean(sItem.installmentTotal && sItem.installmentCurrent);
      const existingInstallmentStr = bestMatch.installments || (bestMatch.totalInstallments && bestMatch.installmentNumber ? `${bestMatch.installmentNumber}/${bestMatch.totalInstallments}` : '');
      const statementInstallmentStr = hasInstallmentOnStatement ? `${sItem.installmentCurrent}/${sItem.installmentTotal}` : '';

      // Check for discrepancies worth modifying
      const amountDiff = Math.abs(Number(bestMatch.amount || 0) - itemAmount);
      if (amountDiff >= 0.05) {
        diffs.push({
          field: 'amount',
          label: 'Amount',
          oldVal: bestMatch.amount,
          newVal: itemAmount,
          highlight: true,
        });
      }

      if (hasInstallmentOnStatement && existingInstallmentStr !== statementInstallmentStr) {
        diffs.push({
          field: 'installments',
          label: 'Installments (Cuotas)',
          oldVal: existingInstallmentStr || 'None',
          newVal: statementInstallmentStr,
          highlight: true,
        });
      }

      if (diffs.length > 0) {
        sObj.status = 'MODIFIED';
        sObj.diffs = diffs;
      } else {
        sObj.status = 'MATCHED';
        sObj.diffs = [];
      }
    }
  }

  // Pass 2: Check remaining items for possible modifications (same merchant, slight amount difference or vice versa)
  for (const sObj of statementItemsWithMatch) {
    if (sObj.status) continue;
    const sItem = sObj.item;
    const itemCurrency = (sItem.currency || statement.currency || 'ARS').toUpperCase();
    const itemAmount = Number(sItem.amount || 0);

    let candidateModification: Transaction | null = null;
    let highestSim = 0;

    for (const tx of candidateTxs) {
      if (matchedTxIds.has(tx.id) || modifiedTxIds.has(tx.id)) continue;
      const txCurrency = (tx.currency || 'ARS').toUpperCase();
      if (txCurrency !== itemCurrency) continue;

      const daysDiff = getDaysDiff(tx.date, sItem.date);
      if (daysDiff > 6) continue;

      const textSim = computeTextSimilarity(tx.title || '', sItem.cleanTitle || sItem.rawDescription || '');
      if (textSim >= 0.55 && textSim > highestSim) {
        highestSim = textSim;
        candidateModification = tx;
      }
    }

    if (candidateModification) {
      modifiedTxIds.add(candidateModification.id);
      sObj.matchedTx = candidateModification;
      sObj.status = 'MODIFIED';

      const diffs: StatementItemDiff[] = [];
      const amountDiff = Math.abs(Number(candidateModification.amount || 0) - itemAmount);
      if (amountDiff >= 0.05) {
        diffs.push({
          field: 'amount',
          label: 'Amount',
          oldVal: candidateModification.amount,
          newVal: itemAmount,
          highlight: true,
        });
      }

      if (candidateModification.date !== sItem.date) {
        diffs.push({
          field: 'date',
          label: 'Date',
          oldVal: candidateModification.date,
          newVal: sItem.date,
          highlight: false,
        });
      }

      if (sItem.installmentTotal && sItem.installmentCurrent) {
        const stmtInst = `${sItem.installmentCurrent}/${sItem.installmentTotal}`;
        const appInst = candidateModification.installments || 'None';
        if (stmtInst !== appInst) {
          diffs.push({
            field: 'installments',
            label: 'Installments (Cuotas)',
            oldVal: appInst,
            newVal: stmtInst,
            highlight: true,
          });
        }
      }

      sObj.diffs = diffs;
    } else {
      sObj.status = 'NEW';
      sObj.diffs = [];
    }
  }

  // Construct Reconciliation Items from statement items
  let recIdx = 1;
  statementItemsWithMatch.forEach(({ item, matchedTx, status, diffs }) => {
    const id = `rec_${recIdx++}_${Date.now()}`;
    const itemCurrency = (item.currency || statement.currency || 'ARS').toUpperCase();
    const itemAmount = Number(item.amount || 0);

    if (status === 'MATCHED' && matchedTx) {
      reconciliationItems.push({
        id,
        status: 'MATCHED',
        confidence: 'EXACT',
        selected: false,
        statementItem: item,
        existingTx: matchedTx,
        draftTx: { ...matchedTx },
        diffs: [],
        explanation: 'Transaction in app already matches statement amount and date.',
      });
    } else if (status === 'MODIFIED' && matchedTx) {
      // Build proposed modified transaction
      const draftTx: Transaction = {
        ...matchedTx,
        amount: itemAmount,
        currency: itemCurrency,
        date: item.date || matchedTx.date,
        statementCloseDate: statement.closeDate || matchedTx.statementCloseDate,
        title: item.cleanTitle || matchedTx.title,
        category: item.category || matchedTx.category,
        description: item.rawDescription ? `${matchedTx.description ? matchedTx.description + ' · ' : ''}${item.rawDescription}` : matchedTx.description,
      };

      if (item.installmentTotal && item.installmentCurrent) {
        draftTx.installments = `${item.installmentCurrent}/${item.installmentTotal}`;
        draftTx.installmentNumber = item.installmentCurrent;
        draftTx.totalInstallments = item.installmentTotal;
      }

      reconciliationItems.push({
        id,
        status: 'MODIFIED',
        confidence: 'HIGH',
        selected: true,
        statementItem: item,
        existingTx: matchedTx,
        draftTx,
        diffs: diffs || [],
        explanation: 'Statement has updated amount or installment details for this purchase.',
      });
    } else {
      // NEW transaction to add
      const draftTx: Transaction = {
        id: `tx_stmt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${recIdx}`,
        date: item.date || statement.closeDate || new Date().toISOString().substring(0, 10),
        timestamp: new Date(item.date || statement.closeDate || Date.now()).toISOString(),
        title: item.cleanTitle || 'Credit Card Expense',
        category: item.category || 'General',
        account: targetAccountName,
        amount: itemAmount,
        currency: itemCurrency,
        type: 'EXPENSE',
        statementCloseDate: statement.closeDate,
        description: item.rawDescription || 'Imported from Credit Card Statement PDF',
        installments: item.installmentTotal && item.installmentCurrent ? `${item.installmentCurrent}/${item.installmentTotal}` : undefined,
        installmentNumber: item.installmentCurrent || undefined,
        totalInstallments: item.installmentTotal || undefined,
      };

      reconciliationItems.push({
        id,
        status: 'NEW',
        confidence: 'HIGH',
        selected: true,
        statementItem: item,
        draftTx,
        diffs: [],
        explanation: 'Expense found on statement but not yet recorded in the app.',
      });
    }
  });

  // Pass 3: App Only Transactions (Expenses logged in the app for that card/period that were NOT on the statement)
  const usedTxIds = new Set([...matchedTxIds, ...modifiedTxIds]);
  const appOnlyTxs = candidateTxs.filter(t => !usedTxIds.has(t.id));

  appOnlyTxs.forEach(t => {
    reconciliationItems.push({
      id: `app_only_${t.id}`,
      status: 'APP_ONLY',
      confidence: 'MEDIUM',
      selected: false,
      existingTx: t,
      draftTx: { ...t },
      diffs: [],
      explanation: 'Recorded in app, but does not appear on this credit card statement.',
    });
  });

  // Calculate Summary Metrics
  const statementTotal = statement.statementTotal > 0
    ? statement.statementTotal
    : statement.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const statementCount = statement.items.length;

  const appTotal = candidateTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const appCount = candidateTxs.length;

  const newItems = reconciliationItems.filter(r => r.status === 'NEW');
  const modifiedItems = reconciliationItems.filter(r => r.status === 'MODIFIED');
  const matchedItems = reconciliationItems.filter(r => r.status === 'MATCHED');
  const appOnlyItems = reconciliationItems.filter(r => r.status === 'APP_ONLY');

  const newTotal = newItems.reduce((sum, r) => sum + (Number(r.draftTx.amount) || 0), 0);
  const matchedTotal = matchedItems.reduce((sum, r) => sum + (Number(r.existingTx?.amount) || 0), 0);
  const appOnlyTotal = appOnlyItems.reduce((sum, r) => sum + (Number(r.existingTx?.amount) || 0), 0);

  const summary: StatementReconciliationSummary = {
    statementTotal,
    statementCount,
    appTotal,
    appCount,
    difference: statementTotal - appTotal,
    newCount: newItems.length,
    newTotal,
    modifiedCount: modifiedItems.length,
    matchedCount: matchedItems.length,
    matchedTotal,
    appOnlyCount: appOnlyItems.length,
    appOnlyTotal,
  };

  return { reconciliationItems, summary };
}

/**
 * High-quality mock statement generator for instant demo or offline testing
 */
export function getDemoStatementData(accountName: string = 'Visa Santander'): StatementParsedData {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prevMonth = String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0');
  const prevYear = now.getMonth() === 0 ? year - 1 : year;

  return {
    issuer: accountName.includes('Master') ? 'Mastercard' : accountName.includes('Amex') ? 'American Express' : 'Visa Santander',
    cardLast4: '4821',
    periodStart: `${prevYear}-${prevMonth}-18`,
    periodEnd: `${year}-${month}-17`,
    closeDate: `${year}-${month}-17`,
    dueDate: `${year}-${month}-26`,
    currency: 'ARS',
    statementTotal: 294850.00,
    items: [
      {
        date: `${prevYear}-${prevMonth}-20`,
        rawDescription: 'COTO SUCURSAL 14 CABALLITO',
        cleanTitle: 'Coto Supermercado',
        amount: 48620.00,
        currency: 'ARS',
        category: 'Food & Dining',
        installmentCurrent: null,
        installmentTotal: null,
        cardholder: 'Titular',
      },
      {
        date: `${prevYear}-${prevMonth}-24`,
        rawDescription: 'YPF OP 4819 PALERMO',
        cleanTitle: 'YPF Combustible',
        amount: 32400.00,
        currency: 'ARS',
        category: 'Transportation',
        installmentCurrent: null,
        installmentTotal: null,
        cardholder: 'Titular',
      },
      {
        date: `${prevYear}-${prevMonth}-28`,
        rawDescription: 'FARMACITY SUC 120 BUENOS AIRES',
        cleanTitle: 'Farmacity',
        amount: 14850.00,
        currency: 'ARS',
        category: 'Healthcare',
        installmentCurrent: null,
        installmentTotal: null,
        cardholder: 'Titular',
      },
      {
        date: `${year}-${month}-02`,
        rawDescription: 'FRAVEGA DIGITAL C.03/06',
        cleanTitle: 'Frávega',
        amount: 28900.00,
        currency: 'ARS',
        category: 'Electronics',
        installmentCurrent: 3,
        installmentTotal: 6,
        cardholder: 'Titular',
      },
      {
        date: `${year}-${month}-05`,
        rawDescription: 'MERCADOLIBRE *TECHSTORE C.02/03',
        cleanTitle: 'MercadoLibre TechStore',
        amount: 38500.00,
        currency: 'ARS',
        category: 'Shopping',
        installmentCurrent: 2,
        installmentTotal: 3,
        cardholder: 'Titular',
      },
      {
        date: `${year}-${month}-08`,
        rawDescription: 'UBER *TRIP BUENOS AIRES',
        cleanTitle: 'Uber',
        amount: 6780.00,
        currency: 'ARS',
        category: 'Transportation',
        installmentCurrent: null,
        installmentTotal: null,
        cardholder: 'Titular',
      },
      {
        date: `${year}-${month}-11`,
        rawDescription: 'NETFLIX.COM INTERNET',
        cleanTitle: 'Netflix Subscription',
        amount: 9800.00,
        currency: 'ARS',
        category: 'Entertainment',
        installmentCurrent: null,
        installmentTotal: null,
        cardholder: 'Titular',
      },
      {
        date: `${year}-${month}-14`,
        rawDescription: 'MERCADOPAGO*RESTAURANTE EL CUARTITO',
        cleanTitle: 'Pizzería El Cuartito',
        amount: 25000.00,
        currency: 'ARS',
        category: 'Food & Dining',
        installmentCurrent: null,
        installmentTotal: null,
        cardholder: 'Titular',
      },
      {
        date: `${year}-${month}-15`,
        rawDescription: 'STARBUCKS COFFEE ALTO PALERMO',
        cleanTitle: 'Starbucks',
        amount: 7200.00,
        currency: 'ARS',
        category: 'Food & Dining',
        installmentCurrent: null,
        installmentTotal: null,
        cardholder: 'Titular',
      },
      {
        date: `${year}-${month}-16`,
        rawDescription: 'SPOTIFY AB INTERNET',
        cleanTitle: 'Spotify',
        amount: 4800.00,
        currency: 'ARS',
        category: 'Entertainment',
        installmentCurrent: null,
        installmentTotal: null,
        cardholder: 'Titular',
      },
      {
        date: `${year}-${month}-16`,
        rawDescription: 'COMISION MANTENIMIENTO DE CUENTA',
        cleanTitle: 'Mantenimiento de Cuenta',
        amount: 78000.00,
        currency: 'ARS',
        category: 'Services',
        installmentCurrent: null,
        installmentTotal: null,
        cardholder: null,
      },
    ],
    payments: [
      {
        date: `${year}-${month}-01`,
        description: 'Su pago en pesos - Transferencia',
        amount: 220000.00,
        currency: 'ARS',
      }
    ]
  };
}
