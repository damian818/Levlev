const fs = require('fs');
let code = fs.readFileSync('src/components/MonthlyHeatmap.tsx', 'utf8');

const targetCode = `          const hasPending = pendingForDay.length > 0;
          const styleClass = getIntensityColor(totalSpent, pendingForDay.length);

          const isInteractive = totalSpent > 0 || totalIncome > 0 || hasPending;`;

const newCode = `          const hasPending = pendingForDay.length > 0;
          const ccEvents = ccEventsMap[dayNum];
          const hasCCEvents = !!ccEvents && (ccEvents.closes.length > 0 || ccEvents.dues.length > 0);
          const styleClass = getIntensityColor(totalSpent, pendingForDay.length);

          const isInteractive = totalSpent > 0 || totalIncome > 0 || hasPending || hasCCEvents;`;

code = code.replace(targetCode, newCode);

const targetSelect = `                  setSelectedDayDetails({
                    day: dayNum,
                    txs: dayData ? dayData.txs : [],
                    totalActualSpent: totalSpent,
                    totalActualIncome: totalIncome,
                    pendingRecurringForDay: pendingForDay,
                    totalPendingExpense: dayPendingExpTotal,
                    totalPendingIncome: dayPendingIncTotal,
                  });`;

const newSelect = `                  setSelectedDayDetails({
                    day: dayNum,
                    txs: dayData ? dayData.txs : [],
                    totalActualSpent: totalSpent,
                    totalActualIncome: totalIncome,
                    pendingRecurringForDay: pendingForDay,
                    totalPendingExpense: dayPendingExpTotal,
                    totalPendingIncome: dayPendingIncTotal,
                    ccEvents: ccEvents,
                  });`;

code = code.replace(targetSelect, newSelect);

fs.writeFileSync('src/components/MonthlyHeatmap.tsx', code);
