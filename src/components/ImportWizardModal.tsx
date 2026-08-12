import React, { useState } from 'react';
import { Upload, X, Download, AlertCircle, CheckCircle, FileText, ChevronRight, Sparkles } from 'lucide-react';
import Papa from 'papaparse';
import { Transaction, AccountItem, CategoryItem, BudgetGoal } from '../types';

interface ImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: { transactions: Transaction[]; categories: CategoryItem[]; accounts: AccountItem[]; budgets: BudgetGoal[] }) => void;
  existingAccounts: AccountItem[];
  existingCategories: CategoryItem[];
}

interface ParsedData {
  transactions: Transaction[];
  categories: CategoryItem[];
  accounts: AccountItem[];
  budgets: BudgetGoal[];
}

interface ValidationError {
  row: number;
  message: string;
  type: 'error' | 'warning';
}

export default function ImportWizardModal({ isOpen, onClose, onImport, existingAccounts, existingCategories }: ImportWizardModalProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [rawData, setRawData] = useState<any[]>([]);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csvContent = "date,title,category,account,amount,currency,type,description,installments,toAccount,receiveAmount,receiveCurrency\n2026-08-10,Groceries,Food,Debit Card,150.50,USD,EXPENSE,Walmart,,,\n2026-08-11,Salary,Income,Bank Account,2000,USD,INCOME,August Salary,,,\n2026-08-12,Transfer to Savings,,Checking Account,500,USD,TRANSFER,,Savings Account,500,USD";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "levlev_transactions_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleIvyWalletChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      
      let content = '';
      // Detect encoding
      if (uint8[0] === 0xFF && uint8[1] === 0xFE) {
        const decoder = new TextDecoder('utf-16le');
        content = decoder.decode(buffer);
      } else if (uint8[0] === 0xFE && uint8[1] === 0xFF) {
        const decoder = new TextDecoder('utf-16be');
        content = decoder.decode(buffer);
      } else {
        const decoder = new TextDecoder('utf-8');
        content = decoder.decode(buffer);
      }

      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (results) => {
          const errors: ValidationError[] = [];
          const txs: Transaction[] = [];

          results.data.forEach((row: any, idx: number) => {
            if (!row.Date || (!row.Account && !row.Title)) return;

            const cleanAmount = (val: string) => {
               if (!val) return 0;
               // Remove thousands separators (commas) and parse
               const sanitized = String(val).replace(/"/g, '').replace(/,/g, '');
               return parseFloat(sanitized) || 0;
            };

            const type = (row.Type || 'EXPENSE').toUpperCase();
            let amount = cleanAmount(row.Amount);
            const transferAmount = cleanAmount(row['Transfer Amount']);
            const receiveAmount = cleanAmount(row['Receive Amount']);

            // Ivy specific: Transfers often have 0 amount but set Transfer Amount
            if (type === 'TRANSFER' && amount === 0 && transferAmount !== 0) {
              amount = transferAmount;
            }

            const desc = row.Description || '';
            let installments = '';
            let installmentNumber: number | undefined;
            let totalInstallments: number | undefined;
            let installmentStartDate: string | undefined;
            let installmentEndDate: string | undefined;

            // Ivy specific: "x/total" pattern in description for installments
            const instMatch = desc.trim().match(/^(\d+)\/(\d+)$/);
            if (instMatch) {
              installments = desc.trim();
              installmentNumber = parseInt(instMatch[1], 10);
              totalInstallments = parseInt(instMatch[2], 10);

              const txDate = row.Date ? new Date(row.Date) : new Date();
              if (!isNaN(txDate.getTime())) {
                // Derive Start Date
                const startDt = new Date(txDate.getFullYear(), txDate.getMonth() - (installmentNumber - 1), 1);
                const startY = startDt.getFullYear();
                const startM = String(startDt.getMonth() + 1).padStart(2, '0');
                installmentStartDate = `${startY}-${startM}`;

                // Derive End Date
                const endDt = new Date(txDate.getFullYear(), txDate.getMonth() + (totalInstallments - installmentNumber), 1);
                const endY = endDt.getFullYear();
                const endM = String(endDt.getMonth() + 1).padStart(2, '0');
                installmentEndDate = `${endY}-${endM}`;
              }
            }

            txs.push({
              id: row.ID || `tx-ivy-${Date.now()}-${idx}`,
              date: (row.Date || '').substring(0, 10),
              title: row.Title || 'Untitled',
              category: row.Category || 'Uncategorized',
              account: row.Account || 'Main',
              amount: Math.abs(amount),
              currency: row.Currency || 'ARS',
              type: type as any,
              description: installments ? '' : desc,
              installments: installments,
              installmentNumber,
              totalInstallments,
              installmentStartDate,
              installmentEndDate,
              toAccount: row['To Account'] || undefined,
              receiveAmount: receiveAmount || undefined,
              receiveCurrency: row['Receive Currency'] || undefined,
              dueDate: row['Due Date'] || undefined,
            });
          });

          setParsedData({ transactions: txs, categories: [], accounts: [], budgets: [] });
          setValidationErrors(errors);
          setStep('preview');
          setIsLoading(false);
        },
        error: (err) => {
          setValidationErrors([{ row: 0, message: `Ivy Wallet Parse Error: ${err.message}`, type: 'error' }]);
          setStep('preview');
          setIsLoading(false);
        }
      });
    } catch (err: any) {
      setValidationErrors([{ row: 0, message: `File read error: ${err.message}`, type: 'error' }]);
      setStep('preview');
      setIsLoading(false);
    }
    e.target.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      if (fileExtension === 'json') {
        parseJson(content);
      } else if (fileExtension === 'csv') {
        parseCsv(content);
      } else {
        setValidationErrors([{ row: 0, message: 'Unsupported file format. Please upload a .csv or .json file.', type: 'error' }]);
        setStep('preview');
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const parseJson = (content: string) => {
    try {
      const json = JSON.parse(content);
      const errors: ValidationError[] = [];
      
      if (!json || (!json.transactions && !json.accounts && !json.categories)) {
         errors.push({ row: 0, message: 'JSON file does not contain recognized backup data.', type: 'error' });
      }

      const txs: Transaction[] = Array.isArray(json.transactions) ? json.transactions : [];
      
      // Simple validation for JSON transactions
      txs.forEach((tx, idx) => {
         if (!tx.date || !tx.amount || !tx.account) {
            errors.push({ row: idx + 1, message: `Transaction missing required fields (date, amount, account). ID: ${tx.id || 'unknown'}`, type: 'error' });
         }
      });

      setParsedData({
        transactions: txs,
        categories: Array.isArray(json.categories) ? json.categories : [],
        accounts: Array.isArray(json.accounts) ? json.accounts : [],
        budgets: Array.isArray(json.budgets) ? json.budgets : [],
      });
      setValidationErrors(errors);
      setStep('preview');
    } catch (err) {
      setValidationErrors([{ row: 0, message: 'Failed to parse JSON file. Ensure it is a valid backup.', type: 'error' }]);
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  const parseCsv = (content: string) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        setCsvHeaders(results.meta.fields || []);
        setRawData(results.data);
        setStep('mapping');
        setIsLoading(false);
      },
      error: (error) => {
        setValidationErrors([{ row: 0, message: `CSV Parsing error: ${error.message}`, type: 'error' }]);
        setStep('preview');
        setIsLoading(false);
      }
    });
  };

  const handleConfirmImport = () => {
    if (!parsedData) return;
    onImport(parsedData);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setStep('upload');
    setParsedData(null);
    setValidationErrors([]);
    setColumnMapping({});
    setCsvHeaders([]);
    setRawData([]);
  };

  const fields = [
    { id: 'date', label: 'Date', required: true },
    { id: 'title', label: 'Title', required: true },
    { id: 'category', label: 'Category' },
    { id: 'account', label: 'Account', required: true },
    { id: 'amount', label: 'Amount', required: true },
    { id: 'currency', label: 'Currency' },
    { id: 'type', label: 'Type' },
    { id: 'description', label: 'Description' },
    { id: 'installments', label: 'Installments' },
    { id: 'toAccount', label: 'To Account' },
    { id: 'receiveAmount', label: 'Receive Amount' },
    { id: 'receiveCurrency', label: 'Receive Currency' },
  ];

  const handleMappingConfirm = () => {
    const errors: ValidationError[] = [];
    const txs: Transaction[] = [];

    rawData.forEach((row: any, index: number) => {
      const rowNum = index + 1;
      
      const mappedRow: any = {};
      fields.forEach(field => {
        const csvCol = columnMapping[field.id];
        if (csvCol) mappedRow[field.id] = row[csvCol];
      });

      if (!mappedRow.date || !mappedRow.title || !mappedRow.amount || !mappedRow.account) {
        errors.push({ row: rowNum, message: 'Missing required fields (date, title, amount, account) based on mapping.', type: 'error' });
        return;
      }

      let amount = parseFloat(mappedRow.amount);
      if (isNaN(amount)) {
        errors.push({ row: rowNum, message: `Invalid amount format: ${mappedRow.amount}`, type: 'error' });
        return;
      }

      let type = mappedRow.type?.toUpperCase();
      if (type !== 'EXPENSE' && type !== 'INCOME' && type !== 'TRANSFER' && type !== 'CC_PAYMENT') { 
         type = amount < 0 ? 'EXPENSE' : 'INCOME';
         amount = Math.abs(amount);
         errors.push({ row: rowNum, message: `Invalid type '${mappedRow.type}'. Auto-inferred as ${type} based on amount.`, type: 'warning' });
      }

      const currency = mappedRow.currency?.toUpperCase() || 'ARS';
      
      // Check if account exists
      if (!existingAccounts.find(a => a.name.toLowerCase() === mappedRow.account.toLowerCase())) {
         errors.push({ row: rowNum, message: `Account '${mappedRow.account}' does not exist. It will be created.`, type: 'warning' });
      }

      let toAccount = mappedRow.toAccount;
      let receiveAmount = mappedRow.receiveAmount ? parseFloat(mappedRow.receiveAmount) : undefined;
      let receiveCurrency = mappedRow.receiveCurrency?.toUpperCase();

      if (type === 'TRANSFER' && !toAccount) {
        errors.push({ row: rowNum, message: `Type is TRANSFER but toAccount is missing.`, type: 'error' });
        return;
      }

      if (toAccount && !existingAccounts.find(a => a.name.toLowerCase() === toAccount.toLowerCase())) {
         errors.push({ row: rowNum, message: `Target account '${toAccount}' does not exist. It will be created.`, type: 'warning' });
      }

      txs.push({
        id: mappedRow.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2)}`,
        date: mappedRow.date,
        title: mappedRow.title,
        category: mappedRow.category || 'Uncategorized',
        account: mappedRow.account,
        amount: amount,
        currency: currency === 'USD' ? 'USD' : 'ARS',
        type: type as 'EXPENSE'|'INCOME'|'TRANSFER'|'CC_PAYMENT',
        description: mappedRow.description || '',
        installments: mappedRow.installments || '',
        toAccount: toAccount,
        receiveAmount: receiveAmount,
        receiveCurrency: receiveCurrency === 'USD' ? 'USD' : (receiveCurrency === 'ARS' ? 'ARS' : undefined),
      });
    });

    setParsedData({ transactions: txs, categories: [], accounts: [], budgets: [] });
    setValidationErrors(errors);
    setStep('preview');
  };

  const hasErrors = validationErrors.some(e => e.type === 'error');
  const hasWarnings = validationErrors.some(e => e.type === 'warning');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f131a] w-full max-w-4xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-[#161b22]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Import Data</h2>
              <p className="text-xs text-slate-400">Upload CSV transactions or JSON backup</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#121620] border border-slate-800 rounded-xl p-5 hover:border-emerald-500/30 transition-colors">
                  <h3 className="font-bold text-slate-200 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    CSV Transactions
                  </h3>
                  <p className="text-xs text-slate-400 mb-4 h-12">
                    Import transactions from a spreadsheet. Manual column mapping required.
                  </p>
                  <button onClick={handleDownloadTemplate} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                    <Download className="w-3 h-3" />
                    Download Template
                  </button>
                </div>

                <div className="bg-[#121620] border border-slate-800 rounded-xl p-5 border-purple-500/30 hover:bg-purple-500/5 transition-colors">
                  <h3 className="font-bold text-slate-200 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Ivy Wallet
                  </h3>
                  <p className="text-xs text-slate-400 mb-4 h-12">
                    Direct import from Ivy Wallet CSV export. All fields mapped automatically.
                  </p>
                  <label className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm shadow-purple-900/20 uppercase tracking-wider">
                    <Upload className="w-3 h-3" />
                    Select Ivy Export
                    <input type="file" accept=".csv" onChange={handleIvyWalletChange} className="hidden" />
                  </label>
                </div>
                
                <div className="bg-[#121620] border border-slate-800 rounded-xl p-5 hover:border-emerald-500/30 transition-colors">
                  <h3 className="font-bold text-slate-200 mb-2 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    JSON Backup
                  </h3>
                  <p className="text-xs text-slate-400 mb-4 h-12">
                    Restore a complete backup including accounts, categories, budgets, and transactions.
                  </p>
                  <div className="text-[10px] text-slate-500 flex items-center gap-2 h-8 font-medium">
                     Settings {'>'} Export JSON
                  </div>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-700 rounded-xl p-10 flex flex-col items-center justify-center bg-[#121620] hover:bg-slate-800/50 transition-colors">
                <Upload className="w-10 h-10 text-slate-500 mb-4" />
                <h3 className="text-slate-300 font-bold mb-1">Upload File</h3>
                <p className="text-slate-500 text-xs mb-6">Select a .csv or .json file to begin</p>
                
                <label className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer">
                  {isLoading ? 'Processing...' : 'Select File'}
                  <input type="file" accept=".csv,.json" onChange={handleFileChange} className="hidden" disabled={isLoading} />
                </label>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-200">Map Columns</h3>
              <p className="text-xs text-slate-400">Map your CSV columns to the required LevLev fields.</p>
              <div className="grid grid-cols-2 gap-4">
                {fields.map(field => (
                  <div key={field.id} className="flex flex-col gap-1">
                    <label className="text-xs text-slate-300">
                      {field.label} {field.required && <span className="text-rose-500">*</span>}
                    </label>
                    <select
                      value={columnMapping[field.id] || ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field.id]: e.target.value })}
                      className="bg-[#121620] border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                    >
                      <option value="">Select column...</option>
                      {csvHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              
              <div className="flex items-center gap-4 p-4 bg-[#121620] border border-slate-800 rounded-xl">
                <div className="flex-1 flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-100">{parsedData?.transactions?.length || 0}</p>
                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Transactions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-100">{parsedData?.accounts?.length || 0}</p>
                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Accounts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-100">{parsedData?.categories?.length || 0}</p>
                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Categories</p>
                  </div>
                </div>

                <div className="text-right border-l border-slate-700 pl-4">
                   {hasErrors ? (
                      <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                         <AlertCircle className="w-5 h-5" />
                         Found Errors
                      </div>
                   ) : hasWarnings ? (
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                         <AlertCircle className="w-5 h-5" />
                         Found Warnings
                      </div>
                   ) : (
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                         <CheckCircle className="w-5 h-5" />
                         Ready to Import
                      </div>
                   )}
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-[#121620] border border-slate-800 rounded-xl overflow-hidden">
                  <div className="bg-slate-800/50 p-3 border-b border-slate-800">
                    <h3 className="text-sm font-bold text-slate-200">Validation Feedback</h3>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-2">
                    {validationErrors.map((err, idx) => (
                      <div key={idx} className={`p-2 mb-2 rounded flex gap-3 text-xs ${err.type === 'error' ? 'bg-rose-950/30 text-rose-300' : 'bg-amber-950/30 text-amber-300'}`}>
                        {err.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                        <div>
                          <span className="font-bold">Row {err.row}:</span> {err.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {parsedData && parsedData.transactions.length > 0 && !hasErrors && (
                <div className="bg-[#121620] border border-slate-800 rounded-xl overflow-hidden">
                   <div className="bg-slate-800/50 p-3 border-b border-slate-800">
                    <h3 className="text-sm font-bold text-slate-200">Transactions Preview (First 5)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                       <thead className="bg-[#161b22] text-slate-400">
                          <tr>
                             <th className="p-2">Date</th>
                             <th className="p-2">Title</th>
                             <th className="p-2">Account</th>
                             <th className="p-2 text-right">Amount</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-800 text-slate-300">
                          {parsedData.transactions.slice(0, 5).map(tx => (
                             <tr key={tx.id}>
                                <td className="p-2">{tx.date}</td>
                                <td className="p-2 font-medium">{tx.title}</td>
                                <td className="p-2">{tx.account}</td>
                                <td className="p-2 text-right font-mono">{tx.currency} {tx.amount.toLocaleString()}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-[#161b22] flex justify-end gap-3">
          {step === 'preview' ? (
            <>
              <button onClick={handleReset} className="px-4 py-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={hasErrors}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2 ${
                  hasErrors ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                }`}
              >
                Confirm Import
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : step === 'mapping' ? (
            <>
              <button onClick={handleReset} className="px-4 py-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={handleMappingConfirm} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95">
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            </>
          ) : (
            <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors">
              Close
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
