export interface Transaction {
  id: string;
  date: string;
  title: string;
  category: string;
  account: string;
  amount: number;
  currency: string; // 'ARS' | 'USD'
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'CC_PAYMENT';
  transferAmount?: number;
  transferCurrency?: string;
  toAccount?: string;
  receiveAmount?: number;
  receiveCurrency?: string;
  description?: string;
  dueDate?: string;
  installments?: string; // e.g. "6/6"
  statementCloseDate?: string; // e.g. "2026-08-25"
  isPaid?: boolean;
}

export interface CreditCardStatement {
  accountName: string;
  statementPeriod: string; // e.g. "2026-08" or "Aug 2026"
  closeDate: string; // e.g. "2026-08-25"
  dueDate?: string; // e.g. "2026-09-05"
  totalExpenses: number;
  totalPayments: number;
  netDue: number;
  currency: string;
  expenses: Transaction[];
  payments: Transaction[];
  isPaid?: boolean;
  isManualOverride?: boolean;
  overrideStatus?: 'PAID' | 'OPEN';
}

export type ClosingRuleType = 
  | 'FIXED_DAY' 
  | 'LAST_WEEKDAY' 
  | 'PREVIOUS_TO_LAST_WEEKDAY' 
  | 'NTH_WEEKDAY';

export interface CreditCardClosingRule {
  ruleType: ClosingRuleType;
  fixedDay?: number; // 1-31 (default 25)
  weekday?: number; // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  nth?: number; // 1=1st, 2=2nd, 3=3rd, 4=4th
  dueDaysAfterClose?: number; // default 10
}

export interface CreditCardAccountConfig {
  accountName: string;
  isCreditCard: boolean;
  statementCloseDay?: number; // legacy
  closingRule?: CreditCardClosingRule;
  paymentDueDay?: number;
}

export interface BudgetGoal {
  category: string;
  monthlyLimitARS: number;
}

export interface RecurringRule {
  id: string;
  title: string;
  category: string;
  account: string;
  amount: number;
  currency: string;
  type: 'EXPENSE' | 'INCOME';
  dayOfMonth: number;
}

export interface InflationPoint {
  month: string; // YYYY-MM
  inflationIndex: number; // Cumulative inflation index
  usdArsRate: number; // Official or MEP rate
}

export interface CategoryItem {
  id: string;
  name: string;
  type: 'EXPENSE' | 'INCOME' | 'BOTH';
  description?: string;
}

export interface AccountItem {
  id: string;
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'WALLET' | 'INVESTMENT' | 'OTHER';
  currency: 'ARS' | 'USD';
  initialBalance?: number;
  closingRule?: CreditCardClosingRule;
  description?: string;
}

export type ViewTab = 'overview' | 'transactions' | 'accounts' | 'budgets' | 'recurring' | 'inflation' | 'ai-advisor' | 'settings' | 'reports';
export type DisplayCurrency = 'ARS' | 'USD';

export interface AccountCustomBalance {
  accountName: string;
  currentBalance: number;
  currency: string;
}

export interface TransactionFilter {
  type?: string;
  category?: string;
  account?: string;
  search?: string;
  month?: string; // YYYY-MM
}

export interface TrendPoint {
  month: string;
  isForecast?: boolean;
  isCurrentMonth?: boolean;
  income: number;
  expense: number;
  net: number;
  projectedIncome?: number;
  projectedExpense?: number;
  projectedNet?: number;
  forecastBalance: number;
  fxRate?: number;
}

export interface PredictiveMetrics {
  currentDayOfMonth: number;
  daysInMonth: number;
  daysRemaining: number;
  dailyExpenseVelocity: number;
  projectedRemainingVariableExpense: number;
  pendingRecurringIncome: number;
  pendingRecurringExpense: number;
  currentLiquidBalance: number;
  projectedEOMBalance: number;
  projectedEOMIncome: number;
  projectedEOMExpense: number;
  projectedEOMNet: number;
  projectedSavingsRate: number;
}

export interface RecurringOccurrence {
  id: string;
  date: string;
  month: string;
  amount: number;
  currency: string;
  account: string;
  title: string;
  description?: string;
  installments?: string;
}

export interface IdentifiedRecurringItem {
  id: string;
  title: string;
  cleanTitle: string;
  category: string;
  type: 'INCOME' | 'EXPENSE';
  account: string;
  currency: string;
  latestAmount: number;
  avgAmount: number;
  minAmount: number;
  maxAmount: number;
  dayOfMonth: number;
  occurrencesCount: number;
  distinctMonthsCount: number;
  isInstallment: boolean;
  installmentInfo?: string;
  history: RecurringOccurrence[];
  monthlyTrend: {
    month: string;
    amount: number;
    amountDisplay: number;
    currency: string;
    account: string;
  }[];
}


