const fs = require('fs');
let code = fs.readFileSync('src/components/MonthlyHeatmap.tsx', 'utf8');

const ccMapCode = `
  // Compute credit card events
  const ccEventsMap: Record<number, { closes: string[], dues: string[] }> = {};
  const ccAccounts = accounts.filter(acc => isCreditCardAccount(acc.name, accounts));
  ccAccounts.forEach(acc => {
    const statements = getCreditCardStatements(transactions, acc.name, acc.closingRule, periodStatusOverrides);
    statements.forEach(stmt => {
      if (stmt.closeDate.startsWith(activeMonth)) {
        const day = parseInt(stmt.closeDate.substring(8, 10), 10);
        if (!ccEventsMap[day]) ccEventsMap[day] = { closes: [], dues: [] };
        if (!ccEventsMap[day].closes.includes(acc.name)) ccEventsMap[day].closes.push(acc.name);
      }
      if (stmt.dueDate && stmt.dueDate.startsWith(activeMonth)) {
        const day = parseInt(stmt.dueDate.substring(8, 10), 10);
        if (!ccEventsMap[day]) ccEventsMap[day] = { closes: [], dues: [] };
        if (!ccEventsMap[day].dues.includes(acc.name)) ccEventsMap[day].dues.push(acc.name);
      }
    });
  });
`;

code = code.replace(
  'const dailyMap: Record<number, { totalSpent: number; totalIncome: number; txs: Transaction[] }> = {};',
  ccMapCode + '\n  const dailyMap: Record<number, { totalSpent: number; totalIncome: number; txs: Transaction[] }> = {};'
);

fs.writeFileSync('src/components/MonthlyHeatmap.tsx', code);
