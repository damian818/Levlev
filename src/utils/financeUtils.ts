import { Transaction, DisplayCurrency, RecurringRule, PendingRecurringItem, TrendPoint, PredictiveMetrics, BudgetGoal, IdentifiedRecurringItem, RecurringOccurrence, InflationPoint, CreditCardStatement, CreditCardClosingRule, ClosingRuleType, AccountItem, AccountCustomBalance, ProjectedBalancePoint, ProjectedBalanceCalculation } from '../types';

export function isCreditCardAccount(
  accountName: string, 
  customCCMap?: Record<string, boolean> | AccountItem[],
  accountsList?: AccountItem[]
): boolean {
  const normName = (accountName || '').toLowerCase().trim();

  // 1. If customCCMap is an array of AccountItem
  if (Array.isArray(customCCMap)) {
    const match = customCCMap.find(a => (a.name || '').toLowerCase().trim() === normName);
    if (match && match.type) {
      return match.type === 'CREDIT_CARD';
    }
  } else if (customCCMap && typeof customCCMap === 'object' && customCCMap[accountName] !== undefined) {
    return customCCMap[accountName];
  }

  // 2. If accountsList is provided
  if (accountsList && Array.isArray(accountsList)) {
    const match = accountsList.find(a => (a.name || '').toLowerCase().trim() === normName);
    if (match && match.type) {
      return match.type === 'CREDIT_CARD';
    }
  }

  // 3. Fallback keyword search
  const keywords = ['visa', 'master', 'tarjeta', 'tc', 'cc', 'credit', 'credito', 'crédito', 'amex', 'naranja', 'comafi', 'caball', 'american express'];
  return keywords.some(kw => normName.includes(kw));
}

/**
 * Calculates the exact close Date for a given month and year using a CreditCardClosingRule.
 */
export function getCloseDateForMonthAndYear(
  year: number,
  monthIndex: number, // 0-indexed (0 = Jan, 11 = Dec)
  rule?: CreditCardClosingRule
): Date {
  const normRule: CreditCardClosingRule = rule || { ruleType: 'FIXED_DAY', fixedDay: 25 };
  
  if (normRule.ruleType === 'FIXED_DAY') {
    const fixedDay = normRule.fixedDay ?? 25;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const day = Math.min(fixedDay, daysInMonth);
    return new Date(year, monthIndex, day);
  }

  const targetWeekday = normRule.weekday ?? 4; // default 4 = Thursday
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const matchingDays: number[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, monthIndex, d);
    if (dt.getDay() === targetWeekday) {
      matchingDays.push(d);
    }
  }

  if (matchingDays.length === 0) {
    return new Date(year, monthIndex, 25);
  }

  let chosenDay = matchingDays[matchingDays.length - 1]; // default last

  if (normRule.ruleType === 'LAST_WEEKDAY') {
    chosenDay = matchingDays[matchingDays.length - 1];
  } else if (normRule.ruleType === 'PREVIOUS_TO_LAST_WEEKDAY') {
    const idx = Math.max(0, matchingDays.length - 2);
    chosenDay = matchingDays[idx];
  } else if (normRule.ruleType === 'NTH_WEEKDAY') {
    const nth = normRule.nth ?? 3;
    const idx = Math.min(matchingDays.length - 1, Math.max(0, nth - 1));
    chosenDay = matchingDays[idx];
  }

  return new Date(year, monthIndex, chosenDay);
}

/**
 * Returns human-readable summary label of a CreditCardClosingRule.
 */
export function getClosingRuleLabel(rule?: CreditCardClosingRule): string {
  if (!rule || rule.ruleType === 'FIXED_DAY') {
    return `Day ${rule?.fixedDay || 25} of each month`;
  }
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const nthLabels = ['1st', '2nd', '3rd', '4th'];
  const wName = weekdays[rule.weekday ?? 4];

  if (rule.ruleType === 'LAST_WEEKDAY') {
    return `Last ${wName} of month`;
  }
  if (rule.ruleType === 'PREVIOUS_TO_LAST_WEEKDAY') {
    return `Previous to last ${wName} of month`;
  }
  if (rule.ruleType === 'NTH_WEEKDAY') {
    const nthLabel = nthLabels[(rule.nth ?? 3) - 1] || `${rule.nth}th`;
    return `${nthLabel} ${wName} of month`;
  }
  return `Day ${rule.fixedDay || 25}`;
}

export function getStatementCloseDateForTx(
  dateStr: string,
  ruleOrCloseDay?: number | CreditCardClosingRule
): string {
  if (!dateStr) return '';
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return '';

  const rule: CreditCardClosingRule = typeof ruleOrCloseDay === 'number'
    ? { ruleType: 'FIXED_DAY', fixedDay: ruleOrCloseDay }
    : (ruleOrCloseDay || { ruleType: 'FIXED_DAY', fixedDay: 25 });

  const year = dt.getFullYear();
  const monthIdx = dt.getMonth(); // 0-indexed

  // Calculate close date for current month
  const closeCurrent = getCloseDateForMonthAndYear(year, monthIdx, rule);
  const pad = (n: number) => String(n).padStart(2, '0');
  const closeCurrentStr = `${closeCurrent.getFullYear()}-${pad(closeCurrent.getMonth() + 1)}-${pad(closeCurrent.getDate())}`;

  // Check if tx date is on or before closeCurrent
  const txDateOnly = dateStr.substring(0, 10);
  if (txDateOnly <= closeCurrentStr) {
    return closeCurrentStr;
  }

  // Otherwise, it falls into next month's closing date
  const nextYear = monthIdx === 11 ? year + 1 : year;
  const nextMonthIdx = monthIdx === 11 ? 0 : monthIdx + 1;
  const closeNext = getCloseDateForMonthAndYear(nextYear, nextMonthIdx, rule);
  return `${closeNext.getFullYear()}-${pad(closeNext.getMonth() + 1)}-${pad(closeNext.getDate())}`;
}

export const calculateStatementCloseDate = getStatementCloseDateForTx;

export function getStatementCloseDateForPayment(
  dateStr: string,
  ruleOrCloseDay?: number | CreditCardClosingRule
): string {
  if (!dateStr) return '';
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return '';

  const rule: CreditCardClosingRule = typeof ruleOrCloseDay === 'number'
    ? { ruleType: 'FIXED_DAY', fixedDay: ruleOrCloseDay }
    : (ruleOrCloseDay || { ruleType: 'FIXED_DAY', fixedDay: 25 });

  const year = dt.getFullYear();
  const monthIdx = dt.getMonth(); // 0-indexed
  const pad = (n: number) => String(n).padStart(2, '0');

  // Calculate close date for current month
  const closeCurrent = getCloseDateForMonthAndYear(year, monthIdx, rule);
  const closeCurrentStr = `${closeCurrent.getFullYear()}-${pad(closeCurrent.getMonth() + 1)}-${pad(closeCurrent.getDate())}`;

  const dateOnly = dateStr.substring(0, 10);

  // If the payment date is ON or AFTER current month's close date,
  // then the statement that closed most recently on or before payment date IS closeCurrentStr!
  if (dateOnly >= closeCurrentStr) {
    return closeCurrentStr;
  }

  // Otherwise, if payment date is BEFORE current month's close date,
  // the statement that closed most recently on or before payment date is PREVIOUS month's close date!
  const prevYear = monthIdx === 0 ? year - 1 : year;
  const prevMonthIdx = monthIdx === 0 ? 11 : monthIdx - 1;
  const closePrev = getCloseDateForMonthAndYear(prevYear, prevMonthIdx, rule);
  return `${closePrev.getFullYear()}-${pad(closePrev.getMonth() + 1)}-${pad(closePrev.getDate())}`;
}

