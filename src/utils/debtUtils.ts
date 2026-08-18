import { DebtItem, DebtPayoffStrategy } from '../types';

export interface DebtMonthlyPaymentDetail {
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
  isPaidOffThisMonth: boolean;
}

export interface DebtMonthlySchedulePoint {
  monthIndex: number;
  monthKey: string; // e.g. "2026-09"
  monthLabel: string; // e.g. "Sep 2026"
  totalRemainingBalance: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  totalMonthlyPayment: number;
  cumulativeInterest: number;
  debtBalances: Record<string, number>; // debtId -> remaining balance
  debtPayments: Record<string, DebtMonthlyPaymentDetail>;
  paidOffDebtsThisMonth: string[]; // names of debts paid off in this month
}

export interface DebtPayoffMilestone {
  debtId: string;
  debtName: string;
  category?: string;
  payoffMonthIndex: number;
  payoffMonthKey: string;
  payoffDateFormatted: string;
  totalInterestPaid: number;
  totalPaid: number;
  order: number;
}

export interface DebtSimulationResult {
  strategy: DebtPayoffStrategy;
  totalMonths: number;
  debtFreeDate: string;
  debtFreeDateFormatted: string;
  totalStartingBalance: number;
  totalInterestPaid: number;
  totalAmountPaid: number;
  totalMonthlyBudget: number;
  extraMonthlyPayment: number;
  schedule: DebtMonthlySchedulePoint[];
  milestones: DebtPayoffMilestone[];
  isNeverPaidOff?: boolean;
  baselineMinOnly?: {
    totalMonths: number;
    totalInterestPaid: number;
    totalAmountPaid: number;
    debtFreeDateFormatted: string;
    isNeverPaidOff?: boolean;
  };
  interestSavedVsBaseline: number;
  monthsSavedVsBaseline: number;
}

export const DEFAULT_SAMPLE_DEBTS: DebtItem[] = [
  {
    id: 'debt-1',
    name: 'Visa Gold Credit Card',
    balance: 1450,
    interestRate: 24.99,
    minPayment: 60,
    currency: 'USD',
    category: 'CREDIT_CARD',
    dueDay: 10,
    notes: 'Primary credit card balance',
  },
  {
    id: 'debt-2',
    name: 'Personal Auto Loan',
    balance: 6200,
    interestRate: 9.5,
    minPayment: 180,
    currency: 'USD',
    category: 'AUTO_LOAN',
    dueDay: 20,
    notes: 'Car finance loan',
  },
  {
    id: 'debt-3',
    name: 'Tech Upgrade Loan',
    balance: 850,
    interestRate: 18.0,
    minPayment: 50,
    currency: 'USD',
    category: 'PERSONAL_LOAN',
    dueDay: 5,
    notes: 'Laptop installment plan',
  },
  {
    id: 'debt-4',
    name: 'Medical Clinic Installment',
    balance: 2400,
    interestRate: 12.0,
    minPayment: 110,
    currency: 'USD',
    category: 'MEDICAL',
    dueDay: 15,
  },
];

export function getSavedDebts(): DebtItem[] {
  if (typeof window === 'undefined') return DEFAULT_SAMPLE_DEBTS;
  try {
    const raw = localStorage.getItem('levlev_debts_list') || localStorage.getItem('finance_app_debts');
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse saved debts', e);
  }
  return DEFAULT_SAMPLE_DEBTS;
}

export function saveDebtsToStorage(debts: DebtItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(debts);
    localStorage.setItem('levlev_debts_list', serialized);
    localStorage.setItem('finance_app_debts', serialized);
  } catch (e) {
    console.error('Failed to save debts to localStorage', e);
  }
}

export function getSavedDebtStrategy(): DebtPayoffStrategy {
  if (typeof window === 'undefined') return 'SNOWBALL';
  try {
    const s = localStorage.getItem('levlev_debt_strategy');
    if (s === 'AVALANCHE' || s === 'SNOWBALL') return s;
  } catch {}
  return 'SNOWBALL';
}

export function saveDebtStrategyToStorage(strategy: DebtPayoffStrategy): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('levlev_debt_strategy', strategy);
  } catch {}
}

export function getSavedExtraPayment(): number {
  if (typeof window === 'undefined') return 150;
  try {
    const raw = localStorage.getItem('levlev_debt_extra_payment');
    if (raw !== null) {
      const val = parseFloat(raw);
      if (!isNaN(val) && val >= 0) return val;
    }
  } catch {}
  return 150;
}

