const fs = require('fs');
let code = fs.readFileSync('src/components/OverviewTab.tsx', 'utf8');

code = code.replace(
  '                nonRecurringKeys={nonRecurringKeys}\n                onAddTransaction={onAddTransaction}',
  '                nonRecurringKeys={nonRecurringKeys}\n                accounts={accountList}\n                periodStatusOverrides={periodStatusOverrides}\n                onAddTransaction={onAddTransaction}'
);

fs.writeFileSync('src/components/OverviewTab.tsx', code);
