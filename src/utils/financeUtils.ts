import { Transaction, DisplayCurrency, RecurringRule, TrendPoint, PredictiveMetrics, BudgetGoal, IdentifiedRecurringItem, RecurringOccurrence, InflationPoint, CreditCardStatement, CreditCardClosingRule, ClosingRuleType, AccountItem, AccountCustomBalance } from '../types';

export function isCreditCardAccount(accountName: string, customCCMap?: Record<string, boolean>): boolean {
  if (customCCMap && customCCMap[accountName] !== undefined) {
    return customCCMap[accountName];
  }
  const nameLower = (accountName || '').toLowerCase();
  const keywords = ['visa', 'master', 'tarjeta', 'tc', 'credit', 'amex', 'naranja', 'comafi', 'caball', 'american express'];
  return keywords.some(kw => nameLower.includes(kw));
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

// Cache for historical rates derived from explicit user transfers
const transferFxCache = new Map<string, number>();

/**
 * Returns the historical USD/ARS rate for a given transaction date or month (YYYY-MM).
 * Prioritizes:
 * 1. Explicit transfer execution rates in user transactions for that month
 * 2. Historical FX rate table (historicalInflationAndFX) for that month
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
  // This is now second priority as users might prefer the official historicals over bank-specific rates
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

const GLOBAL_USD_RATES: Record<string, number> = {
  USD: 1,
  USDT: 1,
  EUR: 0.92,
  GBP: 0.79,
  BRL: 5.60,
  MXN: 18.5,
  CLP: 950,
};

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: DisplayCurrency,
  usdArsRate: number,
  dateStr?: string,
  transactions?: Transaction[],
  historyOverride?: InflationPoint[]
): number {
  const fromCode = (fromCurrency || 'ARS').toUpperCase();
  const toCode = (toCurrency || 'ARS').toUpperCase();

  if (fromCode === toCode) return amount;

  const effectiveUsdArsRate = getHistoricalFxRate(dateStr, usdArsRate, transactions, historyOverride);

  // Convert 'fromCurrency' amount to USD first
  let amountInUSD = amount;
  if (fromCode === 'ARS') {
    amountInUSD = effectiveUsdArsRate > 0 ? amount / effectiveUsdArsRate : 0;
  } else if (GLOBAL_USD_RATES[fromCode]) {
    amountInUSD = amount / GLOBAL_USD_RATES[fromCode];
  }

  // Convert USD amount to 'toCurrency'
  if (toCode === 'USD' || toCode === 'USDT') {
    return amountInUSD;
  } else if (toCode === 'ARS') {
    return amountInUSD * effectiveUsdArsRate;
  } else if (GLOBAL_USD_RATES[toCode]) {
    return amountInUSD * GLOBAL_USD_RATES[toCode];
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

  const curr = (currency || 'USD').toUpperCase();
  const localeMap: Record<string, string> = {
    ARS: 'es-AR',
    USD: 'en-US',
    USDT: 'en-US',
    EUR: 'de-DE',
    BRL: 'pt-BR',
    GBP: 'en-GB',
    MXN: 'es-MX',
    CLP: 'es-CL',
  };

  const currencyMap: Record<string, string> = {
    ARS: 'ARS',
    USD: 'USD',
    USDT: 'USD',
    EUR: 'EUR',
    BRL: 'BRL',
    GBP: 'GBP',
    MXN: 'MXN',
    CLP: 'CLP',
  };

  const locale = localeMap[curr] || 'en-US';
  const currencyCode = currencyMap[curr] || 'USD';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: curr === 'ARS' || curr === 'CLP' ? 0 : 2,
    }).format(amount);
  } catch (e) {
    return `${curr} ${amount.toFixed(2)}`;
  }
}

export function formatCurrencyCompact(amount: number, currency: DisplayCurrency, forcePrivacy?: boolean): string {
  const isPrivate = forcePrivacy !== undefined ? forcePrivacy : getGlobalPrivacyMode();
  if (isPrivate) {
    return '••••••';
  }

  const curr = (currency || 'USD').toUpperCase();
  const localeMap: Record<string, string> = {
    ARS: 'es-AR',
    USD: 'en-US',
    USDT: 'en-US',
    EUR: 'de-DE',
    BRL: 'pt-BR',
    GBP: 'en-GB',
    MXN: 'es-MX',
    CLP: 'es-CL',
  };

  const currencyMap: Record<string, string> = {
    ARS: 'ARS',
    USD: 'USD',
    USDT: 'USD',
    EUR: 'EUR',
    BRL: 'BRL',
    GBP: 'GBP',
    MXN: 'MXN',
    CLP: 'CLP',
  };

  const locale = localeMap[curr] || 'en-US';
  const currencyCode = currencyMap[curr] || 'USD';
  
  if (Math.abs(amount) < 1000) {
    return formatCurrency(amount, currency, forcePrivacy);
  }

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
    return `${curr} ${(amount / 1000).toFixed(1)}k`;
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

  const allNames = Array.from(new Set([
    ...Object.keys(accountDeltas),
    ...(customBalances ? Object.keys(customBalances) : []),
    ...(accountsList ? accountsList.map(a => a.name) : [])
  ])).sort();

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

export function computePredictiveTrend(
  transactions: Transaction[],
  displayCurrency: DisplayCurrency,
  usdArsRate: number,
  recurringRules: RecurringRule[] = [],
  customBalances?: Record<string, { currentBalance: number; currency: string }>,
  historyOverride?: InflationPoint[]
): {
  trendData: TrendPoint[];
  metrics: PredictiveMetrics;
} {
  // 1. Calculate current liquid assets
  const accounts = computeAccountBalances(transactions, usdArsRate, customBalances);
  const currentLiquidBalance = displayCurrency === 'USD'
    ? accounts.reduce((sum, a) => sum + a.balanceUSD, 0)
    : accounts.reduce((sum, a) => sum + a.balanceARS, 0);

  // 2. Map monthly transactions
  const monthlyMap: Record<string, { income: number; expense: number }> = {};
  let latestDateStr = '2026-08-05';

  transactions.forEach(tx => {
    if (tx.date && tx.date > latestDateStr) {
      latestDateStr = tx.date;
    }
    const monthKey = tx.date ? tx.date.substring(0, 7) : '2026-01';
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
  const currentMonthKey = getCurrentMonthKey();

  // Current day details from system date
  const now = new Date();
  const currentDayOfMonth = Math.max(1, now.getDate());

  const year = parseInt(currentMonthKey.substring(0, 4)) || now.getFullYear();
  const monthIdx = parseInt(currentMonthKey.substring(5, 7)) || (now.getMonth() + 1);
  const daysInMonth = new Date(year, monthIdx, 0).getDate();
  const daysRemaining = Math.max(0, daysInMonth - currentDayOfMonth);

  const currentDayStr = `${currentMonthKey}-${String(currentDayOfMonth).padStart(2, '0')}`;

  // Filter current month transactions into PAST (<= today) and FUTURE (> today)
  const currentMonthTransactions = transactions.filter(t => t.date && t.date.substring(0, 7) === currentMonthKey);
  const pastTransactions = currentMonthTransactions.filter(t => {
    const tDayStr = t.date.substring(0, 10);
    return tDayStr <= currentDayStr;
  });
  const futureTransactions = currentMonthTransactions.filter(t => {
    const tDayStr = t.date.substring(0, 10);
    return tDayStr > currentDayStr;
  });

  // Calculate actual income and expense so far this month
  let currentActualIncome = 0;
  let currentActualExpense = 0;

  pastTransactions.forEach(t => {
    const amt = convertCurrency(t.amount, t.currency, displayCurrency, usdArsRate, t.date, transactions);
    if (t.type === 'INCOME') {
      currentActualIncome += amt;
    } else if (t.type === 'EXPENSE') {
      currentActualExpense += amt;
    }
  });

  // Identify recurring / fixed expenses that already happened in pastTransactions to isolate variable velocity
  let recurringPastExpense = 0;
  const activeRules = recurringRules || [];

  activeRules.forEach(rule => {
    if (rule.type === 'EXPENSE') {
      const match = pastTransactions.find(t => 
        t.type === 'EXPENSE' && 
        t.title?.toLowerCase().includes(rule.title.split(' ')[0].toLowerCase())
      );
      if (match) {
        recurringPastExpense += convertCurrency(match.amount, match.currency, displayCurrency, usdArsRate, match.date, transactions);
      }
    }
  });

  // Variable expenses so far = past actual expenses minus identified fixed recurring bills
  const variableExpenseSoFar = Math.max(0, currentActualExpense - recurringPastExpense);

  // Daily spending velocity (run-rate of variable expenses per elapsed day)
  const dailyExpenseVelocity = currentDayOfMonth > 0 ? variableExpenseSoFar / currentDayOfMonth : 0;
  const projectedRemainingVariableExpense = dailyExpenseVelocity * daysRemaining;

  // Calculate pending recurring items for the remaining portion of the month:
  // 1. Explicit future scheduled transactions logged in the dataset
  let pendingRecurringIncome = 0;
  let pendingRecurringExpense = 0;

  futureTransactions.forEach(t => {
    const amt = convertCurrency(t.amount, t.currency, displayCurrency, usdArsRate, t.date, transactions);
    if (t.type === 'INCOME') {
      pendingRecurringIncome += amt;
    } else if (t.type === 'EXPENSE') {
      pendingRecurringExpense += amt;
    }
  });

  // 2. Unlogged recurring rules scheduled for future days of this month that haven't been matched
  activeRules.forEach(rule => {
    const ruleDay = rule.dayOfMonth || 15;
    if (ruleDay >= currentDayOfMonth) {
      // Check if any transaction in current month already matches this rule
      const exists = currentMonthTransactions.some(t => 
        t.type === rule.type && 
        t.title?.toLowerCase().includes(rule.title.split(' ')[0].toLowerCase())
      );
      if (!exists) {
        const amt = convertCurrency(rule.amount, rule.currency, displayCurrency, usdArsRate);
        if (rule.type === 'INCOME') {
          pendingRecurringIncome += amt;
        } else if (rule.type === 'EXPENSE') {
          pendingRecurringExpense += amt;
        }
      }
    }
  });

  const projectedEOMIncome = currentActualIncome + pendingRecurringIncome;
  const projectedEOMExpense = currentActualExpense + projectedRemainingVariableExpense + pendingRecurringExpense;
  const projectedEOMNet = projectedEOMIncome - projectedEOMExpense;

  const pendingNetDelta = (pendingRecurringIncome - pendingRecurringExpense - projectedRemainingVariableExpense);
  const projectedEOMBalance = currentLiquidBalance + pendingNetDelta;

  const projectedSavingsRate = projectedEOMIncome > 0
    ? ((projectedEOMIncome - projectedEOMExpense) / projectedEOMIncome) * 100
    : 0;

  const metrics: PredictiveMetrics = {
    currentDayOfMonth,
    daysInMonth,
    daysRemaining,
    dailyExpenseVelocity,
    projectedRemainingVariableExpense,
    pendingRecurringIncome,
    pendingRecurringExpense,
    currentLiquidBalance,
    projectedEOMBalance,
    projectedEOMIncome,
    projectedEOMExpense,
    projectedEOMNet,
    projectedSavingsRate
  };

  const trendData: TrendPoint[] = [];
  const pastMonths = sortedMonths.filter(m => m !== currentMonthKey);

  // Compute backwards balances for historical points so the line smoothly connects
  let runningBalance = currentLiquidBalance - (currentActualIncome - currentActualExpense);
  const monthBalancesMap: Record<string, number> = {};

  for (let i = pastMonths.length - 1; i >= 0; i--) {
    const m = pastMonths[i];
    monthBalancesMap[m] = runningBalance;
    const mNet = (monthlyMap[m]?.income || 0) - (monthlyMap[m]?.expense || 0);
    runningBalance -= mNet;
  }

  // Add historical points
  pastMonths.forEach(m => {
    const inc = monthlyMap[m].income;
    const exp = monthlyMap[m].expense;
    trendData.push({
      month: m,
      isForecast: false,
      isCurrentMonth: false,
      income: Math.round(inc),
      expense: Math.round(exp),
      net: Math.round(inc - exp),
      forecastBalance: Math.round(monthBalancesMap[m] || 0),
      fxRate: getHistoricalFxRate(m, usdArsRate, transactions, historyOverride),
    });
  });

  // Add current month point (as of today)
  trendData.push({
    month: `${currentMonthKey} (Today)`,
    isForecast: false,
    isCurrentMonth: true,
    income: Math.round(currentActualIncome),
    expense: Math.round(currentActualExpense),
    net: Math.round(currentActualIncome - currentActualExpense),
    projectedIncome: Math.round(projectedEOMIncome),
    projectedExpense: Math.round(projectedEOMExpense),
    projectedNet: Math.round(projectedEOMNet),
    forecastBalance: Math.round(currentLiquidBalance),
    fxRate: usdArsRate,
  });

  // Add current month end-of-month projection point
  trendData.push({
    month: `${currentMonthKey} (EOM Est.)`,
    isForecast: true,
    isCurrentMonth: false,
    income: 0,
    expense: 0,
    net: 0,
    projectedIncome: Math.round(projectedEOMIncome),
    projectedExpense: Math.round(projectedEOMExpense),
    projectedNet: Math.round(projectedEOMNet),
    forecastBalance: Math.round(projectedEOMBalance),
    fxRate: usdArsRate,
  });

  // Next month forecast
  const nextMonthYear = monthIdx === 12 ? year + 1 : year;
  const nextMonthNum = monthIdx === 12 ? 1 : monthIdx + 1;
  const nextMonthKey = `${nextMonthYear}-${nextMonthNum < 10 ? '0' : ''}${nextMonthNum}`;

  let nextMonthIncome = 0;
  let nextMonthExpense = 0;

  recurringRules.forEach(rule => {
    const amt = convertCurrency(rule.amount, rule.currency, displayCurrency, usdArsRate);
    if (rule.type === 'INCOME') nextMonthIncome += amt;
    if (rule.type === 'EXPENSE') nextMonthExpense += amt;
  });

  const past3Months = pastMonths.slice(-3);
  const avgPastExpense = past3Months.length > 0
    ? past3Months.reduce((s, m) => s + monthlyMap[m].expense, 0) / past3Months.length
    : currentActualExpense * 2;

  nextMonthExpense = Math.max(nextMonthExpense, avgPastExpense);
  const nextMonthNet = nextMonthIncome - nextMonthExpense;
  const nextMonthProjectedEOMBalance = projectedEOMBalance + nextMonthNet;

  trendData.push({
    month: `${nextMonthKey} (Fcst)`,
    isForecast: true,
    isCurrentMonth: false,
    income: 0,
    expense: 0,
    net: 0,
    projectedIncome: Math.round(nextMonthIncome),
    projectedExpense: Math.round(nextMonthExpense),
    projectedNet: Math.round(nextMonthNet),
    forecastBalance: Math.round(nextMonthProjectedEOMBalance),
    fxRate: usdArsRate,
  });

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
 * 2. Requires at least 6 occurrences/months.
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

  const result: IdentifiedRecurringItem[] = [];

  groups.forEach((txList, groupKey) => {
    const sorted = [...txList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Count distinct months and occurrences
    const distinctMonths = new Set<string>();
    let daySum = 0;
    const accountsSet = new Set<string>();

    sorted.forEach(t => {
      if (t.date) {
        distinctMonths.add(t.date.substring(0, 7));
        const dt = new Date(t.date);
        if (!isNaN(dt.getDate())) {
          daySum += dt.getDate();
        }
      }
      if (t.account) {
        accountsSet.add(t.account);
      }
    });

    // Requirement: MUST have happened at least 6 times (distinct months >= 6 or sorted.length >= 6)
    if (distinctMonths.size >= 6 || sorted.length >= 6) {
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
    if (sorted.length > 0) {
      installmentStartDate = sorted[0].date?.substring(0, 7);
      const lastTx = sorted[sorted.length - 1];
      if (installmentCurrent && installmentTotal && lastTx.date) {
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


