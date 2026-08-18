const fs = require('fs');
let code = fs.readFileSync('src/components/MonthlyHeatmap.tsx', 'utf8');

const targetCode = `    totalPendingExpense: number;
    totalPendingIncome: number;
  } | null>(null);`;

const newCode = `    totalPendingExpense: number;
    totalPendingIncome: number;
    ccEvents?: { closes: string[], dues: string[] };
  } | null>(null);`;

code = code.replace(targetCode, newCode);
fs.writeFileSync('src/components/MonthlyHeatmap.tsx', code);