export function getUpcomingStatementCloseDates(
  txDateStr: string,
  closingRule?: CreditCardClosingRule,
  countPast: number = 3,
  countFuture: number = 8
): { dateStr: string; label: string; isDefault: boolean }[] {
  const dt = txDateStr ? new Date(txDateStr) : new Date();
  const baseYear = isNaN(dt.getTime()) ? new Date().getFullYear() : dt.getFullYear();
  const baseMonth = isNaN(dt.getTime()) ? new Date().getMonth() : dt.getMonth();

  const rule: CreditCardClosingRule = closingRule || { ruleType: 'FIXED_DAY', fixedDay: 25 };
  const defaultCloseStr = getStatementCloseDateForTx(txDateStr || new Date().toISOString().substring(0, 10), rule);

  const pad = (n: number) => String(n).padStart(2, '0');
  const results: { dateStr: string; label: string; isDefault: boolean }[] = [];
  const seen = new Set<string>();

  for (let offset = -countPast; offset <= countFuture; offset++) {
    const d = new Date(baseYear, baseMonth + offset, 1);
    const closeDt = getCloseDateForMonthAndYear(d.getFullYear(), d.getMonth(), rule);
    const dateStr = `${closeDt.getFullYear()}-${pad(closeDt.getMonth() + 1)}-${pad(closeDt.getDate())}`;

    if (!seen.has(dateStr)) {
      seen.add(dateStr);
      const monthName = closeDt.toLocaleString('en-US', { month: 'short' });
      const isDefault = dateStr === defaultCloseStr;
      const label = `${closeDt.getDate()} ${monthName} ${closeDt.getFullYear()}${isDefault ? ' (Current Period)' : ''}`;
      results.push({ dateStr, label, isDefault });
    }
  }

  return results.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

export function getCreditCardStatements(
  transactions: Transaction[],
  accountName: string,
  defaultCloseDayOrRule: number | CreditCardClosingRule = 25,
  statusOverrides?: Record<string, 'PAID' | 'OPEN'>
): CreditCardStatement[] {
  const accountTxs = transactions.filter(t => 
    t.account === accountName || t.toAccount === accountName
  );

  const rule: CreditCardClosingRule = typeof defaultCloseDayOrRule === 'number'
    ? { ruleType: 'FIXED_DAY', fixedDay: defaultCloseDayOrRule }
    : defaultCloseDayOrRule;

  const dueDaysAfterClose = rule.dueDaysAfterClose ?? 10;
  const pad = (n: number) => String(n).padStart(2, '0');

  // 1. Separate expenses and payments
  const expenses: Transaction[] = [];
  const payments: Transaction[] = [];

  accountTxs.forEach(tx => {
    const isExpenseOnThisCard = tx.account === accountName && tx.type === 'EXPENSE';
    const isPaymentToThisCard = tx.toAccount === accountName || tx.type === 'CC_PAYMENT' || (tx.type === 'TRANSFER' && tx.toAccount === accountName) || (tx.account === accountName && tx.type === 'INCOME');

    if (isExpenseOnThisCard) {
      expenses.push(tx);
    } else if (isPaymentToThisCard) {
      payments.push(tx);
    }
  });

  // 2. Identify all statement close dates
  const closeDateSet = new Set<string>();

  expenses.forEach(tx => {
    let cDate = tx.statementCloseDate;
    if (!cDate && tx.date) {
      cDate = getStatementCloseDateForTx(tx.date, rule);
    }
    if (cDate) closeDateSet.add(cDate);
  });

  payments.forEach(tx => {
    if (tx.date) {
      const cDate = tx.statementCloseDate || getStatementCloseDateForPayment(tx.date, rule);
      if (cDate) {
        closeDateSet.add(cDate);
      }
    }
  });

  // Always ensure at least the current month's statement close date exists
  const now = new Date();
  const currentClose = getCloseDateForMonthAndYear(now.getFullYear(), now.getMonth(), rule);
  const currentCloseStr = `${currentClose.getFullYear()}-${pad(currentClose.getMonth() + 1)}-${pad(currentClose.getDate())}`;
  closeDateSet.add(currentCloseStr);

  const sortedCloseDates = Array.from(closeDateSet).sort((a, b) => a.localeCompare(b));

  // 3. Create statement structures
  const statementMap = new Map<string, {
    closeDate: string;
    dueDate: string;
    expenses: Transaction[];
    payments: Transaction[];
    totalExpenses: number;
    allocatedPaymentsSum: number;
  }>();

  sortedCloseDates.forEach(closeDate => {
    const cDate = new Date(closeDate);
    let dueDate = '';
    if (!isNaN(cDate.getTime())) {
      cDate.setDate(cDate.getDate() + dueDaysAfterClose);
      dueDate = `${cDate.getFullYear()}-${pad(cDate.getMonth() + 1)}-${pad(cDate.getDate())}`;
    }
    statementMap.set(closeDate, {
      closeDate,
      dueDate,
      expenses: [],
      payments: [],
      totalExpenses: 0,
      allocatedPaymentsSum: 0,
    });
  });

  // Assign expenses to their respective statement cycles
  expenses.forEach(tx => {
    let cDate = tx.statementCloseDate;
    if (!cDate && tx.date) {
      cDate = getStatementCloseDateForTx(tx.date, rule);
    }
    if (!cDate) cDate = currentCloseStr;

    if (!statementMap.has(cDate)) {
      const d = new Date(cDate);
      let dueDate = '';
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + dueDaysAfterClose);
        dueDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
      statementMap.set(cDate, {
        closeDate: cDate,
        dueDate,
        expenses: [],
        payments: [],
        totalExpenses: 0,
        allocatedPaymentsSum: 0,
      });
    }

    const stmt = statementMap.get(cDate)!;
    stmt.expenses.push(tx);
    stmt.totalExpenses += (tx.amount || 0);
  });

  // Sort payments chronologically ascending by date
  const sortedPayments = [...payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 4. Allocate payments: assign each payment directly to its corresponding statement cycle based on payment date
  sortedPayments.forEach(p => {
    const pAmt = (p.receiveAmount && p.receiveAmount > 0) 
      ? p.receiveAmount 
      : ((p.transferAmount && p.transferAmount > 0) ? p.transferAmount : p.amount || 0);
    
    if (pAmt <= 0) return;

    // Determine target statement close date for this payment
    const targetCloseDate = p.statementCloseDate || getStatementCloseDateForPayment(p.date, rule);
    let stmt = statementMap.get(targetCloseDate);

    // If target close date is not explicitly in statementMap, assign to closest cycle or currentCloseStr
    if (!stmt) {
      const activeCloseDates = Array.from(statementMap.keys()).sort((a, b) => a.localeCompare(b));
      let closestDate = currentCloseStr;
      for (let i = 0; i < activeCloseDates.length; i++) {
        if (activeCloseDates[i] >= p.date) {
          closestDate = activeCloseDates[i];
          break;
        }
      }
      stmt = statementMap.get(closestDate) || statementMap.get(currentCloseStr);
    }

    if (stmt) {
      stmt.allocatedPaymentsSum += pAmt;
      stmt.payments.push({
        ...p,
        amount: pAmt,
        transferAmount: p.transferAmount ? pAmt : undefined,
        receiveAmount: p.receiveAmount ? pAmt : undefined,
      });
    }
  });

  // 5. Build final result array
  const result: CreditCardStatement[] = [];

  statementMap.forEach((val, closeDate) => {
    if (val.expenses.length === 0 && val.payments.length === 0 && closeDate !== currentCloseStr) {
      return;
    }

    const totalExpenses = val.totalExpenses;
    const totalPayments = val.allocatedPaymentsSum;
    const currency = val.expenses[0]?.currency || val.payments[0]?.currency || 'ARS';
    const periodMonth = closeDate.substring(0, 7);

    // All past historical statement periods (closeDate < currentCloseStr) are considered Paid
    const isPastPeriod = closeDate < currentCloseStr;
    const rawNetDue = totalExpenses - totalPayments;

    const overrideKey = `${accountName}|${closeDate}`;
    const overrideStatus = statusOverrides?.[overrideKey] || statusOverrides?.[closeDate];

    let isPaid: boolean;
    let netDue: number;
    let isManualOverride = false;

    if (overrideStatus === 'PAID') {
      isPaid = true;
      netDue = 0;
      isManualOverride = true;
    } else if (overrideStatus === 'OPEN') {
      isPaid = false;
      netDue = Math.max(0, rawNetDue > 0 ? rawNetDue : totalExpenses);
      isManualOverride = true;
    } else {
      netDue = isPastPeriod ? 0 : Math.max(0, rawNetDue);
      isPaid = isPastPeriod || (rawNetDue <= 0);
    }

    result.push({
      accountName,
      statementPeriod: periodMonth,
      closeDate,
      dueDate: val.dueDate,
      totalExpenses,
      totalPayments,
      netDue,
      currency,
      expenses: val.expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      payments: val.payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      isPaid,
      isManualOverride,
      overrideStatus,
    });
  });

  return result.sort((a, b) => b.closeDate.localeCompare(a.closeDate));
}
import { historicalInflationAndFX } from '../data/defaultTransactions';
import { 
  CURRENCY_MAP, 
  getActiveGlobalFxRates, 
  DEFAULT_GLOBAL_FX_RATES 
} from './currencyUtils';

// Cache for historical rates derived from explicit user transfers
const transferFxCache = new Map<string, number>();

/**
 * Returns the historical USD/ARS rate for a given transaction date or month (YYYY-MM).
 * Prioritizes:
 * 1. Historical FX rate table (historyOverride or historicalInflationAndFX) for that month
 * 2. Explicit transfer execution rates in user transactions for that month
 * 3. Fallback to current rate
 */
export function getHistoricalFxRate(
  dateStr?: string,
  fallbackRate: number = 1496,
  transactions?: Transaction[],
  historyOverride?: InflationPoint[]
): number {
  if (!dateStr) return fallbackRate;

  const monthKey = dateStr.length >= 7 ? dateStr.substring(0, 7) : dateStr;

  // 1. Historical FX rate table (historyOverride or historicalInflationAndFX) for monthKey
  const table = historyOverride || historicalInflationAndFX;
  const historicalPoint = table.find(pt => pt.month === monthKey);
  if (historicalPoint && historicalPoint.usdArsRate > 0) {
    return historicalPoint.usdArsRate;
  }

  // 2. Derived from explicit TRANSFER transactions in dataset for that month
  if (transactions && transactions.length > 0) {
    if (transferFxCache.has(monthKey)) {
      return transferFxCache.get(monthKey)!;
    }

    let totalUsd = 0;
    let totalArs = 0;

    transactions.forEach(tx => {
      const txMonth = tx.date ? tx.date.substring(0, 7) : '';
      if (txMonth === monthKey && tx.type === 'TRANSFER') {
        const fromIsUsd = tx.currency?.toUpperCase().includes('USD') || tx.transferCurrency?.toUpperCase().includes('USD');
        const toIsArs = tx.receiveCurrency?.toUpperCase().includes('ARS');
        const fromIsArs = tx.currency?.toUpperCase().includes('ARS') || tx.transferCurrency?.toUpperCase().includes('ARS');
        const toIsUsd = tx.receiveCurrency?.toUpperCase().includes('USD');

        if (fromIsUsd && toIsArs && tx.transferAmount && tx.receiveAmount && tx.transferAmount > 0) {
          totalUsd += tx.transferAmount;
          totalArs += tx.receiveAmount;
        } else if (fromIsArs && toIsUsd && tx.transferAmount && tx.receiveAmount && tx.receiveAmount > 0) {
          totalUsd += tx.receiveAmount;
          totalArs += tx.transferAmount;
        }
      }
    });

    if (totalUsd > 0 && totalArs > 0) {
      const derivedRate = totalArs / totalUsd;
      transferFxCache.set(monthKey, derivedRate);
      return derivedRate;
    }
  }

  // 3. Earliest / latest table boundary check or fallback rate
  const sortedTable = [...historicalInflationAndFX].sort((a, b) => a.month.localeCompare(b.month));
  if (sortedTable.length > 0) {
    if (monthKey < sortedTable[0].month) {
      return sortedTable[0].usdArsRate;
    }
  }

  return fallbackRate;
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: DisplayCurrency,
  usdArsRate: number = 1496,
  dateStr?: string,
  transactions?: Transaction[],
  historyOverride?: InflationPoint[],
  customRates?: Record<string, number>
): number {
  if (amount === 0 || isNaN(amount)) return 0;

  const fromCode = (fromCurrency || 'ARS').toUpperCase().trim();
  const toCode = (toCurrency || 'ARS').toUpperCase().trim();

  if (fromCode === toCode) return amount;

  const effectiveUsdArsRate = getHistoricalFxRate(dateStr, usdArsRate, transactions, historyOverride);
  const activeRates = customRates || getActiveGlobalFxRates() || DEFAULT_GLOBAL_FX_RATES;

  // Convert 'fromCurrency' amount to USD first
  let amountInUSD = amount;
  if (fromCode === 'ARS') {
    amountInUSD = effectiveUsdArsRate > 0 ? amount / effectiveUsdArsRate : 0;
  } else if (fromCode === 'USD' || fromCode === 'USDT') {
    amountInUSD = amount;
  } else if (activeRates[fromCode] && activeRates[fromCode] > 0) {
    amountInUSD = amount / activeRates[fromCode];
  } else {
    amountInUSD = amount; // Fallback 1:1 if rate unknown
  }

  // Convert USD amount to 'toCurrency'
  if (toCode === 'USD' || toCode === 'USDT') {
    return amountInUSD;
  } else if (toCode === 'ARS') {
    return amountInUSD * effectiveUsdArsRate;
  } else if (activeRates[toCode] && activeRates[toCode] > 0) {
    return amountInUSD * activeRates[toCode];
  }

  return amountInUSD;
}

let globalPrivacyMode = false;

export function setGlobalPrivacyMode(enabled: boolean) {
  globalPrivacyMode = enabled;
  if (typeof window !== 'undefined') {
    localStorage.setItem('levlev_privacy_mode', enabled ? 'true' : 'false');
  }
}

export function getGlobalPrivacyMode(): boolean {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('levlev_privacy_mode');
    if (saved !== null) {
      return saved === 'true';
    }
  }
  return globalPrivacyMode;
}

export function maskValue(val: string | number, forcePrivacy?: boolean): string {
  const isPrivate = forcePrivacy !== undefined ? forcePrivacy : getGlobalPrivacyMode();
  if (isPrivate) {
    return '••••••';
  }
  return String(val);
}

export function formatCurrency(amount: number, currency: DisplayCurrency, forcePrivacy?: boolean): string {
  const isPrivate = forcePrivacy !== undefined ? forcePrivacy : getGlobalPrivacyMode();
  if (isPrivate) {
    return '••••••';
  }

  const curr = (currency || 'USD').toUpperCase().trim();
  const meta = CURRENCY_MAP[curr];

  const locale = meta?.locale || (curr === 'ARS' ? 'es-AR' : 'en-US');
  const currencyCode = (curr === 'USDT' || !meta) ? 'USD' : curr;

  try {
    const isZeroDecimals = (meta?.decimals === 0) || (curr === 'ARS' && Math.abs(amount % 1) < 0.01) || (curr === 'CLP') || (curr === 'JPY');
    const hasCents = Math.abs(amount % 1) >= 0.005;

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: isZeroDecimals && !hasCents ? 0 : 2,
      maximumFractionDigits: isZeroDecimals && !hasCents ? 0 : 2,
    }).format(amount);
  } catch (e) {
    const symbol = meta?.symbol || '$';
    return `${symbol} ${amount.toFixed(2)}`;
  }
}

export function formatCurrencyCompact(amount: number, currency: DisplayCurrency, forcePrivacy?: boolean): string {
  const isPrivate = forcePrivacy !== undefined ? forcePrivacy : getGlobalPrivacyMode();
  if (isPrivate) {
    return '••••••';
  }

  const curr = (currency || 'USD').toUpperCase().trim();
  const meta = CURRENCY_MAP[curr];

  if (Math.abs(amount) < 1000) {
    return formatCurrency(amount, currency, forcePrivacy);
  }

  const locale = meta?.locale || (curr === 'ARS' ? 'es-AR' : 'en-US');
  const currencyCode = (curr === 'USDT' || !meta) ? 'USD' : curr;

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    });
    return formatter.format(amount);
  } catch (e) {
    const symbol = meta?.symbol || '$';
    return `${symbol} ${(amount / 1000).toFixed(1)}k`;
  }
}

