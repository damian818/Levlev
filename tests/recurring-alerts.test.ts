import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectRecurringThresholdAlerts, groupRecurringAlerts } from '../src/utils/financeUtils.ts';

// IdentifiedRecurringItem fixture builder. Amounts double as native and display
// (displayCurrency === item currency), so fraction math is exact.
const TODAY = new Date(2026, 10, 5); // 2026-11-05 local

const occ = (month: string, day: number, amount: number, id?: string) => ({
  id: id ?? `${month}-${day}-${amount}`,
  date: `${month}-${String(day).padStart(2, '0')}`,
  month,
  amount,
  currency: 'USD',
  account: 'Bank',
  title: 'Item',
});

const item = (o: any): any => ({
  id: o.id ?? 'detected-x',
  title: o.title ?? 'Item',
  cleanTitle: o.cleanTitle ?? o.title ?? 'Item',
  category: o.category ?? 'Cat',
  type: o.type ?? 'EXPENSE',
  account: o.account ?? 'Bank',
  currency: 'USD',
  latestAmount: 0,
  avgAmount: 0,
  minAmount: 0,
  maxAmount: 0,
  dayOfMonth: 3,
  occurrencesCount: 0,
  distinctMonthsCount: 0,
  isInstallment: false,
  history: o.history,
  monthlyTrend: o.monthlyTrend,
});

// 3 completed months charged fully on day 3 + current month partial
const trendOf = (entries: [string, number][]) =>
  entries.map(([month, amountDisplay]) => ({ month, amount: amountDisplay, amountDisplay, currency: 'USD', account: 'Bank' }));

test('partial month: charge expected later this month does NOT alert (MTD baseline is zero)', () => {
  // Prior months charge on day 15 only; today is day 5; November has a small
  // unrelated partial charge so the month exists in the trend.
  const history = [
    occ('2026-08', 15, 100), occ('2026-09', 15, 100), occ('2026-10', 15, 100),
    occ('2026-11', 1, 2),
  ];
  const it = item({ history, monthlyTrend: trendOf([['2026-08', 100], ['2026-09', 100], ['2026-10', 100], ['2026-11', 2]]) });
  const alerts = detectRecurringThresholdAlerts([it], {}, 15, { today: TODAY });
  assert.equal(alerts.length, 0);
});

test('partial month: running below baseline is PENDING, never ATTENTION and never favorable', () => {
  // By day 5 prior months had ~60% of the month charged; November only 10 of ~60 expected.
  const mk = (m: string) => [occ(m, 1, 30, `${m}a`), occ(m, 3, 30, `${m}b`), occ(m, 20, 40, `${m}c`)];
  const history = [...mk('2026-08'), ...mk('2026-09'), ...mk('2026-10'), occ('2026-11', 1, 10)];
  const it = item({ history, monthlyTrend: trendOf([['2026-08', 100], ['2026-09', 100], ['2026-10', 100], ['2026-11', 10]]) });
  const [a] = detectRecurringThresholdAlerts([it], {}, 15, { today: TODAY });
  assert.ok(a, 'expected an alert');
  assert.equal(a.severity, 'PENDING');
  assert.equal(a.direction, 'DOWN');
  assert.equal(a.isPartialMonth, true);
  // baseline must be MTD-adjusted: avg by day 5 = 60, not full-month 100
  assert.ok(Math.abs(a.priorAvgAmount - 60) < 1e-9, `baseline ${a.priorAvgAmount}`);
});

test('partial month: overspend early in the month is ATTENTION with MTD baseline', () => {
  const mk = (m: string) => [occ(m, 1, 30, `${m}a`), occ(m, 3, 30, `${m}b`), occ(m, 20, 40, `${m}c`)];
  const history = [...mk('2026-08'), ...mk('2026-09'), ...mk('2026-10'), occ('2026-11', 2, 130)];
  const it = item({ history, monthlyTrend: trendOf([['2026-08', 100], ['2026-09', 100], ['2026-10', 100], ['2026-11', 130]]) });
  const [a] = detectRecurringThresholdAlerts([it], {}, 15, { today: TODAY });
  assert.equal(a.severity, 'ATTENTION');
  assert.equal(a.direction, 'UP');
  assert.ok(Math.abs(a.priorAvgAmount - 60) < 1e-9);
});

