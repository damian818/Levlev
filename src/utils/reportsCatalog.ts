import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  Repeat, 
  Calendar, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  Globe, 
  DollarSign, 
  Activity, 
  Scale, 
  Flame, 
  Clock, 
  Target, 
  Building2, 
  Zap,
  Users,
  Compass
} from 'lucide-react';
import React from 'react';

export type ReportCategoryId = 'CASH_FLOW' | 'SPENDING' | 'DEBT_CREDIT' | 'CURRENCY_MACRO' | 'STRATEGY';

export interface ReportDefinition {
  id: string;
  category: ReportCategoryId;
  titleKey: string;
  descKey: string;
  defaultTitle: string;
  defaultDesc: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
  recommendedOrder: number;
  isDefault: boolean;
}

export const REPORT_CATEGORIES: { id: ReportCategoryId; labelEn: string; labelEs: string }[] = [
  { id: 'CASH_FLOW', labelEn: 'Cash Flow & Inflows', labelEs: 'Flujo de Caja e Ingresos' },
  { id: 'SPENDING', labelEn: 'Spending & Breakdown', labelEs: 'Gastos y Desglose' },
  { id: 'DEBT_CREDIT', labelEn: 'Debt & Credit Cards', labelEs: 'Deudas y Tarjetas' },
  { id: 'CURRENCY_MACRO', labelEn: 'Currency & Macro FX', labelEs: 'Multidivisa y Macro FX' },
  { id: 'STRATEGY', labelEn: 'Strategy & Health', labelEs: 'Estrategia y Salud Financiera' },
];

