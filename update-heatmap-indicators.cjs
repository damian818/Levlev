const fs = require('fs');
let code = fs.readFileSync('src/components/MonthlyHeatmap.tsx', 'utf8');

const targetCode = `                  {totalSpent > 0 && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 shrink-0" />}
                  {totalIncome > 0 && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 shrink-0" />}`;

const newCode = `                  {ccEvents?.closes.length > 0 && (
                    <span 
                      className="px-1 py-0.5 text-[8px] xs:text-[9px] font-bold rounded flex items-center gap-0.5 shrink-0 bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/40"
                      title={\`Statement Closes: \${ccEvents.closes.join(', ')}\`}
                    >
                      <CreditCard className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" />
                      <span>C</span>
                    </span>
                  )}
                  {ccEvents?.dues.length > 0 && (
                    <span 
                      className="px-1 py-0.5 text-[8px] xs:text-[9px] font-bold rounded flex items-center gap-0.5 shrink-0 bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40"
                      title={\`Payment Due: \${ccEvents.dues.join(', ')}\`}
                    >
                      <Zap className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" />
                      <span>D</span>
                    </span>
                  )}
                  {totalSpent > 0 && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 shrink-0" />}
                  {totalIncome > 0 && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 shrink-0" />}`;

code = code.replace(targetCode, newCode);
fs.writeFileSync('src/components/MonthlyHeatmap.tsx', code);