export interface AccountSummary {
  accountName: string;
  originalCurrency: string;
  balanceOriginal: number;
  balanceARS: number;
  balanceUSD: number;
  txCount: number;
}

export function getTransferOutflow(
  tx: {
    amount?: number;
    transferAmount?: number;
    receiveAmount?: number;
    currency?: string;
    transferCurrency?: string;
    receiveCurrency?: string;
    account?: string;
    toAccount?: string;
  },
  usdArsRate: number = 1200,
  originCurrency?: string,
  destCurrency?: string
): number {
  const originCurr = (originCurrency || tx.transferCurrency || tx.currency || (tx.account?.toLowerCase().includes('usd') ? 'USD' : 'ARS')).toUpperCase();
  const destCurr = (destCurrency || tx.receiveCurrency || (tx.toAccount?.toLowerCase().includes('usd') ? 'USD' : 'ARS')).toUpperCase();

  if (tx.transferAmount !== undefined && tx.transferAmount !== null && Number(tx.transferAmount) > 0) {
    return Number(tx.transferAmount);
  }
  if (tx.amount !== undefined && tx.amount !== null && Number(tx.amount) > 0) {
    return Number(tx.amount);
  }
  if (tx.receiveAmount !== undefined && tx.receiveAmount !== null && Number(tx.receiveAmount) > 0) {
    const recAmt = Number(tx.receiveAmount);
    if (originCurr.includes('USD') && destCurr.includes('ARS') && usdArsRate > 0) {
      return recAmt / usdArsRate;
    } else if (originCurr.includes('ARS') && destCurr.includes('USD') && usdArsRate > 0) {
      return recAmt * usdArsRate;
    }
    return recAmt;
  }
  return 0;
}

export function getTransferInflow(
  tx: {
    amount?: number;
    transferAmount?: number;
    receiveAmount?: number;
    currency?: string;
    transferCurrency?: string;
    receiveCurrency?: string;
    account?: string;
    toAccount?: string;
  },
  usdArsRate: number = 1200,
  originCurrency?: string,
  destCurrency?: string
): number {
  const originCurr = (originCurrency || tx.transferCurrency || tx.currency || (tx.account?.toLowerCase().includes('usd') ? 'USD' : 'ARS')).toUpperCase();
  const destCurr = (destCurrency || tx.receiveCurrency || (tx.toAccount?.toLowerCase().includes('usd') ? 'USD' : 'ARS')).toUpperCase();

  if (tx.receiveAmount !== undefined && tx.receiveAmount !== null && Number(tx.receiveAmount) > 0) {
    return Number(tx.receiveAmount);
  }
  if (tx.transferAmount !== undefined && tx.transferAmount !== null && Number(tx.transferAmount) > 0) {
    const transAmt = Number(tx.transferAmount);
    if (originCurr.includes('USD') && destCurr.includes('ARS') && usdArsRate > 0) {
      return transAmt * usdArsRate;
    } else if (originCurr.includes('ARS') && destCurr.includes('USD') && usdArsRate > 0) {
      return transAmt / usdArsRate;
    }
    return transAmt;
  }
  if (tx.amount !== undefined && tx.amount !== null && Number(tx.amount) > 0) {
    const amt = Number(tx.amount);
    if (originCurr.includes('USD') && destCurr.includes('ARS') && usdArsRate > 0) {
      return amt * usdArsRate;
    } else if (originCurr.includes('ARS') && destCurr.includes('USD') && usdArsRate > 0) {
      return amt / usdArsRate;
    }
    return amt;
  }
  return 0;
}

export function computeAccountBalances(
  transactions: Transaction[],
  usdArsRate: number,
  customBalances?: Record<string, { currentBalance: number; currency: string }>,
  accountsList?: AccountItem[]
): AccountSummary[] {
  const accountDeltas: { [name: string]: { netDelta: number; currency: string; count: number } } = {};
  const todayStr = getTodayString();

  const getAccountCurrency = (accName: string, fallbackCurrency?: string): string => {
    if (customBalances?.[accName]?.currency) {
      return customBalances[accName].currency;
    }
    if (accountsList) {
      const match = accountsList.find(a => a.name === accName);
      if (match?.currency) return match.currency;
    }
    if (fallbackCurrency) return fallbackCurrency;
    if (accName.toLowerCase().includes('usd')) return 'USD';
    return 'ARS';
  };

  transactions.forEach(tx => {
    const acc = tx.account || 'Unknown';
    const originCurr = getAccountCurrency(acc, (tx.type === 'TRANSFER' && tx.transferCurrency) ? tx.transferCurrency : tx.currency);

    if (!accountDeltas[acc]) {
      accountDeltas[acc] = { netDelta: 0, currency: originCurr, count: 0 };
    }
    accountDeltas[acc].count++;

    // Ignore future transactions for current balance calculation
    const txDateStr = tx.date ? tx.date.substring(0, 10) : '';
    if (txDateStr && txDateStr > todayStr) return;

    const amt = tx.amount || 0;

    if (tx.type === 'INCOME') {
      accountDeltas[acc].netDelta += amt;
    } else if (tx.type === 'EXPENSE') {
      accountDeltas[acc].netDelta -= amt;
    } else if (tx.type === 'TRANSFER' || tx.type === 'CC_PAYMENT') {
      const destAcc = tx.toAccount;
      const destCurr = destAcc ? getAccountCurrency(destAcc, tx.receiveCurrency) : originCurr;

      const outflow = getTransferOutflow(tx, usdArsRate, originCurr, destCurr);
      accountDeltas[acc].netDelta -= outflow;

      if (destAcc) {
        const inflow = getTransferInflow(tx, usdArsRate, originCurr, destCurr);

        if (!accountDeltas[destAcc]) {
          accountDeltas[destAcc] = { netDelta: 0, currency: destCurr, count: 0 };
        }
        accountDeltas[destAcc].netDelta += inflow;
      }
    }
  });

  const allNamesList = Array.from(new Set([
    ...(accountsList ? accountsList.map(a => a.name) : []),
    ...Object.keys(accountDeltas),
    ...(customBalances ? Object.keys(customBalances) : [])
  ]));

  const accountOrderMap = new Map<string, number>();
  if (accountsList) {
    accountsList.forEach((acc, idx) => {
      accountOrderMap.set(acc.name.toLowerCase(), idx);
    });
  }

  const allNames = allNamesList.sort((a, b) => {
    const idxA = accountOrderMap.has(a.toLowerCase()) ? accountOrderMap.get(a.toLowerCase())! : 999;
    const idxB = accountOrderMap.has(b.toLowerCase()) ? accountOrderMap.get(b.toLowerCase())! : 999;
    if (idxA !== idxB) return idxA - idxB;
    return a.localeCompare(b);
  });

  return allNames
    .map(accName => {
      const deltaObj = accountDeltas[accName] || { netDelta: 0, currency: 'ARS', count: 0 };
      const custom = customBalances?.[accName];
      const accItem = accountsList?.find(a => a.name === accName);

      const currency = custom?.currency || accItem?.currency || deltaObj.currency || getAccountCurrency(accName);
      const balance = custom !== undefined ? custom.currentBalance : deltaObj.netDelta;

      const isUsd = currency.toUpperCase().includes('USD');
      const balARS = isUsd ? balance * usdArsRate : balance;
      const balUSD = isUsd ? balance : (usdArsRate > 0 ? balance / usdArsRate : 0);

      return {
        accountName: accName,
        originalCurrency: currency,
        balanceOriginal: balance,
        balanceARS: balARS,
        balanceUSD: balUSD,
        txCount: deltaObj.count,
      };
    })
    .filter(acc => acc.txCount > 0 || (customBalances && customBalances[acc.accountName] !== undefined) || (accountsList && accountsList.some(a => a.name === acc.accountName)));
}


export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getDefaultSelectedMonth(transactions: Transaction[]): string {
  const currentKey = getCurrentMonthKey();
  const set = new Set<string>();
  transactions.forEach(t => {
    if (t.date) {
      set.add(t.date.substring(0, 7));
    }
  });
  const months = Array.from(set).sort().reverse();

  if (months.includes(currentKey)) {
    return currentKey;
  }

  const validPastOrPresent = months.find(m => m <= currentKey);
  if (validPastOrPresent) {
    return validPastOrPresent;
  }

  return months[0] || currentKey;
}

export function getLatestMonth(transactions: Transaction[]): string {
  return getDefaultSelectedMonth(transactions);
}

export function deriveBudgetsFromTransactions(
  transactions: Transaction[],
  existingBudgets: BudgetGoal[] = []
): BudgetGoal[] {
  const existingMap = new Map<string, number>();
  existingBudgets.forEach(b => existingMap.set(b.category, b.monthlyLimitARS));

  const expenseCategories = new Set<string>();
  const categoryMonthlySums: Record<string, number> = {};

  transactions.forEach(t => {
    if (t.type === 'EXPENSE' && t.category) {
      expenseCategories.add(t.category);
      const amtARS = convertCurrency(t.amount, t.currency, 'ARS', 1521, t.date, transactions);
      categoryMonthlySums[t.category] = (categoryMonthlySums[t.category] || 0) + amtARS;
    }
  });

  if (expenseCategories.size === 0 && existingBudgets.length === 0) {
    return [];
  }

  const result: BudgetGoal[] = [...existingBudgets];

  expenseCategories.forEach(cat => {
    if (!existingMap.has(cat)) {
      const totalSpent = categoryMonthlySums[cat] || 0;
      const estimatedLimit = totalSpent > 0 ? Math.max(150000, Math.ceil((totalSpent * 1.2) / 50000) * 50000) : 350000;
      result.push({ category: cat, monthlyLimitARS: estimatedLimit });
    }
  });

  if (result.length === 0) {
    return [];
  }

  return result;
}

export function deriveSmartBudgets(
  transactions: Transaction[],
  existingBudgets: BudgetGoal[] = [],
  currentMonthKey: string,
  usdArsRate: number
): BudgetGoal[] {
  const expenseCategories = new Set<string>();
  const sumsByCatAndMonth: Record<string, Record<string, number>> = {};

  transactions.forEach(t => {
    if (t.type === 'EXPENSE' && t.category) {
      expenseCategories.add(t.category);
      const month = t.date.substring(0, 7);
      const amtARS = convertCurrency(t.amount, t.currency, 'ARS', usdArsRate, t.date, transactions);
      if (!sumsByCatAndMonth[t.category]) sumsByCatAndMonth[t.category] = {};
      sumsByCatAndMonth[t.category][month] = (sumsByCatAndMonth[t.category][month] || 0) + amtARS;
    }
  });

  const getPastMonths = (count: number) => {
    const dates = [];
    let [year, m] = currentMonthKey.split('-').map(Number);
    for (let i = 1; i <= count; i++) {
      m--;
      if (m === 0) {
        m = 12;
        year--;
      }
      dates.push(`${year}-${String(m).padStart(2, '0')}`);
    }
    return dates;
  };

  const m3 = getPastMonths(3);
  const m6 = getPastMonths(6);
  const m12 = getPastMonths(12);

  const getAvg = (cat: string, months: string[]) => {
    let sum = 0;
    months.forEach(m => {
      sum += sumsByCatAndMonth[cat]?.[m] || 0;
    });
    return sum / months.length;
  };

  const result: BudgetGoal[] = [];

  // For categories we already have a budget for or new ones? Let's do it for all existing budgets or top categories.
  // Actually, let's keep all existing categories and update them, plus any that might be new? The prompt says "suggest new targets". So we update existing and maybe add new.
  const categoriesToProcess = new Set([
    ...existingBudgets.map(b => b.category),
    ...Array.from(expenseCategories)
  ]);

  categoriesToProcess.forEach(cat => {
    const avg3 = getAvg(cat, m3);
    const avg6 = getAvg(cat, m6);
    const avg12 = getAvg(cat, m12);

    // Only consider averages > 0 to avoid setting a $0 budget if we didn't spend in those periods
    const validAvgs = [avg3, avg6, avg12].filter(a => a > 0);
    
    if (validAvgs.length > 0) {
      const bestAlternative = Math.min(...validAvgs); // The prompt says "Select the best alternative. Deduct 10% from it". We pick the lowest non-zero average to be aggressive.
      const suggestedLimit = bestAlternative * 0.9; // Deduct 10%
      result.push({ category: cat, monthlyLimitARS: Math.round(suggestedLimit) });
    } else {
      // Fallback: keep existing or ignore
      const existing = existingBudgets.find(b => b.category === cat);
      if (existing) {
        result.push(existing);
      }
    }
  });

  return result;
}