export const REPORT_CATALOG: ReportDefinition[] = [
  // 1. CASH FLOW
  {
    id: 'cash_flow',
    category: 'CASH_FLOW',
    titleKey: 'reports.catalog.cash_flow.title',
    descKey: 'reports.catalog.cash_flow.desc',
    defaultTitle: 'Monthly Cash Flow & Net Inflow/Outflow',
    defaultDesc: 'Comprehensive monthly breakdown comparing total incoming cash, living outflows, and net surplus trajectory.',
    icon: BarChart3,
    badge: 'Core Metric',
    recommendedOrder: 1,
    isDefault: true,
  },
  {
    id: 'savings_rate',
    category: 'CASH_FLOW',
    titleKey: 'reports.catalog.savings_rate.title',
    descKey: 'reports.catalog.savings_rate.desc',
    defaultTitle: 'Monthly Net Savings Rate & Velocity',
    defaultDesc: 'Percentage of total income retained each month with benchmark tiers (Frugal, Steady, High Velocity).',
    icon: TrendingUp,
    badge: 'Wealth Building',
    recommendedOrder: 2,
    isDefault: true,
  },
  {
    id: 'income_sources',
    category: 'CASH_FLOW',
    titleKey: 'reports.catalog.income_sources.title',
    descKey: 'reports.catalog.income_sources.desc',
    defaultTitle: 'Income Streams & Inflow Diversification',
    defaultDesc: 'Analysis of income sources (salary, investments, freelancing, transfers) and income stream concentration.',
    icon: Wallet,
    badge: 'Inflows',
    recommendedOrder: 3,
    isDefault: false,
  },
  {
    id: 'quarterly_trends',
    category: 'CASH_FLOW',
    titleKey: 'reports.catalog.quarterly_trends.title',
    descKey: 'reports.catalog.quarterly_trends.desc',
    defaultTitle: 'Quarterly Performance Dynamics (Q1–Q4)',
    defaultDesc: 'Aggregated macro quarterly view analyzing seasonal shifts and net capital accumulation across quarters.',
    icon: Calendar,
    badge: 'Quarterly',
    recommendedOrder: 4,
    isDefault: false,
  },

  // 2. SPENDING
  {
    id: 'category_distribution',
    category: 'SPENDING',
    titleKey: 'reports.catalog.category_distribution.title',
    descKey: 'reports.catalog.category_distribution.desc',
    defaultTitle: 'Category Spending Distribution Matrix',
    defaultDesc: 'Rank-ordered expense distribution with dynamic pie/donut allocation and percentage of total outflows.',
    icon: PieChartIcon,
    badge: 'Essential',
    recommendedOrder: 5,
    isDefault: true,
  },
  {
    id: 'needs_wants',
    category: 'SPENDING',
    titleKey: 'reports.catalog.needs_wants.title',
    descKey: 'reports.catalog.needs_wants.desc',
    defaultTitle: '50/30/20 Rule: Needs vs Wants vs Capital',
    defaultDesc: 'Classifies outflows into essential living costs (Needs), lifestyle & leisure (Wants), and capital savings.',
    icon: Scale,
    badge: 'Framework',
    recommendedOrder: 6,
    isDefault: false,
  },
  {
    id: 'spending_cadence',
    category: 'SPENDING',
    titleKey: 'reports.catalog.spending_cadence.title',
    descKey: 'reports.catalog.spending_cadence.desc',
    defaultTitle: 'Day-of-Week & Spending Cadence Heatmap',
    defaultDesc: 'Identifies expenditure patterns by day of the week and compares weekday vs weekend spending velocity.',
    icon: Clock,
    badge: 'Behavioral',
    recommendedOrder: 7,
    isDefault: false,
  },
  {
    id: 'top_merchants',
    category: 'SPENDING',
    titleKey: 'reports.catalog.top_merchants.title',
    descKey: 'reports.catalog.top_merchants.desc',
    defaultTitle: 'Top Payees & Outflow Concentration',
    defaultDesc: 'Leaderboard of top merchants and payees by total cumulative volume and average ticket size.',
    icon: Building2,
    badge: 'Payees',
    recommendedOrder: 8,
    isDefault: false,
  },
  {
    id: 'daily_burn_rate',
    category: 'SPENDING',
    titleKey: 'reports.catalog.daily_burn_rate.title',
    descKey: 'reports.catalog.daily_burn_rate.desc',
    defaultTitle: 'Average Daily Spend & Burn Rate Runway',
    defaultDesc: 'Calculates true average daily burn velocity, month-end projection, and liquid emergency runway.',
    icon: Flame,
    badge: 'Runway',
    recommendedOrder: 9,
    isDefault: false,
  },
  {
    id: 'budget_adherence',
    category: 'SPENDING',
    titleKey: 'reports.catalog.budget_adherence.title',
    descKey: 'reports.catalog.budget_adherence.desc',
    defaultTitle: 'Budget Adherence & Overrun Scorecard',
    defaultDesc: 'Variance analysis showing actual category spend versus monthly targets with early warning alerts.',
    icon: Target,
    badge: 'Budgeting',
    recommendedOrder: 10,
    isDefault: false,
  },

  // 3. DEBT & CREDIT
  {
    id: 'recurring_overhead',
    category: 'DEBT_CREDIT',
    titleKey: 'reports.catalog.recurring_overhead.title',
    descKey: 'reports.catalog.recurring_overhead.desc',
    defaultTitle: 'Recurring Subscriptions & Fixed Overhead',
    defaultDesc: 'Monitors recurring commitments, active subscriptions, annualized fixed costs, and baseline leakages.',
    icon: Repeat,
    badge: 'Subscriptions',
    recommendedOrder: 11,
    isDefault: true,
  },
  {
    id: 'cc_installments',
    category: 'DEBT_CREDIT',
    titleKey: 'reports.catalog.cc_installments.title',
    descKey: 'reports.catalog.cc_installments.desc',
    defaultTitle: 'Credit Card Installments & Closing Trajectory',
    defaultDesc: 'Forward-looking installment (cuotas) schedule, statement cutoffs, and remaining multi-month commitments.',
    icon: CreditCard,
    badge: 'Installments',
    recommendedOrder: 12,
    isDefault: false,
  },
  {
    id: 'debt_radar',
    category: 'DEBT_CREDIT',
    titleKey: 'reports.catalog.debt_radar.title',
    descKey: 'reports.catalog.debt_radar.desc',
    defaultTitle: 'Debt Payoff & Interest Burden Burndown',
    defaultDesc: 'Tracks total debt obligations, monthly interest drag, and acceleration velocity under payoff strategies.',
    icon: TrendingDown,
    badge: 'Debt Free',
    recommendedOrder: 13,
    isDefault: false,
  },
  {
    id: 'shared_allocation',
    category: 'DEBT_CREDIT',
    titleKey: 'reports.catalog.shared_allocation.title',
    descKey: 'reports.catalog.shared_allocation.desc',
    defaultTitle: 'Shared Household vs Personal Split',
    defaultDesc: 'Separates shared family or roommate expenses from private personal outlays with settlement balance.',
    icon: Users,
    badge: 'Household',
    recommendedOrder: 14,
    isDefault: false,
  },

  // 4. CURRENCY & MACRO FX
  {
    id: 'dual_currency',
    category: 'CURRENCY_MACRO',
    titleKey: 'reports.catalog.dual_currency.title',
    descKey: 'reports.catalog.dual_currency.desc',
    defaultTitle: 'Dual-Currency Inflow & Outflow Multi-Exchange',
    defaultDesc: 'Tracks native domestic currency vs foreign currency transactions with real-time conversion overlays.',
    icon: DollarSign,
    badge: 'Multi-FX',
    recommendedOrder: 15,
    isDefault: false,
  },
  {
    id: 'fx_exposure',
    category: 'CURRENCY_MACRO',
    titleKey: 'reports.catalog.fx_exposure.title',
    descKey: 'reports.catalog.fx_exposure.desc',
    defaultTitle: 'Multi-Currency Portfolio & FX Exposure Audit',
    defaultDesc: 'Audits transaction and balance exposure across USD, EUR, ARS, BRL, USDT, and other global currencies.',
    icon: Globe,
    badge: 'Exposure',
    recommendedOrder: 16,
    isDefault: false,
  },
  {
    id: 'inflation_impact',
    category: 'CURRENCY_MACRO',
    titleKey: 'reports.catalog.inflation_impact.title',
    descKey: 'reports.catalog.inflation_impact.desc',
    defaultTitle: 'Inflation Purchasing Power Erosion',
    defaultDesc: 'Compares nominal expenses to real purchasing power adjusted for monthly inflation (IPC) index changes.',
    icon: Zap,
    badge: 'Inflation (IPC)',
    recommendedOrder: 17,
    isDefault: false,
  },
  {
    id: 'account_liquidity',
    category: 'CURRENCY_MACRO',
    titleKey: 'reports.catalog.account_liquidity.title',
    descKey: 'reports.catalog.account_liquidity.desc',
    defaultTitle: 'Account Liquidity & Net Cash Transfer Velocity',
    defaultDesc: 'Visualizes capital flowing into and out of each bank account, digital wallet, cash, and crypto reserve.',
    icon: Layers,
    badge: 'Accounts',
    recommendedOrder: 18,
    isDefault: false,
  },

  // 5. STRATEGY & HEALTH
  {
    id: 'financial_health',
    category: 'STRATEGY',
    titleKey: 'reports.catalog.financial_health.title',
    descKey: 'reports.catalog.financial_health.desc',
    defaultTitle: '360° Financial Health & Resilience Index',
    defaultDesc: 'Composite 0–100 health score evaluating savings velocity, fixed cost load, emergency runway, and debt burden.',
    icon: ShieldCheck,
    badge: 'Scorecard 0-100',
    recommendedOrder: 19,
    isDefault: true,
  },
  {
    id: 'expense_volatility',
    category: 'STRATEGY',
    titleKey: 'reports.catalog.expense_volatility.title',
    descKey: 'reports.catalog.expense_volatility.desc',
    defaultTitle: 'Expense Volatility & Anomaly Spike Detector',
    defaultDesc: 'Detects month-over-month variance anomalies and statistical outlier purchases for financial discipline.',
    icon: Activity,
    badge: 'Anomaly Radar',
    recommendedOrder: 20,
    isDefault: false,
  },
];

