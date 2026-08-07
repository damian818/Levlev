import jsPDF from 'jspdf';
import { Transaction, DisplayCurrency } from '../types';
import { analyzeSpending, formatCurrency, computeAccountBalances, computePredictiveTrend } from './financeUtils';

export function generateMonthlyPdfReport({
  selectedMonth,
  transactions,
  displayCurrency,
  usdArsRate,
}: {
  selectedMonth: string;
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const monthLabel = selectedMonth === 'ALL' ? 'All Time Aggregate' : selectedMonth;
  const currentDateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const spending = analyzeSpending(transactions, displayCurrency, usdArsRate, selectedMonth);
  const accountBalances = computeAccountBalances(transactions, usdArsRate);
  const { metrics } = computePredictiveTrend(transactions, displayCurrency, usdArsRate);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // --- Header Banner ---
  doc.setFillColor(22, 27, 34); // #161b22
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Emerald Top Accent Line
  doc.setFillColor(16, 185, 129); // #10b981
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('FINANCIAL SUMMARY REPORT', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(156, 163, 175); // gray-400
  doc.text(`Billing Period: ${monthLabel}   |   Generated: ${currentDateStr}   |   Currency: ${displayCurrency}`, 14, 26);

  y = 48;

  // --- Section 1: Key Performance Metrics ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(31, 41, 55);
  doc.text('1. Executive Financial Overview', 14, y);
  y += 6;

  // Draw KPI Boxes (4 boxes side-by-side)
  const boxWidth = (pageWidth - 28 - 9) / 4; // 14mm margins, 3mm spacing
  const boxHeight = 22;
  const kpis = [
    {
      label: 'Total Income',
      value: formatCurrency(spending.totalIncome, displayCurrency),
      color: [16, 185, 129], // Emerald
      bg: [236, 253, 245],
    },
    {
      label: 'Total Expenses',
      value: formatCurrency(spending.totalExpenses, displayCurrency),
      color: [239, 68, 68], // Red
      bg: [254, 242, 242],
    },
    {
      label: 'Net Savings',
      value: formatCurrency(spending.netSavings, displayCurrency),
      color: spending.netSavings >= 0 ? [16, 185, 129] : [239, 68, 68],
      bg: spending.netSavings >= 0 ? [236, 253, 245] : [254, 242, 242],
    },
    {
      label: 'Savings Rate',
      value: `${spending.savingsRate.toFixed(1)}%`,
      color: spending.savingsRate >= 20 ? [16, 185, 129] : spending.savingsRate >= 0 ? [245, 158, 11] : [239, 68, 68],
      bg: spending.savingsRate >= 20 ? [236, 253, 245] : [254, 242, 242],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (boxWidth + 3);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label.toUpperCase(), x + 4, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, x + 4, y + 16);
  });

  y += boxHeight + 12;

  // --- Section 2: Category Breakdown Table ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(31, 41, 55);
  doc.text('2. Top Expense Categories', 14, y);
  y += 6;

  // Table Header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(14, y, pageWidth - 28, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  doc.text('Category', 18, y + 5.5);
  doc.text('Amount Spent', 120, y + 5.5, { align: 'right' });
  doc.text('% of Expenses', 180, y + 5.5, { align: 'right' });
  y += 8;

  const topCats = spending.topCategories;
  if (topCats.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('No expense records found for this period.', 18, y + 6);
    y += 10;
  } else {
    topCats.slice(0, 8).forEach((cat, idx) => {
      const pct = spending.totalExpenses > 0 ? (cat.amount / spending.totalExpenses) * 100 : 0;

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y, pageWidth - 28, 7, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(cat.category, 18, y + 5);
      doc.text(formatCurrency(cat.amount, displayCurrency), 120, y + 5, { align: 'right' });
      doc.text(`${pct.toFixed(1)}%`, 180, y + 5, { align: 'right' });

      y += 7;
    });
  }

  y += 8;

  // --- Section 3: Account Balances Snapshot ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(31, 41, 55);
  doc.text('3. Account Balances Snapshot', 14, y);
  y += 6;

  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pageWidth - 28, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  doc.text('Account Name', 18, y + 5.5);
  doc.text('Original Currency', 110, y + 5.5);
  doc.text('Converted Balance', 180, y + 5.5, { align: 'right' });
  y += 8;

  if (accountBalances.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('No accounts found.', 18, y + 6);
    y += 10;
  } else {
    accountBalances.slice(0, 6).forEach((acc, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y, pageWidth - 28, 7, 'F');
      }

      const balanceConverted = displayCurrency === 'USD' ? acc.balanceUSD : acc.balanceARS;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(acc.accountName, 18, y + 5);
      doc.text(`${acc.balanceOriginal.toLocaleString()} ${acc.originalCurrency}`, 110, y + 5);
      doc.text(formatCurrency(balanceConverted, displayCurrency), 180, y + 5, { align: 'right' });

      y += 7;
    });
  }

  y += 8;

  // --- Section 4: Projections & Daily Velocity ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(31, 41, 55);
  doc.text('4. Pace & Predictive Run-rate', 14, y);
  y += 6;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const dailyVelocityStr = formatCurrency(metrics.dailyExpenseVelocity, displayCurrency);
  const projectedMonthStr = formatCurrency(metrics.projectedEOMExpense, displayCurrency);
  const remainingDays = metrics.daysRemaining;

  doc.text(`• Current Daily Spend Velocity: `, 18, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${dailyVelocityStr} / day`, 72, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`• Days Remaining in Period: `, 18, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${remainingDays} days`, 65, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`• Month-End Projected Expenses: `, 18, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  doc.text(`${projectedMonthStr}`, 75, y + 19);

  // --- Footer ---
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(226, 232, 240);
  doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Personal Finance Tracker — Automated Record Keeping', 14, pageHeight - 8);
  doc.text(`Page 1 of 1`, pageWidth - 14, pageHeight - 8, { align: 'right' });

  // Save the PDF file
  const fileName = `Financial_Report_${monthLabel.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