export function analyzeSpending(
  transactions: Transaction[], 
  displayCurrency: DisplayCurrency, 
  usdArsRate: number,
  targetMonth?: string
) {
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryMap: { [cat: string]: number } = {};
  const merchantMap: { [merchant: string]: { amount: number; category: string } } = {};
  const monthlyMap: { [month: string]: { income: number; expense: number } } = {};

  transactions.forEach(tx => {
    const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
    const monthKey = tx.date ? tx.date.substring(0, 7) : '2026-08';

    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { income: 0, expense: 0 };
    }

    if (tx.type === 'INCOME') {
      monthlyMap[monthKey].income += converted;
    } else if (tx.type === 'EXPENSE') {
      monthlyMap[monthKey].expense += converted;
    }

    // Only count towards totals, categories and merchants if targetMonth matches or targetMonth is 'ALL'
    if (!targetMonth || targetMonth === 'ALL' || monthKey === targetMonth) {
      if (tx.type === 'INCOME') {
        totalIncome += converted;
      } else if (tx.type === 'EXPENSE') {
        totalExpenses += converted;

        const cat = tx.category || 'Other';
        categoryMap[cat] = (categoryMap[cat] || 0) + converted;

        const merch = tx.title || 'Unknown';
        if (!merchantMap[merch]) {
          merchantMap[merch] = { amount: 0, category: cat };
        }
        merchantMap[merch].amount += converted;
      }
    }
  });

  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  const topCategories = Object.keys(categoryMap)
    .map(cat => ({ category: cat, amount: categoryMap[cat] }))
    .sort((a, b) => b.amount - a.amount);

  const topMerchants = Object.keys(merchantMap)
    .map(merch => ({ 
      merchant: merch, 
      amount: merchantMap[merch].amount,
      category: merchantMap[merch].category
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const monthlyTrend = Object.keys(monthlyMap)
    .sort()
    .map(m => ({
      month: m,
      income: monthlyMap[m].income,
      expense: monthlyMap[m].expense,
      net: monthlyMap[m].income - monthlyMap[m].expense
    }));

  return {
    totalIncome,
    totalExpenses,
    netSavings: totalIncome - totalExpenses,
    savingsRate,
    topCategories,
    topMerchants,
    monthlyTrend
  };
}

/**
 * Calculates 'projected balance' by combining actual transaction history with upcoming non-excluded recurring transactions.
 * 
 * 1. Computes starting / current liquid balance from actual past and present transactions (plus any custom initial balances).
 * 2. Gathers actual historical monthly transaction flows to build the past actual balance trajectory.
 * 3. Identifies the current month state: actual past transactions up to today, daily spending velocity, and upcoming non-excluded recurring transactions (incomes + expenses).
 * 4. Combines actual transaction history with upcoming non-excluded recurring transactions (including manual rules, auto-detected recurring patterns, and active installments) to project future monthly balances.
 * 5. Returns a structured calculation result with month-by-month historical and projected balance points, current balance, projected EOM balance, upcoming recurring breakdown, and net trajectory deltas.
 */
export function calculateProjectedBalance(
  transactions: Transaction[],
  recurringRules: RecurringRule[] = [],
  nonRecurringKeys: string[] = [],
  displayCurrency: DisplayCurrency = 'ARS',
  usdArsRate: number = 1521,
  customBalances?: Record<string, { currentBalance: number; currency: string }>,
  monthsAhead: number = 6,
  historyOverride?: InflationPoint[]
): ProjectedBalanceCalculation {
  // 1. Calculate current liquid balance from actual transaction history
  const accounts = computeAccountBalances(transactions, usdArsRate, customBalances);
  const currentLiquidBalance = displayCurrency === 'USD'
    ? accounts.reduce((sum, a) => sum + a.balanceUSD, 0)
    : accounts.reduce((sum, a) => sum + a.balanceARS, 0);

  // 2. Map monthly actual transactions
  const monthlyMap: Record<string, { income: number; expense: number }> = {};
  const currentMonthKey = getCurrentMonthKey();
  const todayStr = getTodayString();
  const now = new Date();
  const currentDayOfMonth = Math.max(1, now.getDate());
  const year = parseInt(currentMonthKey.substring(0, 4)) || now.getFullYear();
  const monthIdx = parseInt(currentMonthKey.substring(5, 7)) || (now.getMonth() + 1);
  const daysInMonth = new Date(year, monthIdx, 0).getDate();
  const daysRemaining = Math.max(0, daysInMonth - currentDayOfMonth);

  transactions.forEach(tx => {
    const monthKey = tx.date ? tx.date.substring(0, 7) : currentMonthKey;
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { income: 0, expense: 0 };
    }
    const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
    if (tx.type === 'INCOME') {
      monthlyMap[monthKey].income += converted;
    } else if (tx.type === 'EXPENSE') {
      monthlyMap[monthKey].expense += converted;
    }
  });

  const sortedMonths = Object.keys(monthlyMap).sort();
  const pastMonths = sortedMonths.filter(m => m < currentMonthKey);

  // Filter current month transactions into past (<= today) and future (> today)
  const currentMonthTransactions = transactions.filter(t => t.date && t.date.substring(0, 7) === currentMonthKey);
  const pastCurrentMonthTransactions = currentMonthTransactions.filter(t => (t.date?.substring(0, 10) || '') <= todayStr);
  const futureCurrentMonthTransactions = currentMonthTransactions.filter(t => (t.date?.substring(0, 10) || '') > todayStr);

  let currentActualIncome = 0;
  let currentActualExpense = 0;
  pastCurrentMonthTransactions.forEach(t => {
    const amt = convertCurrency(t.amount, t.currency, displayCurrency, usdArsRate, t.date, transactions);
    if (t.type === 'INCOME') currentActualIncome += amt;
    else if (t.type === 'EXPENSE') currentActualExpense += amt;
  });

  // Calculate daily variable velocity
  let recurringPastExpense = 0;
  const effectiveAll = getEffectiveRecurringItems(transactions, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate);
  effectiveAll.forEach(item => {
    if (item.type === 'EXPENSE') {
      const match = pastCurrentMonthTransactions.find(t =>
        t.type === 'EXPENSE' &&
        (t.title?.toLowerCase().includes(item.cleanTitle.toLowerCase()) || normalizeCleanTitle(t.title || '').toLowerCase() === item.cleanTitle.toLowerCase())
      );
      if (match) {
        recurringPastExpense += convertCurrency(match.amount, match.currency, displayCurrency, usdArsRate, match.date, transactions);
      }
    }
  });

  const variableExpenseSoFar = Math.max(0, currentActualExpense - recurringPastExpense);
  const dailyExpenseVelocity = currentDayOfMonth > 0 ? variableExpenseSoFar / currentDayOfMonth : 0;
  const projectedRemainingVariableExpense = dailyExpenseVelocity * daysRemaining;

  // Upcoming non-excluded recurring transactions for current month:
  let futureExplicitIncome = 0;
  let futureExplicitExpense = 0;
  futureCurrentMonthTransactions.forEach(t => {
    const amt = convertCurrency(t.amount, t.currency, displayCurrency, usdArsRate, t.date, transactions);
    if (t.type === 'INCOME') futureExplicitIncome += amt;
    else if (t.type === 'EXPENSE') futureExplicitExpense += amt;
  });

  const pendingThisMonth = getPendingRecurringForMonth(currentMonthKey, transactions, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate);
  const pendingRecurringIncome = futureExplicitIncome + pendingThisMonth.pendingIncome;
  const pendingRecurringExpense = futureExplicitExpense + pendingThisMonth.pendingExpense;

  const projectedEOMIncome = currentActualIncome + pendingRecurringIncome;
  const projectedEOMExpense = currentActualExpense + projectedRemainingVariableExpense + pendingRecurringExpense;
  const projectedEOMNet = projectedEOMIncome - projectedEOMExpense;
  const projectedEOMBalance = currentLiquidBalance + (pendingRecurringIncome - pendingRecurringExpense - projectedRemainingVariableExpense);

  // Compute backwards actual balances for past months
  let runningBalance = currentLiquidBalance - (currentActualIncome - currentActualExpense);
  const monthBalancesMap: Record<string, number> = {};
  for (let i = pastMonths.length - 1; i >= 0; i--) {
    const m = pastMonths[i];
    monthBalancesMap[m] = runningBalance;
    const mNet = (monthlyMap[m]?.income || 0) - (monthlyMap[m]?.expense || 0);
    runningBalance -= mNet;
  }

  const projectedBalances: ProjectedBalancePoint[] = [];

  // Add historical points
  pastMonths.forEach(m => {
    const inc = monthlyMap[m].income;
    const exp = monthlyMap[m].expense;
    const bal = monthBalancesMap[m] || 0;
    projectedBalances.push({
      month: m,
      isForecast: false,
      isCurrentMonth: false,
      actualBalance: Math.round(bal),
      projectedBalance: Math.round(bal),
      income: Math.round(inc),
      expense: Math.round(exp),
      net: Math.round(inc - exp),
      fxRate: getHistoricalFxRate(m, usdArsRate, transactions, historyOverride),
    });
  });

  // Add current month point (as of today)
  projectedBalances.push({
    month: `${currentMonthKey} (Today)`,
    isForecast: false,
    isCurrentMonth: true,
    actualBalance: Math.round(currentLiquidBalance),
    projectedBalance: Math.round(currentLiquidBalance),
    income: Math.round(currentActualIncome),
    expense: Math.round(currentActualExpense),
    net: Math.round(currentActualIncome - currentActualExpense),
    projectedIncome: Math.round(projectedEOMIncome),
    projectedExpense: Math.round(projectedEOMExpense),
    projectedNet: Math.round(projectedEOMNet),
    pendingRecurringIncome: Math.round(pendingRecurringIncome),
    pendingRecurringExpense: Math.round(pendingRecurringExpense),
    fxRate: usdArsRate,
  });

  // Add current month End-Of-Month projection point
  projectedBalances.push({
    month: `${currentMonthKey} (EOM Est.)`,
    isForecast: true,
    isCurrentMonth: false,
    actualBalance: null,
    projectedBalance: Math.round(projectedEOMBalance),
    income: 0,
    expense: 0,
    net: 0,
    projectedIncome: Math.round(projectedEOMIncome),
    projectedExpense: Math.round(projectedEOMExpense),
    projectedNet: Math.round(projectedEOMNet),
    pendingRecurringIncome: Math.round(pendingRecurringIncome),
    pendingRecurringExpense: Math.round(pendingRecurringExpense),
    fxRate: usdArsRate,
  });

  // All upcoming recurring items collected across horizon
  const allUpcomingRecurring: PendingRecurringItem[] = [...pendingThisMonth.pendingItems];

  // Project future months ahead (1 to monthsAhead)
  let lastProjectedBalance = projectedEOMBalance;
  const past3Months = pastMonths.slice(-3);
  const avgPastExpense = past3Months.length > 0
    ? past3Months.reduce((s, m) => s + monthlyMap[m].expense, 0) / past3Months.length
    : currentActualExpense * 2;

  let totalUpcomingIncome = pendingRecurringIncome;
  let totalUpcomingExpense = pendingRecurringExpense;

  for (let step = 1; step <= monthsAhead; step++) {
    const fDate = new Date(year, monthIdx - 1 + step, 1);
    const fYear = fDate.getFullYear();
    const fMonthNum = fDate.getMonth() + 1;
    const fMonthKey = `${fYear}-${String(fMonthNum).padStart(2, '0')}`;

    const futurePending = getPendingRecurringForMonth(fMonthKey, transactions, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate);
    futurePending.pendingItems.forEach(item => {
      if (!allUpcomingRecurring.some(ex => ex.id === item.id)) {
        allUpcomingRecurring.push(item);
      }
    });

    const fIncome = futurePending.pendingIncome;
    const fExpense = Math.max(futurePending.pendingExpense, avgPastExpense);
    const fNet = fIncome - fExpense;
    lastProjectedBalance += fNet;

    totalUpcomingIncome += fIncome;
    totalUpcomingExpense += fExpense;

    projectedBalances.push({
      month: `${fMonthKey} (Fcst)`,
      isForecast: true,
      isCurrentMonth: false,
      actualBalance: null,
      projectedBalance: Math.round(lastProjectedBalance),
      income: 0,
      expense: 0,
      net: 0,
      projectedIncome: Math.round(fIncome),
      projectedExpense: Math.round(fExpense),
      projectedNet: Math.round(fNet),
      pendingRecurringIncome: Math.round(futurePending.pendingIncome),
      pendingRecurringExpense: Math.round(futurePending.pendingExpense),
      fxRate: usdArsRate,
    });
  }

  return {
    currentLiquidBalance,
    projectedEOMBalance,
    projectedBalances,
    upcomingRecurringItems: allUpcomingRecurring,
    totalUpcomingIncome,
    totalUpcomingExpense,
    netUpcomingDelta: totalUpcomingIncome - totalUpcomingExpense,
    dailyExpenseVelocity,
    projectedRemainingVariableExpense,
  };
}

export function computePredictiveTrend(
  transactions: Transaction[],
  displayCurrency: DisplayCurrency,
  usdArsRate: number,
  recurringRules: RecurringRule[] = [],
  customBalances?: Record<string, { currentBalance: number; currency: string }>,
  historyOverride?: InflationPoint[],
  nonRecurringKeys: string[] = []
): {
  trendData: TrendPoint[];
  metrics: PredictiveMetrics;
} {
  // 1. Calculate projected balance and trajectory
  const projection = calculateProjectedBalance(
    transactions,
    recurringRules,
    nonRecurringKeys,
    displayCurrency,
    usdArsRate,
    customBalances,
    3,
    historyOverride
  );

  const currentMonthKey = getCurrentMonthKey();
  const now = new Date();
  const currentDayOfMonth = Math.max(1, now.getDate());
  const year = parseInt(currentMonthKey.substring(0, 4)) || now.getFullYear();
  const monthIdx = parseInt(currentMonthKey.substring(5, 7)) || (now.getMonth() + 1);
  const daysInMonth = new Date(year, monthIdx, 0).getDate();
  const daysRemaining = Math.max(0, daysInMonth - currentDayOfMonth);

  // Map projection points to TrendPoint format
  const trendData: TrendPoint[] = projection.projectedBalances.map(pb => ({
    month: pb.month,
    isForecast: pb.isForecast,
    isCurrentMonth: pb.isCurrentMonth,
    income: pb.income,
    expense: pb.expense,
    net: pb.net,
    projectedIncome: pb.projectedIncome,
    projectedExpense: pb.projectedExpense,
    projectedNet: pb.projectedNet,
    forecastBalance: pb.projectedBalance,
    projectedBalance: pb.projectedBalance,
    actualBalance: pb.actualBalance !== null && pb.actualBalance !== undefined ? pb.actualBalance : undefined,
    pendingRecurringIncome: pb.pendingRecurringIncome,
    pendingRecurringExpense: pb.pendingRecurringExpense,
    fxRate: pb.fxRate,
  }));

  const currentPoint = projection.projectedBalances.find(p => p.isCurrentMonth);
  const eomPoint = projection.projectedBalances.find(p => p.month.includes('EOM Est.'));

  const projectedEOMIncome = eomPoint?.projectedIncome || currentPoint?.projectedIncome || 0;
  const projectedEOMExpense = eomPoint?.projectedExpense || currentPoint?.projectedExpense || 0;
  const projectedEOMNet = projectedEOMIncome - projectedEOMExpense;
  const projectedSavingsRate = projectedEOMIncome > 0
    ? (projectedEOMNet / projectedEOMIncome) * 100
    : 0;

  const metrics: PredictiveMetrics = {
    currentDayOfMonth,
    daysInMonth,
    daysRemaining,
    dailyExpenseVelocity: projection.dailyExpenseVelocity,
    projectedRemainingVariableExpense: projection.projectedRemainingVariableExpense,
    pendingRecurringIncome: currentPoint?.pendingRecurringIncome || 0,
    pendingRecurringExpense: currentPoint?.pendingRecurringExpense || 0,
    currentLiquidBalance: projection.currentLiquidBalance,
    projectedEOMBalance: projection.projectedEOMBalance,
    projectedEOMIncome,
    projectedEOMExpense,
    projectedEOMNet,
    projectedSavingsRate
  };

  return { trendData, metrics };
}

/**
 * Detects all recurring expenses, incomes, subscriptions, utilities, and installment plans (cuotas)
 * thoroughly from the dataset.
 */
export function isInstallmentTx(t: Transaction): boolean {
  if (t.installments && t.installments.trim().length > 0) return true;
  if (t.description && /\d+\/\d+/.test(t.description)) return true;
  if (t.title && /\d+\/\d+/.test(t.title)) return true;
  return false;
}

export function normalizeCleanTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\s*\d+\/\d+.*$/i, '')
    .replace(/\s*cuota\s*\d+.*/i, '')
    .trim();
}