export function saveExtraPaymentToStorage(amount: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('levlev_debt_extra_payment', String(amount));
  } catch {}
}

/**
 * Format month index into readable date e.g. "Sep 2026"
 */
function getMonthDetails(startYear: number, startMonthIndex: number, addMonths: number) {
  const date = new Date(startYear, startMonthIndex + addMonths, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const monthKey = `${y}-${m}`;
  const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const fullDateFormatted = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { monthKey, monthLabel, fullDateFormatted };
}

/**
 * Simulates debt payoff timeline based on chosen strategy (Snowball vs Avalanche).
 */
export function simulateDebtPayoff(
  debts: DebtItem[],
  strategy: DebtPayoffStrategy,
  extraMonthlyPayment: number = 0,
  maxMonths: number = 360 // 30 year safety cutoff
): DebtSimulationResult {
  const activeDebts = debts.filter(d => (d.balance || 0) > 0);
  const totalStartingBalance = activeDebts.reduce((sum, d) => sum + (d.balance || 0), 0);
  const sumInitialMinPayments = activeDebts.reduce((sum, d) => sum + (d.minPayment || 0), 0);
  const totalMonthlyBudget = sumInitialMinPayments + Math.max(0, extraMonthlyPayment);

  const now = new Date();
  const startYear = now.getFullYear();
  const startMonthIndex = now.getMonth();

  if (activeDebts.length === 0 || totalStartingBalance === 0) {
    const { monthKey, fullDateFormatted } = getMonthDetails(startYear, startMonthIndex, 0);
    return {
      strategy,
      totalMonths: 0,
      debtFreeDate: monthKey,
      debtFreeDateFormatted: fullDateFormatted,
      totalStartingBalance: 0,
      totalInterestPaid: 0,
      totalAmountPaid: 0,
      totalMonthlyBudget: 0,
      extraMonthlyPayment,
      schedule: [],
      milestones: [],
      interestSavedVsBaseline: 0,
      monthsSavedVsBaseline: 0,
    };
  }

  // Clone debt records for stateful simulation
  interface SimDebt {
    id: string;
    name: string;
    category?: string;
    balance: number;
    interestRate: number;
    monthlyRate: number;
    minPayment: number;
    totalInterestPaid: number;
    totalPaid: number;
    isPaidOff: boolean;
    paidOffMonthIndex?: number;
  }

  const simDebts: SimDebt[] = activeDebts.map(d => ({
    id: d.id,
    name: d.name,
    category: d.category,
    balance: d.balance,
    interestRate: d.interestRate,
    monthlyRate: (d.interestRate / 100) / 12,
    minPayment: d.minPayment,
    totalInterestPaid: 0,
    totalPaid: 0,
    isPaidOff: false,
  }));

  // Sort order determination function
  const sortDebts = (list: SimDebt[], strat: DebtPayoffStrategy) => {
    return [...list].sort((a, b) => {
      if (strat === 'SNOWBALL') {
        // Lowest balance first; tie breaker higher interest
        return a.balance - b.balance || b.interestRate - a.interestRate;
      } else {
        // AVALANCHE: Highest interest rate first; tie breaker lower balance
        return b.interestRate - a.interestRate || a.balance - b.balance;
      }
    });
  };

  const schedule: DebtMonthlySchedulePoint[] = [];
  const milestones: DebtPayoffMilestone[] = [];
  let cumulativeInterest = 0;
  let monthIndex = 1;
  let isNeverPaidOff = false;

  // Add initial month 0 point
  const { monthKey: m0Key, monthLabel: m0Label } = getMonthDetails(startYear, startMonthIndex, 0);
  const initialBalances: Record<string, number> = {};
  simDebts.forEach(d => { initialBalances[d.id] = d.balance; });

  schedule.push({
    monthIndex: 0,
    monthKey: m0Key,
    monthLabel: m0Label,
    totalRemainingBalance: totalStartingBalance,
    totalInterestPaid: 0,
    totalPrincipalPaid: 0,
    totalMonthlyPayment: 0,
    cumulativeInterest: 0,
    debtBalances: { ...initialBalances },
    debtPayments: {},
    paidOffDebtsThisMonth: [],
  });

  while (simDebts.some(d => d.balance > 0.01) && monthIndex <= maxMonths) {
    const { monthKey, monthLabel, fullDateFormatted } = getMonthDetails(startYear, startMonthIndex, monthIndex);
    
    let monthTotalInterest = 0;
    let monthTotalPrincipal = 0;
    let monthTotalPayment = 0;
    const paidOffDebtsThisMonth: string[] = [];
    const debtPayments: Record<string, DebtMonthlyPaymentDetail> = {};

    // 1. Accrue interest for all active debts
    simDebts.forEach(debt => {
      if (debt.balance > 0.01) {
        const monthlyInterest = debt.balance * debt.monthlyRate;
        debt.balance += monthlyInterest;
        debt.totalInterestPaid += monthlyInterest;
        monthTotalInterest += monthlyInterest;
      }
    });

    let availableBudgetThisMonth = totalMonthlyBudget;

    // 2. Step 1: Make minimum payments on all active debts
    simDebts.forEach(debt => {
      if (debt.balance > 0.01) {
        const minDue = debt.minPayment;
        const actualMinPay = Math.min(debt.balance, minDue);
        
        debt.balance -= actualMinPay;
        debt.totalPaid += actualMinPay;
        monthTotalPayment += actualMinPay;
        availableBudgetThisMonth -= actualMinPay;

        const interestAccruedThisMonth = (debt.balance + actualMinPay) * debt.monthlyRate;
        debtPayments[debt.id] = {
          payment: actualMinPay,
          principal: actualMinPay - Math.min(actualMinPay, interestAccruedThisMonth),
          interest: Math.min(actualMinPay, interestAccruedThisMonth),
          remainingBalance: Math.max(0, debt.balance),
          isPaidOffThisMonth: false,
        };

        if (debt.balance <= 0.01) {
          debt.balance = 0;
          debt.isPaidOff = true;
          debt.paidOffMonthIndex = monthIndex;
          debtPayments[debt.id].isPaidOffThisMonth = true;
          paidOffDebtsThisMonth.push(debt.name);
          milestones.push({
            debtId: debt.id,
            debtName: debt.name,
            category: debt.category,
            payoffMonthIndex: monthIndex,
            payoffMonthKey: monthKey,
            payoffDateFormatted: fullDateFormatted,
            totalInterestPaid: debt.totalInterestPaid,
            totalPaid: debt.totalPaid,
            order: milestones.length + 1,
          });
        }
      }
    });

    // 3. Step 2: Allocate all remaining budget (snowball/avalanche accelerator) to the top priority active debt
    const priorityOrderedActiveDebts = sortDebts(simDebts.filter(d => d.balance > 0.01), strategy);

    for (const targetDebt of priorityOrderedActiveDebts) {
      if (availableBudgetThisMonth <= 0.01) break;
      if (targetDebt.balance <= 0.01) continue;

      const extraToApply = Math.min(targetDebt.balance, availableBudgetThisMonth);
      targetDebt.balance -= extraToApply;
      targetDebt.totalPaid += extraToApply;
      monthTotalPayment += extraToApply;
      availableBudgetThisMonth -= extraToApply;

      // Update debt payment detail record
      const currentDetail = debtPayments[targetDebt.id] || {
        payment: 0,
        principal: 0,
        interest: 0,
        remainingBalance: 0,
        isPaidOffThisMonth: false,
      };

      currentDetail.payment += extraToApply;
      currentDetail.principal += extraToApply;
      currentDetail.remainingBalance = Math.max(0, targetDebt.balance);

      if (targetDebt.balance <= 0.01) {
        targetDebt.balance = 0;
        targetDebt.isPaidOff = true;
        targetDebt.paidOffMonthIndex = monthIndex;
        currentDetail.isPaidOffThisMonth = true;
        paidOffDebtsThisMonth.push(targetDebt.name);
        milestones.push({
          debtId: targetDebt.id,
          debtName: targetDebt.name,
          category: targetDebt.category,
          payoffMonthIndex: monthIndex,
          payoffMonthKey: monthKey,
          payoffDateFormatted: fullDateFormatted,
          totalInterestPaid: targetDebt.totalInterestPaid,
          totalPaid: targetDebt.totalPaid,
          order: milestones.length + 1,
        });
      }

      debtPayments[targetDebt.id] = currentDetail;
    }

    cumulativeInterest += monthTotalInterest;
    monthTotalPrincipal = monthTotalPayment - monthTotalInterest;
    const currentRemainingBalance = simDebts.reduce((sum, d) => sum + Math.max(0, d.balance), 0);

    const snapshotBalances: Record<string, number> = {};
    simDebts.forEach(d => { snapshotBalances[d.id] = Math.max(0, Math.round(d.balance * 100) / 100); });

    schedule.push({
      monthIndex,
      monthKey,
      monthLabel,
      totalRemainingBalance: Math.max(0, Math.round(currentRemainingBalance * 100) / 100),
      totalInterestPaid: Math.round(monthTotalInterest * 100) / 100,
      totalPrincipalPaid: Math.round(monthTotalPrincipal * 100) / 100,
      totalMonthlyPayment: Math.round(monthTotalPayment * 100) / 100,
      cumulativeInterest: Math.round(cumulativeInterest * 100) / 100,
      debtBalances: snapshotBalances,
      debtPayments,
      paidOffDebtsThisMonth,
    });

    monthIndex++;
  }

  if (monthIndex > maxMonths) {
    isNeverPaidOff = true;
  }

  const finalMonths = isNeverPaidOff ? maxMonths : Math.max(0, monthIndex - 1);
  const finalDateObj = getMonthDetails(startYear, startMonthIndex, finalMonths);

  // Baseline calculation (Minimum payments only, no strategy accelerator)
  const baseline = simulateMinimumOnlyBaseline(debts, startYear, startMonthIndex, maxMonths);

  const interestSavedVsBaseline = baseline ? Math.max(0, baseline.totalInterestPaid - cumulativeInterest) : 0;
  const monthsSavedVsBaseline = baseline ? Math.max(0, baseline.totalMonths - finalMonths) : 0;

  return {
    strategy,
    totalMonths: finalMonths,
    debtFreeDate: finalDateObj.monthKey,
    debtFreeDateFormatted: finalDateObj.fullDateFormatted,
    totalStartingBalance: Math.round(totalStartingBalance * 100) / 100,
    totalInterestPaid: Math.round(cumulativeInterest * 100) / 100,
    totalAmountPaid: Math.round((totalStartingBalance + cumulativeInterest) * 100) / 100,
    totalMonthlyBudget,
    extraMonthlyPayment,
    schedule,
    milestones,
    isNeverPaidOff,
    baselineMinOnly: baseline,
    interestSavedVsBaseline: Math.round(interestSavedVsBaseline * 100) / 100,
    monthsSavedVsBaseline,
  };
}

/**
 * Simulates a baseline scenario where user only pays the minimum required on each debt independently.
 */
function simulateMinimumOnlyBaseline(
  debts: DebtItem[],
  startYear: number,
  startMonthIndex: number,
  maxMonths: number = 360
) {
  const activeDebts = debts.filter(d => (d.balance || 0) > 0);
  if (activeDebts.length === 0) return undefined;

  const sim = activeDebts.map(d => ({
    balance: d.balance,
    interestRate: d.interestRate,
    monthlyRate: (d.interestRate / 100) / 12,
    minPayment: d.minPayment,
    totalInterest: 0,
    totalPaid: 0,
  }));

  let months = 1;
  let totalInterest = 0;
  let totalPaid = 0;
  let isNeverPaid = false;

  while (sim.some(d => d.balance > 0.01) && months <= maxMonths) {
    sim.forEach(debt => {
      if (debt.balance > 0.01) {
        const monthlyInterest = debt.balance * debt.monthlyRate;
        debt.balance += monthlyInterest;
        debt.totalInterest += monthlyInterest;
        totalInterest += monthlyInterest;

        // If minPayment < monthlyInterest, debt would balloon without minimum adjustment
        const pay = Math.min(debt.balance, Math.max(debt.minPayment, monthlyInterest + (debt.balance * 0.01)));
        debt.balance -= pay;
        debt.totalPaid += pay;
        totalPaid += pay;
      }
    });
    months++;
  }

  if (months > maxMonths) isNeverPaid = true;
  const actualMonths = isNeverPaid ? maxMonths : Math.max(0, months - 1);
  const finalDate = getMonthDetails(startYear, startMonthIndex, actualMonths);

  return {
    totalMonths: actualMonths,
    totalInterestPaid: Math.round(totalInterest * 100) / 100,
    totalAmountPaid: Math.round(totalPaid * 100) / 100,
    debtFreeDateFormatted: finalDate.fullDateFormatted,
    isNeverPaidOff: isNeverPaid,
  };
}