export const DEFAULT_SELECTED_REPORTS: string[] = [
  'cash_flow',
  'category_distribution',
  'savings_rate',
  'recurring_overhead',
  'financial_health',
];

export const REPORT_PRESETS = [
  {
    id: 'executive',
    nameEn: 'Executive Essentials',
    nameEs: 'Esenciales Ejecutivos',
    descEn: 'Cash flow, category breakdown, savings rate, subscriptions, and financial health score.',
    descEs: 'Flujo de caja, desglose por categoría, tasa de ahorro, suscripciones y salud financiera.',
    reportIds: ['cash_flow', 'category_distribution', 'savings_rate', 'recurring_overhead', 'financial_health'],
  },
  {
    id: 'cashflow',
    nameEn: 'Cash Flow & Inflows',
    nameEs: 'Flujo de Caja e Ingresos',
    descEn: 'Cash flow, multi-currency flows, income streams, savings velocity, and daily burn rate.',
    descEs: 'Flujo de caja, flujo multidivisa, fuentes de ingreso, velocidad de ahorro y gasto diario.',
    reportIds: ['cash_flow', 'dual_currency', 'income_sources', 'savings_rate', 'daily_burn_rate'],
  },
  {
    id: 'frugal',
    nameEn: 'Frugal & Budgeting',
    nameEs: 'Presupuestos y Ahorro',
    descEn: 'Categories, 50/30/20 rule, budget adherence, spending cadence, and top merchants.',
    descEs: 'Categorías, regla 50/30/20, cumplimiento presupuestario, ritmo semanal y principales comercios.',
    reportIds: ['category_distribution', 'needs_wants', 'budget_adherence', 'spending_cadence', 'top_merchants'],
  },
  {
    id: 'debt_watchdog',
    nameEn: 'Debt & Credit Watchdog',
    nameEs: 'Control de Deudas y Crédito',
    descEn: 'Credit card installments, debt burndown, recurring overhead, anomaly spikes, and health index.',
    descEs: 'Cuotas de tarjetas, desendeudamiento, costos fijos recurrentes, picos atípicos y salud financiera.',
    reportIds: ['cc_installments', 'debt_radar', 'recurring_overhead', 'expense_volatility', 'financial_health'],
  },
  {
    id: 'multi_currency',
    nameEn: 'Multi-Currency & Global FX',
    nameEs: 'Multidivisa y Macro Global',
    descEn: 'Dual currency breakdown, FX exposure, inflation erosion, cash flow, and account liquidity.',
    descEs: 'Desglose multidivisa, exposición cambiaria, impacto inflacionario, flujo y liquidez de cuentas.',
    reportIds: ['dual_currency', 'fx_exposure', 'inflation_impact', 'cash_flow', 'account_liquidity'],
  },
  {
    id: 'strategic',
    nameEn: 'Strategic & Resilience',
    nameEs: 'Estrategia y Resiliencia',
    descEn: '360° health index, quarterly cycles, savings velocity, 50/30/20 rule, and budget variance.',
    descEs: 'Índice de salud 360°, ciclos trimestrales, velocidad de ahorro, regla 50/30/20 y variaciones.',
    reportIds: ['financial_health', 'quarterly_trends', 'savings_rate', 'needs_wants', 'budget_adherence'],
  },
];

const STORAGE_KEY_SELECTED_REPORTS = 'finance_app_selected_reports';
const LEGACY_STORAGE_KEY = 'levlev_selected_reports';

export function getSavedSelectedReports(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_SELECTED_REPORTS];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SELECTED_REPORTS) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Validate against known catalog IDs
        const valid = parsed.filter(id => REPORT_CATALOG.some(r => r.id === id));
        if (valid.length > 0) {
          return valid.slice(0, 5);
        }
      }
    }
  } catch (e) {
    console.warn('Error reading saved selected reports:', e);
  }
  return [...DEFAULT_SELECTED_REPORTS];
}

export function saveSelectedReports(reportIds: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = (reportIds || [])
      .filter(id => REPORT_CATALOG.some(r => r.id === id))
      .slice(0, 5);
    const serialized = JSON.stringify(cleaned.length > 0 ? cleaned : DEFAULT_SELECTED_REPORTS);
    localStorage.setItem(STORAGE_KEY_SELECTED_REPORTS, serialized);
    localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
    window.dispatchEvent(new CustomEvent('finance_app_reports_settings_updated', { detail: cleaned }));
  } catch (e) {
    console.error('Error saving selected reports to localStorage:', e);
  }
}