/**
 * Detects true recurring expenses and incomes.
 * Rules:
 * 1. Excludes installment/cuota transactions.
 * 2. If an expense/income has not happened in the last 3 months AND has not happened more than 9 times in the last 12 months, then it is NOT recurring.
 * 3. Consolidates expenses and incomes with the same title across accounts.
 */
export function detectRecurringItems(
  transactions: Transaction[],
  displayCurrency: DisplayCurrency = 'ARS',
  usdArsRate: number = 1521
): IdentifiedRecurringItem[] {
  const groups = new Map<string, Transaction[]>();

  transactions.forEach(t => {
    if (t.type === 'TRANSFER') return;
    if (isInstallmentTx(t)) return; // Exclude payments in installments!

    const rawTitle = (t.title || t.category || '').trim();
    if (!rawTitle) return;
    const cleanTitle = normalizeCleanTitle(rawTitle);
    if (!cleanTitle) return;

    const groupKey = `${cleanTitle.toLowerCase()}-${t.type}-${t.currency}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(t);
  });

  // Use the actual current date as the reference point for evaluating recurrence
  const refDate = new Date();
  const refYear = refDate.getFullYear();
  const refMonth = refDate.getMonth() + 1; // 1 to 12

  const last4Months = new Set<string>(); // Current month + 3 previous months
  for (let i = 0; i < 4; i++) {
    const d = new Date(refYear, refMonth - 1 - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    last4Months.add(`${yyyy}-${mm}`);
  }

  const last12Months = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(refYear, refMonth - 1 - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    last12Months.add(`${yyyy}-${mm}`);
  }

  const result: IdentifiedRecurringItem[] = [];

  groups.forEach((txList, groupKey) => {
    const sorted = [...txList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Count distinct months, 4-month occurrences, and 12-month occurrences
    const distinctMonths = new Set<string>();
    const distinctMonthsInLast4 = new Set<string>();
    let occurrencesInLast12Months = 0;
    let daySum = 0;
    const accountsSet = new Set<string>();

    sorted.forEach(t => {
      if (t.date) {
        const m = t.date.substring(0, 7);
        distinctMonths.add(m);

        if (last4Months.has(m)) {
          distinctMonthsInLast4.add(m);
        }
        if (last12Months.has(m)) {
          occurrencesInLast12Months++;
        }

        const dt = new Date(t.date);
        if (!isNaN(dt.getDate())) {
          daySum += dt.getDate();
        }
      }
      if (t.account) {
        accountsSet.add(t.account);
      }
    });

    const repeatedInLast4Months = distinctMonthsInLast4.size >= 2;
    const happenedAtLeast9TimesInLast12Months = occurrencesInLast12Months >= 9;

    // Rule: It is considered recurring if it has repeated over the current and 3 previous periods (>= 2 distinct months in that window)
    // OR it has happened at least 9 times over the last 12 months.
    if (!repeatedInLast4Months && !happenedAtLeast9TimesInLast12Months) {
      return;
    }

    // Must have at least 2 distinct occurrences or months overall
    if (distinctMonths.size >= 2 || sorted.length >= 2) {
      const latest = sorted[sorted.length - 1];
      const cleanTitle = normalizeCleanTitle(latest.title || latest.category || 'Sin Titulo');

      // Determine type and accounts
      const predominantType = sorted[0].type as 'INCOME' | 'EXPENSE';
      const allAccountsStr = Array.from(accountsSet).join(', ');

      // Consolidate per month across accounts
      const monthMap = new Map<string, {
        amountNativeSum: number;
        amountDisplaySum: number;
        currency: string;
        accounts: Set<string>;
        date: string;
      }>();

      sorted.forEach(t => {
        const m = t.date ? t.date.substring(0, 7) : '2026-08';
        const converted = convertCurrency(t.amount, t.currency, displayCurrency, usdArsRate, t.date, transactions);
        
        if (!monthMap.has(m)) {
          monthMap.set(m, {
            amountNativeSum: t.amount,
            amountDisplaySum: converted,
            currency: t.currency,
            accounts: new Set([t.account]),
            date: t.date,
          });
        } else {
          const prev = monthMap.get(m)!;
          prev.amountNativeSum += t.amount;
          prev.amountDisplaySum += converted;
          prev.accounts.add(t.account);
        }
      });

      const monthlyTrend = Array.from(monthMap.entries()).map(([month, data]) => {
        return {
          month,
          amount: data.amountNativeSum,
          amountDisplay: data.amountDisplaySum,
          currency: latest.currency,
          account: Array.from(data.accounts).join(', '),
        };
      }).sort((a, b) => a.month.localeCompare(b.month));

      const nativeAmounts = monthlyTrend.map(pt => pt.amount);
      const avgNativeAmount = nativeAmounts.reduce((a, b) => a + b, 0) / nativeAmounts.length;
      const latestMonthData = monthlyTrend[monthlyTrend.length - 1];
      const minNativeAmount = Math.min(...nativeAmounts);
      const maxNativeAmount = Math.max(...nativeAmounts);
      const dayOfMonth = Math.round(daySum / sorted.length) || 15;

      const history: RecurringOccurrence[] = sorted.map(t => ({
        id: t.id,
        date: t.date,
        month: t.date ? t.date.substring(0, 7) : '',
        amount: t.amount,
        currency: t.currency,
        account: t.account,
        title: t.title || cleanTitle,
        description: t.description,
        installments: t.installments,
      }));

      result.push({
        id: `detected-${groupKey}`,
        title: cleanTitle,
        cleanTitle,
        category: latest.category || 'General',
        type: predominantType,
        account: allAccountsStr,
        currency: latest.currency,
        latestAmount: latestMonthData ? latestMonthData.amount : 0,
        avgAmount: avgNativeAmount,
        minAmount: minNativeAmount,
        maxAmount: maxNativeAmount,
        dayOfMonth,
        occurrencesCount: sorted.length,
        distinctMonthsCount: distinctMonths.size,
        isInstallment: false,
        history,
        monthlyTrend,
      });
    }
  });

  return result.sort((a, b) => {
    const bConverted = convertCurrency(b.latestAmount, b.currency, displayCurrency, usdArsRate);
    const aConverted = convertCurrency(a.latestAmount, a.currency, displayCurrency, usdArsRate);
    return bConverted - aConverted || b.distinctMonthsCount - a.distinctMonthsCount || a.title.localeCompare(b.title);
  });
}

/**
 * Detects credit card installment plans (cuotas) separately.
 */
export function detectInstallmentPlans(
  transactions: Transaction[],
  displayCurrency: DisplayCurrency = 'ARS',
  usdArsRate: number = 1521
): IdentifiedRecurringItem[] {
  const groups = new Map<string, Transaction[]>();

  transactions.forEach(t => {
    if (t.type === 'TRANSFER') return;
    if (!isInstallmentTx(t)) return;

    const rawTitle = (t.title || t.category || '').trim();
    if (!rawTitle) return;
    const cleanTitle = normalizeCleanTitle(rawTitle);
    const key = cleanTitle.toLowerCase();

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(t);
  });

  const result: IdentifiedRecurringItem[] = [];

  groups.forEach((txList, key) => {
    const sorted = [...txList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = sorted[sorted.length - 1];
    const cleanTitle = normalizeCleanTitle(latest.title || latest.category || 'Installment Plan');

    const installmentInfo = latest.installments || latest.description || 'Cuotas';
    let installmentCurrent: number | undefined;
    let installmentTotal: number | undefined;
    
    const match = installmentInfo.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
      installmentCurrent = parseInt(match[1], 10);
      installmentTotal = parseInt(match[2], 10);
    } else {
       const cuotaMatch = installmentInfo.match(/cuota\s+(\d+)\s+de\s+(\d+)/i);
       if (cuotaMatch) {
         installmentCurrent = parseInt(cuotaMatch[1], 10);
         installmentTotal = parseInt(cuotaMatch[2], 10);
       }
    }

    const distinctMonths = new Set<string>();
    const accountsSet = new Set<string>();

    sorted.forEach(t => {
      if (t.date) distinctMonths.add(t.date.substring(0, 7));
      if (t.account) accountsSet.add(t.account);
    });
    
    let installmentStartDate: string | undefined;
    let installmentEndDate: string | undefined;
    
    // Prioritize explicit dates found on transactions (e.g. from Ivy import)
    const txWithStart = sorted.find(t => t.installmentStartDate);
    const txWithEnd = sorted.find(t => t.installmentEndDate);
    if (txWithStart) installmentStartDate = txWithStart.installmentStartDate;
    if (txWithEnd) installmentEndDate = txWithEnd.installmentEndDate;

    if (!installmentStartDate && sorted.length > 0) {
      const firstTx = sorted[0];
      if (installmentCurrent && firstTx.date) {
        // Derive start date backwards from the first transaction we have
        const d = new Date(firstTx.date);
        d.setMonth(d.getMonth() - (installmentCurrent - 1));
        installmentStartDate = d.toISOString().substring(0, 7);
      } else {
        installmentStartDate = firstTx.date?.substring(0, 7);
      }
    }

    if (!installmentEndDate && sorted.length > 0) {
      const lastTx = sorted[sorted.length - 1];
      if (installmentCurrent && installmentTotal && lastTx.date) {
        // Derive end date forwards from the last transaction we have
        const remaining = installmentTotal - installmentCurrent;
        const d = new Date(lastTx.date);
        d.setMonth(d.getMonth() + remaining);
        installmentEndDate = d.toISOString().substring(0, 7);
      }
    }

    const monthMap = new Map<string, { amountNativeSum: number; amountDisplaySum: number; account: string; date: string }>();
    sorted.forEach(t => {
      const m = t.date ? t.date.substring(0, 7) : '2026-08';
      const converted = convertCurrency(t.amount, t.currency, displayCurrency, usdArsRate, t.date, transactions);
      if (!monthMap.has(m)) {
        monthMap.set(m, { amountNativeSum: t.amount, amountDisplaySum: converted, account: t.account, date: t.date });
      } else {
        const prev = monthMap.get(m)!;
        prev.amountNativeSum += t.amount;
        prev.amountDisplaySum += converted;
      }
    });

    const monthlyTrend = Array.from(monthMap.entries()).map(([month, data]) => ({
      month,
      amount: data.amountNativeSum,
      amountDisplay: data.amountDisplaySum,
      currency: latest.currency,
      account: data.account,
    })).sort((a, b) => a.month.localeCompare(b.month));

    const latestMonthData = monthlyTrend[monthlyTrend.length - 1];
    const nativeAmounts = monthlyTrend.map(pt => pt.amount);
    const avgNativeAmount = nativeAmounts.reduce((a, b) => a + b, 0) / (nativeAmounts.length || 1);

    const history: RecurringOccurrence[] = sorted.map(t => ({
      id: t.id,
      date: t.date,
      month: t.date ? t.date.substring(0, 7) : '',
      amount: t.amount,
      currency: t.currency,
      account: t.account,
      title: t.title || cleanTitle,
      description: t.description,
      installments: t.installments || t.description,
    }));

    result.push({
      id: `installment-${key}`,
      title: cleanTitle,
      cleanTitle,
      category: latest.category || 'General',
      type: 'EXPENSE',
      account: Array.from(accountsSet).join(', '),
      currency: latest.currency,
      latestAmount: latestMonthData ? latestMonthData.amount : 0,
      avgAmount: avgNativeAmount,
      minAmount: latestMonthData ? latestMonthData.amount : 0,
      maxAmount: latestMonthData ? latestMonthData.amount : 0,
      dayOfMonth: 15,
      occurrencesCount: sorted.length,
      distinctMonthsCount: distinctMonths.size,
      isInstallment: true,
      installmentInfo,
      installmentCurrent,
      installmentTotal,
      installmentStartDate,
      installmentEndDate,
      history,
      monthlyTrend,
    });
  });

  return result.sort((a, b) => {
    const bConverted = convertCurrency(b.latestAmount, b.currency, displayCurrency, usdArsRate);
    const aConverted = convertCurrency(a.latestAmount, a.currency, displayCurrency, usdArsRate);
    return bConverted - aConverted || b.distinctMonthsCount - a.distinctMonthsCount || a.title.localeCompare(b.title);
  });
}

export interface EffectiveRecurringItem {
  id: string;
  title: string;
  cleanTitle: string;
  category: string;
  account: string;
  amount: number;
  currency: string;
  type: 'EXPENSE' | 'INCOME';
  dayOfMonth: number;
  isManualRule: boolean;
  ruleId?: string;
  isInstallment?: boolean;
  installmentInfo?: string;
  installmentStartDate?: string;
  installmentEndDate?: string;
  isExcluded: boolean;
  isActive: boolean;
  frequency?: string;
}

export function getSavedNonRecurringKeys(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('levlev_non_recurring_keys') || localStorage.getItem('finance_app_non_recurring_keys');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getEffectiveRecurringItems(
  transactions: Transaction[],
  recurringRules: RecurringRule[] = [],
  nonRecurringKeys: string[] = [],
  displayCurrency: DisplayCurrency = 'ARS',
  usdArsRate: number = 1521
): EffectiveRecurringItem[] {
  const result: EffectiveRecurringItem[] = [];
  const keysToUse = (nonRecurringKeys && nonRecurringKeys.length > 0)
    ? nonRecurringKeys
    : getSavedNonRecurringKeys();

  const normalizedExclusions = new Set<string>();
  keysToUse.forEach(k => {
    if (!k) return;
    const lower = k.toLowerCase().trim();
    normalizedExclusions.add(lower);
    const cleanK = normalizeCleanTitle(k).toLowerCase().trim();
    if (cleanK) normalizedExclusions.add(cleanK);
  });

  const coveredManualTitles = new Set<string>();

  // 1. Manual Recurring Rules (highest priority, user explicitly customized)
  recurringRules.forEach(rule => {
    if (rule.isActive === false || (rule as any).isExcluded === true) return;
    const rawClean = normalizeCleanTitle(rule.title || '').toLowerCase().trim();
    const rawTitle = (rule.title || '').toLowerCase().trim();
    const rawId = (rule.id || '').toLowerCase().trim();

    if (normalizedExclusions.has(rawClean) || normalizedExclusions.has(rawTitle) || normalizedExclusions.has(rawId)) {
      return;
    }

    if (rawClean) coveredManualTitles.add(rawClean);
    if (rawTitle) coveredManualTitles.add(rawTitle);

    result.push({
      id: rule.id || `rule-${Math.random().toString(36).substring(2)}`,
      ruleId: rule.id,
      title: rule.title,
      cleanTitle: normalizeCleanTitle(rule.title || ''),
      category: rule.category || 'General',
      account: rule.account || 'Default',
      amount: rule.amount || 0,
      currency: rule.currency || displayCurrency,
      type: rule.type || 'EXPENSE',
      dayOfMonth: rule.dayOfMonth || 15,
      isManualRule: true,
      isInstallment: false,
      isExcluded: false,
      isActive: true,
      frequency: rule.frequency || 'MONTHLY',
    });
  });

  // 2. Auto-Detected Recurring Items from Transactions
  const detected = detectRecurringItems(transactions, displayCurrency, usdArsRate);
  detected.forEach(item => {
    const rawClean = item.cleanTitle.toLowerCase().trim();
    const rawTitle = item.title.toLowerCase().trim();
    const rawNorm = normalizeCleanTitle(item.title).toLowerCase().trim();
    const rawId = (item.id || '').toLowerCase().trim();

    const isExcluded = item.isExcluded === true ||
      normalizedExclusions.has(rawClean) || 
      normalizedExclusions.has(rawTitle) || 
      normalizedExclusions.has(rawNorm) ||
      normalizedExclusions.has(rawId);

    if (isExcluded) return;

    // If already covered by a manual rule, don't duplicate
    if (coveredManualTitles.has(rawClean) || coveredManualTitles.has(rawTitle) || coveredManualTitles.has(rawNorm)) return;

    result.push({
      id: `detected-${item.id}`,
      title: item.title,
      cleanTitle: item.cleanTitle,
      category: item.category || 'General',
      account: item.account || 'Default',
      amount: item.avgAmount,
      currency: item.currency || displayCurrency,
      type: item.type,
      dayOfMonth: item.dayOfMonth || 15,
      isManualRule: false,
      isInstallment: false,
      isExcluded: false,
      isActive: true,
      frequency: 'MONTHLY',
    });
  });

  // 3. Active Installment Plans
  const installments = detectInstallmentPlans(transactions, displayCurrency, usdArsRate);
  const currentMonthKey = getCurrentMonthKey();
  installments.forEach(plan => {
    // Only active installments
    if (plan.installmentEndDate && plan.installmentEndDate < currentMonthKey) return;
    if (!plan.installmentEndDate && plan.installmentCurrent !== undefined && plan.installmentTotal !== undefined && plan.installmentCurrent >= plan.installmentTotal) return;

    const rawClean = plan.cleanTitle.toLowerCase().trim();
    const rawTitle = plan.title.toLowerCase().trim();
    const rawNorm = normalizeCleanTitle(plan.title).toLowerCase().trim();
    const rawId = (plan.id || '').toLowerCase().trim();

    const isExcluded = plan.isExcluded === true ||
      normalizedExclusions.has(rawClean) ||
      normalizedExclusions.has(rawTitle) ||
      normalizedExclusions.has(rawNorm) ||
      normalizedExclusions.has(rawId);

    if (isExcluded) return;

    result.push({
      id: `installment-${plan.id}`,
      title: plan.title,
      cleanTitle: plan.cleanTitle,
      category: plan.category || 'Installments',
      account: plan.account || 'Credit Card',
      amount: plan.latestAmount,
      currency: plan.currency || displayCurrency,
      type: 'EXPENSE',
      dayOfMonth: plan.dayOfMonth || 25,
      isManualRule: false,
      isInstallment: true,
      installmentInfo: plan.installmentInfo,
      installmentStartDate: plan.installmentStartDate,
      installmentEndDate: plan.installmentEndDate,
      isExcluded: false,
      isActive: true,
      frequency: 'MONTHLY',
    });
  });

  return result;
}

export interface MonthPendingRecurringResult {
  monthKey: string;
  pendingItems: PendingRecurringItem[];
  pendingExpenses: PendingRecurringItem[];
  pendingIncomes: PendingRecurringItem[];
  matchedItems: PendingRecurringItem[];
  pendingExpense: number; // in displayCurrency
  pendingIncome: number; // in displayCurrency
  totalPendingExpense: number; // in displayCurrency (alias)
  totalPendingIncome: number; // in displayCurrency (alias)
  dailyPendingMap: Record<number, PendingRecurringItem[]>;
}

export function getPendingRecurringForMonth(
  monthKey: string,
  transactions: Transaction[],
  recurringRules: RecurringRule[] = [],
  nonRecurringKeys: string[] = [],
  displayCurrency: DisplayCurrency = 'ARS',
  usdArsRate: number = 1521
): MonthPendingRecurringResult {
  const effectiveItems = getEffectiveRecurringItems(transactions, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate);
  const monthTransactions = transactions.filter(t => t.date && t.date.substring(0, 7) === monthKey);
  const currentMonthKey = getCurrentMonthKey();
  const todayStr = getTodayString();
  const isPastMonth = monthKey < currentMonthKey;
  const isCurrentMonth = monthKey === currentMonthKey;

  const pendingItems: PendingRecurringItem[] = [];
  const matchedItems: PendingRecurringItem[] = [];
  const dailyPendingMap: Record<number, PendingRecurringItem[]> = {};

  let pendingExpense = 0;
  let pendingIncome = 0;

  effectiveItems.forEach(item => {
    // If it's an installment, check date bounds
    if (item.isInstallment) {
      if (item.installmentStartDate && monthKey < item.installmentStartDate) return;
      if (item.installmentEndDate && monthKey > item.installmentEndDate) return;
    }

    // Check if an actual transaction in this month matches this recurring item
    const cleanItemTitle = normalizeCleanTitle(item.title).toLowerCase().trim();
    const itemTitleLower = item.title.toLowerCase().trim();
    const day = Math.min(31, Math.max(1, item.dayOfMonth || 15));
    const estimatedDateStr = `${monthKey}-${String(day).padStart(2, '0')}`;

    // 1. Check if an expense/income was recorded in the same period for that title
    const matchedTx = monthTransactions.find(t => {
      if (t.type !== item.type) return false;
      const tTitleClean = normalizeCleanTitle(t.title || '').toLowerCase().trim();
      const tTitle = (t.title || '').toLowerCase().trim();

      // Check title match, clean title match, or containment
      if (tTitle === itemTitleLower || tTitleClean === cleanItemTitle || tTitleClean === itemTitleLower || tTitle === cleanItemTitle) return true;
      if (cleanItemTitle.length >= 3 && (tTitle.includes(cleanItemTitle) || cleanItemTitle.includes(tTitleClean))) return true;
      if (tTitleClean.length >= 3 && (itemTitleLower.includes(tTitleClean) || tTitleClean.includes(itemTitleLower))) return true;

      // For installments: check description or installments tag or title
      if (item.isInstallment && t.installments && (tTitle.includes(cleanItemTitle) || cleanItemTitle.includes(tTitleClean))) return true;

      return false;
    });

    const converted = convertCurrency(item.amount, item.currency, displayCurrency, usdArsRate, `${monthKey}-15`, transactions);

    const pendingItemObj: PendingRecurringItem = {
      id: `${item.id}-${monthKey}`,
      title: item.title,
      category: item.category,
      account: item.account,
      amount: item.amount,
      convertedAmount: converted,
      currency: item.currency,
      type: item.type,
      dayOfMonth: item.dayOfMonth,
      isManualRule: item.isManualRule,
      ruleId: item.ruleId,
      isInstallment: item.isInstallment,
      installmentInfo: item.installmentInfo,
      isExcluded: item.isExcluded,
    };

    // If an expense/income was already recorded in this period for that title -> remove estimation for that period!
    if (matchedTx) {
      matchedItems.push(pendingItemObj);
      return;
    }

    // If viewing a past month entirely, past unrecorded items are not carried forward
    if (isPastMonth) {
      return;
    }

    // For current month: if the scheduled date has passed without being recorded,
    // we keep it as expired/overdue and adjust the occurrence date forward to today
    const isPastDueInCurrentMonth = isCurrentMonth && estimatedDateStr < todayStr;
    const currentDayNum = Math.min(31, Math.max(1, new Date().getDate()));
    const effectiveDay = isPastDueInCurrentMonth ? currentDayNum : day;

    if (isPastDueInCurrentMonth) {
      pendingItemObj.isExpired = true;
      pendingItemObj.originalDayOfMonth = day;
      pendingItemObj.dayOfMonth = effectiveDay;
    }

    // This is an active or rolled-over pending estimation for this period
    pendingItems.push(pendingItemObj);
    if (item.type === 'INCOME') {
      pendingIncome += converted;
    } else {
      pendingExpense += converted;
    }

    if (!dailyPendingMap[effectiveDay]) {
      dailyPendingMap[effectiveDay] = [];
    }
    dailyPendingMap[effectiveDay].push(pendingItemObj);
  });

  const pendingExpenses = pendingItems.filter(i => i.type === 'EXPENSE');
  const pendingIncomes = pendingItems.filter(i => i.type === 'INCOME');

  return {
    monthKey,
    pendingItems,
    pendingExpenses,
    pendingIncomes,
    matchedItems,
    pendingExpense,
    pendingIncome,
    totalPendingExpense: pendingExpense,
    totalPendingIncome: pendingIncome,
    dailyPendingMap,
  };
}

/**
 * Projects future recurring expenses and incomes for a given number of months.
 * Fully supports user-defined manual rules (e.g. salary, rent) and exclusions!
 */
export function computeFutureRecurringProjections(
  transactions: Transaction[],
  displayCurrency: DisplayCurrency,
  usdArsRate: number,
  months: number = 12,
  recurringRules: RecurringRule[] = [],
  nonRecurringKeys: string[] = []
): { month: string; expense: number; income: number; net: number }[] {
  const projections: { month: string; expense: number; income: number; net: number }[] = [];
  const now = new Date();
  
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const mKey = d.toISOString().substring(0, 7);
    
    const monthData = getPendingRecurringForMonth(mKey, transactions, recurringRules, nonRecurringKeys, displayCurrency, usdArsRate);
    
    projections.push({
      month: mKey,
      expense: Math.round(monthData.pendingExpense),
      income: Math.round(monthData.pendingIncome),
      net: Math.round(monthData.pendingIncome - monthData.pendingExpense)
    });
  }
  
  return projections;
}

/**
 * Calculates the next closing date for a credit card account based on current date/time and closing rule.
 */
export function getNextCloseDate(rule?: CreditCardClosingRule, fromDateStr?: string): string {
  const refDateStr = fromDateStr || new Date().toISOString().substring(0, 10);
  return getStatementCloseDateForTx(refDateStr, rule);
}

/**
 * Returns the index of the current active statement cycle (matching current date/time)
 * from a list of statements sorted descending by closeDate.
 */
export function getCurrentStatementIndex(statements: CreditCardStatement[], rule?: CreditCardClosingRule): number {
  if (!statements || statements.length === 0) return 0;

  const currentCloseStr = getNextCloseDate(rule);

  const idx = statements.findIndex(s => s.closeDate === currentCloseStr);
  if (idx !== -1) return idx;

  // If exact statement for currentCloseStr is not present, select statement closest to currentCloseStr
  let closestIdx = 0;
  let minDiff = Infinity;
  const currentVal = new Date(currentCloseStr).getTime();

  statements.forEach((stmt, i) => {
    const stmtVal = new Date(stmt.closeDate).getTime();
    const diff = Math.abs(stmtVal - currentVal);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  });

  return closestIdx;
}

export function getCurrentStatement(statements: CreditCardStatement[], rule?: CreditCardClosingRule): CreditCardStatement | undefined {
  if (!statements || statements.length === 0) return undefined;
  const idx = getCurrentStatementIndex(statements, rule);
  return statements[idx];
}

// Aliases for compatibility
export const getRelevantStatementIndex = (statements: CreditCardStatement[], rule?: CreditCardClosingRule) =>
  getCurrentStatementIndex(statements, rule);

export const getRelevantStatement = (statements: CreditCardStatement[], rule?: CreditCardClosingRule) =>
  getCurrentStatement(statements, rule);

export interface DiagnosticAccountResult {
  accountName: string;
  initialBalance: number;
  sumTransactions: number;
  expectedBalance: number;
  uiCalculatedBalance: number;
  discrepancy: number;
  hasDiscrepancy: boolean;
}

/**
 * Diagnostic utility function to verify that the sum of transactions for a specific account
 * (or all accounts), when added to its initial balance, matches the current calculated balance in the UI.
 */
export function verifyAccountBalances(
  accounts: AccountItem[] = [],
  transactions: Transaction[] = [],
  customBalances?: Record<string, { currentBalance: number; currency: string }>,
  targetAccountName?: string,
  usdArsRate: number = 1200
): DiagnosticAccountResult[] {
  const todayStr = getTodayString();
  const nameSet = new Set<string>();
  accounts.forEach(a => { if (a.name) nameSet.add(a.name); });
  transactions.forEach(t => {
    if (t.account) nameSet.add(t.account);
    if (t.toAccount) nameSet.add(t.toAccount);
  });
  if (customBalances) {
    Object.keys(customBalances).forEach(name => nameSet.add(name));
  }

  let allNames = Array.from(nameSet).sort();
  if (targetAccountName) {
    allNames = allNames.filter(n => n === targetAccountName);
  }

  return allNames.map(accName => {
    const accItem = accounts.find(a => a.name === accName);
    const initialBalance = accItem?.initialBalance ?? 0;

    let sumTransactions = 0;
    transactions.forEach(tx => {
      // Exclude future transactions from current status balance calculations
      const txDateStr = tx.date ? tx.date.substring(0, 10) : '';
      if (txDateStr && txDateStr > todayStr) return;

      const amt = tx.amount || 0;
      if (tx.account === accName) {
        if (tx.type === 'INCOME') {
          sumTransactions += amt;
        } else if (tx.type === 'EXPENSE') {
          sumTransactions -= amt;
        } else if (tx.type === 'TRANSFER' || tx.type === 'CC_PAYMENT') {
          const outflow = getTransferOutflow(tx, usdArsRate);
          sumTransactions -= outflow;
        }
      }

      if (tx.toAccount === accName && (tx.type === 'TRANSFER' || tx.type === 'CC_PAYMENT')) {
        const inflow = getTransferInflow(tx, usdArsRate);
        sumTransactions += inflow;
      }
    });

    const expectedBalance = initialBalance + sumTransactions;
    const custom = customBalances?.[accName];
    const uiCalculatedBalance = custom !== undefined ? custom.currentBalance : (initialBalance + sumTransactions);

    const discrepancy = Number((uiCalculatedBalance - expectedBalance).toFixed(4));
    const hasDiscrepancy = Math.abs(discrepancy) >= 0.001;

    return {
      accountName: accName,
      initialBalance: Number(initialBalance.toFixed(4)),
      sumTransactions: Number(sumTransactions.toFixed(4)),
      expectedBalance: Number(expectedBalance.toFixed(4)),
      uiCalculatedBalance: Number(uiCalculatedBalance.toFixed(4)),
      discrepancy,
      hasDiscrepancy,
    };
  });
}

/**
  * Re-synchronizes account balances by recalculating them from the ground up:
  * starting with each account's initial balance and applying every associated past/present transaction cumulatively.
  */
export function recalculateAccountBalancesFromTransactions(
  accounts: AccountItem[] = [],
  transactions: Transaction[] = [],
  usdArsRate: number = 1200
): Record<string, AccountCustomBalance> {
  const recalculated: Record<string, AccountCustomBalance> = {};
  const todayStr = getTodayString();

  // Helper to infer currency for an account
  const getAccCurrency = (accName: string): string => {
    const accItem = accounts.find(a => a.name === accName);
    if (accItem?.currency) return accItem.currency;
    if (accName.toLowerCase().includes('usd')) return 'USD';
    return 'ARS';
  };

  // Track all unique account names from both registered accounts and transactions
  const nameSet = new Set<string>();
  accounts.forEach(a => { if (a.name) nameSet.add(a.name); });
  transactions.forEach(t => {
    if (t.account) nameSet.add(t.account);
    if (t.toAccount) nameSet.add(t.toAccount);
  });

  nameSet.forEach(accName => {
    const currency = getAccCurrency(accName);
    let netBalance = 0;

    transactions.forEach(tx => {
      // Exclude future transactions from current status balance
      const txDateStr = tx.date ? tx.date.substring(0, 10) : '';
      if (txDateStr && txDateStr > todayStr) return;

      const amt = tx.amount || 0;
      if (tx.account === accName) {
        if (tx.type === 'INCOME') {
          netBalance += amt;
        } else if (tx.type === 'EXPENSE') {
          netBalance -= amt;
        } else if (tx.type === 'TRANSFER' || tx.type === 'CC_PAYMENT') {
          const originCurr = currency;
          const destCurr = tx.toAccount ? getAccCurrency(tx.toAccount) : originCurr;
          const outflow = getTransferOutflow(tx, usdArsRate, originCurr, destCurr);
          netBalance -= outflow;
        }
      }

      if (tx.toAccount === accName && (tx.type === 'TRANSFER' || tx.type === 'CC_PAYMENT')) {
        const destCurr = currency;
        const originCurr = tx.account ? getAccCurrency(tx.account) : destCurr;
        const inflow = getTransferInflow(tx, usdArsRate, originCurr, destCurr);
        netBalance += inflow;
      }
    });

    recalculated[accName] = {
      accountName: accName,
      currentBalance: Number(netBalance.toFixed(4)),
      currency,
    };
  });

  return recalculated;
}

export interface CategoryAnomaly {
  category: string;
  currentAmount: number;
  averageAmount: number;
  percentageIncrease: number;
}

export function detectFinancialAnomalies(
  transactions: Transaction[],
  displayCurrency: DisplayCurrency,
  usdArsRate: number,
  targetMonthKey: string
): CategoryAnomaly[] {
  // get the past 3 months (not including target month)
  const pastMonths: string[] = [];
  const [yearStr, monthStr] = targetMonthKey.split('-');
  let y = parseInt(yearStr, 10);
  let m = parseInt(monthStr, 10);
  
  for (let i = 0; i < 3; i++) {
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
    const mKey = `${y}-${m.toString().padStart(2, '0')}`;
    pastMonths.push(mKey);
  }

  // gather all transactions in the target month and the past 3 months
  const expensesByCat: Record<string, { current: number; m1: number; m2: number; m3: number }> = {};
  
  transactions.forEach(tx => {
    if (tx.type !== 'EXPENSE') return;
    
    const txMonth = tx.date.substring(0, 7);
    
    // Check if it's the target month or one of the 3 past months
    let timeIndex = -1;
    if (txMonth === targetMonthKey) timeIndex = 0; // current
    else if (txMonth === pastMonths[0]) timeIndex = 1;
    else if (txMonth === pastMonths[1]) timeIndex = 2;
    else if (txMonth === pastMonths[2]) timeIndex = 3;
    
    if (timeIndex === -1) return;

    const cat = tx.category || 'Uncategorized';
    if (!expensesByCat[cat]) {
      expensesByCat[cat] = { current: 0, m1: 0, m2: 0, m3: 0 };
    }

    const amt = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
    
    if (timeIndex === 0) expensesByCat[cat].current += amt;
    else if (timeIndex === 1) expensesByCat[cat].m1 += amt;
    else if (timeIndex === 2) expensesByCat[cat].m2 += amt;
    else if (timeIndex === 3) expensesByCat[cat].m3 += amt;
  });

  const anomalies: CategoryAnomaly[] = [];
  
  Object.entries(expensesByCat).forEach(([cat, amounts]) => {
    // Need at least some history to call it an anomaly
    const pastSum = amounts.m1 + amounts.m2 + amounts.m3;
    if (pastSum === 0) return; // brand new category, not an anomaly
    
    // Average over 3 months
    const avg = pastSum / 3;
    
    // If average is too small, percentage increases look huge, ignore trivial amounts
    if (avg < 50) return; // e.g. $50 threshold
    
    if (amounts.current > avg * 1.5) { // 50% increase threshold
      const percentageIncrease = ((amounts.current - avg) / avg) * 100;
      anomalies.push({
        category: cat,
        currentAmount: amounts.current,
        averageAmount: avg,
        percentageIncrease,
      });
    }
  });

  // Sort by highest deviation amount (absolute difference)
  return anomalies.sort((a, b) => (b.currentAmount - b.averageAmount) - (a.currentAmount - a.averageAmount));
}

export interface RecurringDeviationAlert {
  id: string;
  title: string;
  cleanTitle: string;
  category: string;
  account: string;
  currency: string;
  latestAmount: number;
  priorAvgAmount: number;
  deviationPercent: number;
  threshold: number;
  type: 'INCOME' | 'EXPENSE';
  latestDate?: string;
  diff: number;
  isTriggered: boolean;
}

export function detectRecurringThresholdAlerts(
  items: IdentifiedRecurringItem[],
  thresholds: Record<string, number>,
  globalThreshold: number
): RecurringDeviationAlert[] {
  const alerts: RecurringDeviationAlert[] = [];

  items.forEach(item => {
    // We need at least 2 active months to detect deviation from historical average
    if (!item.monthlyTrend || item.monthlyTrend.length < 2) {
      return;
    }

    const trend = [...item.monthlyTrend].sort((a, b) => a.month.localeCompare(b.month));
    const latestPt = trend[trend.length - 1];
    
    // Trailing 3 months, excluding the latest.
    const startIdx = Math.max(0, trend.length - 4);
    const priorPts = trend.slice(startIdx, trend.length - 1);

    const priorSum = priorPts.reduce((sum, pt) => sum + pt.amountDisplay, 0);
    const priorAvg = priorSum / priorPts.length;

    const latestAmount = latestPt.amountDisplay;
    const diff = latestAmount - priorAvg;
    
    // Deviation percentage of the latest occurrence compared to prior average
    const deviationPercent = priorAvg > 0 ? (Math.abs(diff) / priorAvg) * 100 : 0;

    const key = item.cleanTitle.toLowerCase().trim();
    const threshold = thresholds[key] ?? globalThreshold;

    const isTriggered = deviationPercent >= threshold;

    if (isTriggered) {
      const latestOcc = item.history[item.history.length - 1];
      alerts.push({
        id: item.id,
        title: item.title,
        cleanTitle: item.cleanTitle,
        category: item.category,
        account: item.account,
        currency: item.currency,
        latestAmount,
        priorAvgAmount: priorAvg,
        deviationPercent,
        threshold,
        type: item.type,
        latestDate: latestOcc ? latestOcc.date : undefined,
        diff,
        isTriggered
      });
    }
  });

  // Sort by highest absolute deviation percentage
  return alerts.sort((a, b) => b.deviationPercent - a.deviationPercent);
}

export interface CategoryVelocityPrediction {
  category: string;
  monthlyLimit: number;
  currentSpent: number;
  dailyVelocity: number;
  projectedSpending: number;
  projectedOverrun: number;
  projectedPercentage: number;
  willExceed: boolean;
  daysPassed: number;
  daysRemaining: number;
  totalDays: number;
  exceedsByDay?: number;
}

/**
 * Predicts if a category will exceed its monthly limit based on current daily spending velocity.
 */
export function predictCategoryBudgetVelocity(
  category: string,
  monthlyLimit: number,
  transactions: Transaction[],
  displayCurrency: DisplayCurrency,
  usdArsRate: number,
  targetMonthKey?: string
): CategoryVelocityPrediction {
  const currentKey = getCurrentMonthKey();
  const monthToEvaluate = targetMonthKey && targetMonthKey !== 'ALL' ? targetMonthKey : currentKey;

  const now = new Date();
  const year = parseInt(monthToEvaluate.substring(0, 4), 10) || now.getFullYear();
  const monthIndex = (parseInt(monthToEvaluate.substring(5, 7), 10) || (now.getMonth() + 1)) - 1;
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  const isCurrentMonth = monthToEvaluate === currentKey;
  const isPastMonth = monthToEvaluate < currentKey;

  let daysPassed = 1;
  if (isCurrentMonth) {
    daysPassed = Math.min(totalDays, Math.max(1, now.getDate()));
  } else if (isPastMonth) {
    daysPassed = totalDays;
  } else {
    daysPassed = 1;
  }

  const daysRemaining = Math.max(0, totalDays - daysPassed);

  // Calculate actual spending in this category for this month
  let currentSpent = 0;
  transactions.forEach(tx => {
    if (tx.type !== 'EXPENSE') return;
    if (tx.category !== category) return;
    if (!tx.date || !tx.date.startsWith(monthToEvaluate)) return;

    // Ignore future transactions if evaluating current month
    if (isCurrentMonth && tx.date > getTodayString()) return;

    const amt = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
    currentSpent += amt;
  });

  const dailyVelocity = daysPassed > 0 ? currentSpent / daysPassed : 0;

  const projectedSpending = isPastMonth
    ? currentSpent
    : currentSpent + (dailyVelocity * daysRemaining);

  const projectedOverrun = Math.max(0, projectedSpending - monthlyLimit);
  const projectedPercentage = monthlyLimit > 0 ? (projectedSpending / monthlyLimit) * 100 : 0;
  const willExceed = monthlyLimit > 0 && (projectedSpending > monthlyLimit || currentSpent > monthlyLimit);

  let exceedsByDay: number | undefined = undefined;
  if (monthlyLimit > 0 && dailyVelocity > 0) {
    const day = Math.ceil(monthlyLimit / dailyVelocity);
    if (day <= totalDays) {
      exceedsByDay = day;
    }
  }

  return {
    category,
    monthlyLimit,
    currentSpent,
    dailyVelocity,
    projectedSpending,
    projectedOverrun,
    projectedPercentage,
    willExceed,
    daysPassed,
    daysRemaining,
    totalDays,
    exceedsByDay,
  };
}

export interface RecentSpendingCategory {
  category: string;
  totalSpent: number;
  transactionCount: number;
  avgPerTx: number;
  percentageOfTotal: number;
  topMerchants: { merchant: string; amount: number; count: number }[];
  dailyAvg: number;
}

/**
 * Analyzes top spending categories in the last 30 days for AI budget optimization.
 */
export function getTopSpendingCategoriesLast30Days(
  transactions: Transaction[],
  displayCurrency: DisplayCurrency,
  usdArsRate: number,
  limit: number = 5
): {
  categories: RecentSpendingCategory[];
  totalSpent30Days: number;
  startDate: string;
  endDate: string;
} {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const startDateStr = thirtyDaysAgo.toISOString().substring(0, 10);
  const endDateStr = today.toISOString().substring(0, 10);

  const categoryMap: Record<string, {
    total: number;
    count: number;
    merchants: Record<string, { amount: number; count: number }>;
  }> = {};

  let totalSpent30Days = 0;

  transactions.forEach(tx => {
    if (tx.type !== 'EXPENSE') return;
    const txDate = tx.date ? tx.date.substring(0, 10) : '';
    if (!txDate || txDate < startDateStr || txDate > endDateStr) return;

    const converted = convertCurrency(tx.amount, tx.currency, displayCurrency, usdArsRate, tx.date, transactions);
    const cat = tx.category || 'General';
    const merch = tx.title || tx.description || 'Unknown';

    if (!categoryMap[cat]) {
      categoryMap[cat] = { total: 0, count: 0, merchants: {} };
    }

    categoryMap[cat].total += converted;
    categoryMap[cat].count += 1;
    totalSpent30Days += converted;

    if (!categoryMap[cat].merchants[merch]) {
      categoryMap[cat].merchants[merch] = { amount: 0, count: 0 };
    }
    categoryMap[cat].merchants[merch].amount += converted;
    categoryMap[cat].merchants[merch].count += 1;
  });

  const categories: RecentSpendingCategory[] = Object.keys(categoryMap)
    .map(cat => {
      const data = categoryMap[cat];
      const topMerchants = Object.keys(data.merchants)
        .map(m => ({ merchant: m, amount: data.merchants[m].amount, count: data.merchants[m].count }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      return {
        category: cat,
        totalSpent: data.total,
        transactionCount: data.count,
        avgPerTx: data.count > 0 ? data.total / data.count : 0,
        percentageOfTotal: totalSpent30Days > 0 ? (data.total / totalSpent30Days) * 100 : 0,
        topMerchants,
        dailyAvg: data.total / 30,
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);

  return {
    categories,
    totalSpent30Days,
    startDate: startDateStr,
    endDate: endDateStr,
  };
}



