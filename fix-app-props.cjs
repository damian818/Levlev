const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  '              accounts={accounts}\n              periodStatusOverrides={periodStatusOverrides}\n              currentUserId={authUser?.id}',
  '              currentUserId={authUser?.id}'
);

code = code.replace(
  '              accounts={accounts}\n              periodStatusOverrides={periodStatusOverrides}\n              onUpdateNonRecurringKeys={handleUpdateNonRecurringKeys}',
  '              onUpdateNonRecurringKeys={handleUpdateNonRecurringKeys}'
);

code = code.replace(
  '              accounts={accounts}\n              periodStatusOverrides={periodStatusOverrides}\n              customBalances={customBalances}',
  '              accountList={accounts}\n              periodStatusOverrides={periodStatusOverrides}\n              customBalances={customBalances}'
);

fs.writeFileSync('src/App.tsx', code);