test('completed month: expense drop is INFO (favorable), income drop is ATTENTION', () => {
  // Today 2026-11-05 but the item has no November data: latest month is October (completed).
  const history = [occ('2026-08', 3, 100), occ('2026-09', 3, 100), occ('2026-10', 3, 40)];
  const exp = item({ history, monthlyTrend: trendOf([['2026-08', 100], ['2026-09', 100], ['2026-10', 40]]) });
  const inc = item({ ...exp, id: 'inc-1', title: 'Salary', cleanTitle: 'Salary', type: 'INCOME' });
  const [ae] = detectRecurringThresholdAlerts([exp], {}, 15, { today: TODAY });
  assert.equal(ae.severity, 'INFO');
  assert.equal(ae.isPartialMonth, false);
  const [ai] = detectRecurringThresholdAlerts([inc], {}, 15, { today: TODAY });
  assert.equal(ai.severity, 'ATTENTION');
  assert.equal(ai.direction, 'DOWN');
});

test('materiality floor: below floor is WATCH, floor 0 keeps previous behavior', () => {
  const history = [occ('2026-08', 3, 100), occ('2026-09', 3, 100), occ('2026-10', 3, 124)];
  const it = item({ history, monthlyTrend: trendOf([['2026-08', 100], ['2026-09', 100], ['2026-10', 124]]) });
  const [watch] = detectRecurringThresholdAlerts([it], {}, 15, { today: TODAY, minAbsDeviation: 25 });
  assert.equal(watch.severity, 'WATCH');
  const [attn] = detectRecurringThresholdAlerts([it], {}, 15, { today: TODAY, minAbsDeviation: 0 });
  assert.equal(attn.severity, 'ATTENTION');
});

test('nothing is hidden: every triggered alert is returned regardless of severity', () => {
  const history = [occ('2026-08', 3, 100), occ('2026-09', 3, 100), occ('2026-10', 3, 40)];
  const it = item({ history, monthlyTrend: trendOf([['2026-08', 100], ['2026-09', 100], ['2026-10', 40]]) });
  assert.equal(detectRecurringThresholdAlerts([it], {}, 15, { today: TODAY }).length, 1);
  assert.equal(detectRecurringThresholdAlerts([it], {}, 15, { today: TODAY, minAbsDeviation: 10000 }).length, 1);
});

test('sort order: ATTENTION, WATCH, PENDING, INFO; deviation desc within a severity', () => {
  const mk = (id: string, title: string, oct: number, type: 'EXPENSE' | 'INCOME' = 'EXPENSE') => item({
    id, title, cleanTitle: title, type,
    history: [occ('2026-08', 3, 100), occ('2026-09', 3, 100), occ('2026-10', 3, oct)],
    monthlyTrend: trendOf([['2026-08', 100], ['2026-09', 100], ['2026-10', oct]]),
  });
  const items = [
    mk('info', 'InfoItem', 40),                    // INFO (expense down, completed)
    mk('watch', 'WatchItem', 124),                 // WATCH with floor 25
    mk('attn1', 'AttnBig', 300),                   // ATTENTION +200%
    mk('attn2', 'AttnSmall', 150),                 // ATTENTION +50%
    mk('inc', 'IncomeItem', 30, 'INCOME'),         // ATTENTION (income down) -70%
  ];
  const alerts = detectRecurringThresholdAlerts(items, {}, 15, { today: TODAY, minAbsDeviation: 25 });
  assert.deepEqual(alerts.map(a => a.id), ['attn1', 'inc', 'attn2', 'watch', 'info']);
});

test('grouping by clean title keeps every variant with its own numbers (no netting)', () => {
  const up = item({ id: 'a', title: 'YPF', cleanTitle: 'YPF', account: 'Visa BBVA', type: 'EXPENSE',
    history: [occ('2026-08', 3, 100), occ('2026-09', 3, 100), occ('2026-10', 3, 200)],
    monthlyTrend: trendOf([['2026-08', 100], ['2026-09', 100], ['2026-10', 200]]) });
  const down = item({ id: 'b', title: 'YPF', cleanTitle: 'Ypf', account: 'Efectivo', type: 'EXPENSE',
    history: [occ('2026-08', 3, 100), occ('2026-09', 3, 100), occ('2026-10', 3, 30)],
    monthlyTrend: trendOf([['2026-08', 100], ['2026-09', 100], ['2026-10', 30]]) });
  const alerts = detectRecurringThresholdAlerts([up, down], {}, 15, { today: TODAY });
  assert.equal(alerts.length, 2);
  const groups = groupRecurringAlerts(alerts);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].variants.length, 2);
  // opposite signals are preserved, not netted
  assert.deepEqual(groups[0].variants.map(v => v.direction).sort(), ['DOWN', 'UP']);
  assert.ok(groups[0].variants.every(v => v.account));
});


