const fs = require('fs');
let code = fs.readFileSync('src/components/MonthlyHeatmap.tsx', 'utf8');

const targetCode = `            {/* Estimated Pending Recurring Section */}`;

const newCode = `            {/* Credit Card Events Section */}
            {selectedDayDetails.ccEvents && (selectedDayDetails.ccEvents.closes.length > 0 || selectedDayDetails.ccEvents.dues.length > 0) && (
              <div className="space-y-2.5">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Credit Card Events</span>
                </h5>
                <div className="space-y-2">
                  {selectedDayDetails.ccEvents.closes.length > 0 && (
                    <div className="flex items-center justify-between p-2.5 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/40 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Statement Closes</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{selectedDayDetails.ccEvents.closes.join(', ')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedDayDetails.ccEvents.dues.length > 0 && (
                    <div className="flex items-center justify-between p-2.5 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/40 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Payment Due</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{selectedDayDetails.ccEvents.dues.join(', ')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Estimated Pending Recurring Section */}`;

code = code.replace(targetCode, newCode);
fs.writeFileSync('src/components/MonthlyHeatmap.tsx', code);