test('MTD coherence: latest is the month-to-date SUM, baseline is the sum of prior MTD fractions (same units)', () => {
  // Two November charges (60 + 70 = 130) must compare against the SUM of what
  // prior months had charged by day 5 (30 + 30 = 60 per month), never against
  // a single unit amount and never against full-month totals.
  const mk = (m: string) => [occ(m, 1, 30, `${m}a`), occ(m, 3, 30, `${m}b`), occ(m, 20, 40, `${m}c`)];
  const history = [...mk('2026-08'), ...mk('2026-09'), ...mk('2026-10'), occ('2026-11', 2, 60, 'n1'), occ('2026-11', 4, 70, 'n2')];
  const it = item({ history, monthlyTrend: trendOf([['2026-08', 100], ['2026-09', 100], ['2026-10', 100], ['2026-11', 130]]) });
  const [a] = detectRecurringThresholdAlerts([it], {}, 15, { today: TODAY });
  assert.equal(a.latestAmount, 130);
  assert.ok(Math.abs(a.priorAvgAmount - 60) < 1e-9, `baseline ${a.priorAvgAmount}`);
  assert.ok(Math.abs(a.deviationPercent - ((70 / 60) * 100)) < 1e-9);
});

(globalThis as any).localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { resources } = await import('../src/i18n.ts');
const en: any = resources.en.translation, es: any = resources.es.translation;

test('alerts i18n: same keys ES/EN, same placeholders, non-empty, real translations', () => {
  const keys = Object.keys(en.alerts).sort();
  assert.deepEqual(Object.keys(es.alerts).sort(), keys);
  const ph = (s: string) => (s.match(/{{\w+}}/g) || []).sort().join(',');
  for (const k of keys) {
    assert.ok(en.alerts[k] && es.alerts[k], `alerts.${k} empty`);
    assert.equal(ph(en.alerts[k]), ph(es.alerts[k]), `alerts.${k} placeholders differ`);
  }
  for (const k of ['section_attention', 'section_watch', 'section_pending', 'section_info', 'pending_note', 'mtd_note', 'floor_label', 'go_recurring', 'search_transactions', 'info_toggle_show']) {
    assert.notEqual(en.alerts[k], es.alerts[k], `alerts.${k} identical in EN and ES`);
  }
});

test('every t("alerts.*") used in components exists in both languages', () => {
  const files = ['AlertDetailModals', 'OverviewTab', 'RecurringTab'].map(f => readFileSync(`src/components/${f}.tsx`, 'utf8')).join('\n');
  const used = new Set<string>();
  for (const m of files.matchAll(/t\(\s*['"`](alerts\.[\w$]+)['"`]/g)) used.add(m[1]);
  for (const sev of ['attention', 'watch', 'pending', 'info']) used.add(`alerts.section_${sev}`); // dynamic template keys
  assert.ok(used.size >= 15, `only ${used.size} alerts keys found`);
  for (const k of used) {
    const key = k.split('.')[1];
    assert.ok(en.alerts[key], `missing EN ${k}`);
    assert.ok(es.alerts[key], `missing ES ${k}`);
  }
});

test('reworked modal has no leftover hardcoded user-visible sentences', () => {
  const f = readFileSync('src/components/AlertDetailModals.tsx', 'utf8');
  const modal = f.slice(f.indexOf('export function RecurringDeviationModal'));
  for (const s of ['Latest Charge', 'Historical Avg', 'Search Transactions', 'Manage in Recurring', 'Go to Recurring', 'vs avg (limit', 'Variance</span>', 'Charges that exceeded']) {
    assert.ok(!modal.includes(`>${s}<`) && !modal.includes(`'${s}'`) && !modal.includes(`"${s}"`), `hardcoded: ${s}`);
  }
});
