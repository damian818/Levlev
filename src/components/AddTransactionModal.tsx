import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, AccountItem, CategoryItem } from '../types';
import { 
  X, 
  CreditCard, 
  ArrowRightLeft, 
  ArrowDownLeft, 
  ArrowUpRight, 
  DollarSign, 
  Calendar, 
  Tag, 
  Wallet, 
  RefreshCw, 
  Check, 
  Sparkles, 
  Layers, 
  Calculator,
  Building2,
  Info
} from 'lucide-react';
import { isCreditCardAccount, getStatementCloseDateForTx, formatCurrency } from '../utils/financeUtils';

export interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (tx: Transaction) => void;
  accountsList?: AccountItem[];
  existingAccounts?: string[];
  existingCategories?: string[];
  initialAccount?: string;
  usdArsRate?: number;
}

const DEFAULT_ACCOUNTS = ['BBVA', 'DollarApp', 'Visa BBVA', 'Master BBVA', 'Visa Santander', 'ICBC/Comafi Visa'];
const DEFAULT_CATEGORIES = [
  'Alimentos y Bebidas', 'Supermercado', 'Transporte', 'Restaurante / Salidas', 
  'Facturas y Servicios', 'Hogar', 'Salud & Farmacia', 'Ropa & Calzado', 
  'Educación', 'Regalos & Gustos', 'Inversiones', 'Sueldo', 'Freelance', 'General'
];

function getTodayStr(): string {
  return new Date().toISOString().substring(0, 10);
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().substring(0, 10);
}

export function AddTransactionModal({ 
  isOpen, 
  onClose, 
  onAddTransaction,
  accountsList,
  existingAccounts = DEFAULT_ACCOUNTS,
  existingCategories = DEFAULT_CATEGORIES,
  initialAccount,
  usdArsRate = 1250
}: AddTransactionModalProps) {
  // Extracted account names list
  const accountNames = useMemo(() => {
    if (accountsList && accountsList.length > 0) {
      return accountsList.map(a => a.name);
    }
    return existingAccounts;
  }, [accountsList, existingAccounts]);

  // Helper to get currency for a given account name
  const lookupAccountCurrency = (accName: string): string => {
    if (accountsList && accountsList.length > 0) {
      const match = accountsList.find(a => a.name.toLowerCase() === accName.toLowerCase());
      if (match?.currency) return match.currency.toUpperCase();
    }
    const lower = accName.toLowerCase();
    if (lower.includes('usd') || lower.includes('dollar') || lower.includes('wise') || lower.includes('payoneer') || lower.includes('usdt')) {
      return 'USD';
    }
    return 'ARS';
  };

  const [type, setType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER' | 'CC_PAYMENT'>('EXPENSE');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Alimentos y Bebidas');
  const [account, setAccount] = useState(initialAccount || accountNames[0] || 'BBVA');
  const [toAccount, setToAccount] = useState(accountNames[1] || 'Visa BBVA');
  
  // Amounts & Currencies
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('ARS');

  // Transfer specific FX state
  const [receiveAmount, setReceiveAmount] = useState('');
  const [customFxRate, setCustomFxRate] = useState<string>('');
  const [fxEditMode, setFxEditMode] = useState<'AUTO' | 'CUSTOM_RATE' | 'CUSTOM_REC_AMT'>('AUTO');

  // Dates & Metadata
  const [date, setDate] = useState(getTodayStr());
  const [statementCloseDate, setStatementCloseDate] = useState('');
  const [installments, setInstallments] = useState('');
  const [description, setDescription] = useState('');
  const [showAdvancedCcFields, setShowAdvancedCcFields] = useState(false);

  // Sync initial account when opened
  useEffect(() => {
    if (isOpen) {
      const defaultAcc = initialAccount || accountNames[0] || 'BBVA';
      setAccount(defaultAcc);
      const accCurr = lookupAccountCurrency(defaultAcc);
      setCurrency(accCurr);

      // Default toAccount to a different account if available
      const altAcc = accountNames.find(a => a !== defaultAcc) || 'Visa BBVA';
      setToAccount(altAcc);
    }
  }, [isOpen, initialAccount, accountNames]);

  // When 'account' changes, auto-update source currency
  const handleAccountChange = (newAcc: string) => {
    setAccount(newAcc);
    const curr = lookupAccountCurrency(newAcc);
    setCurrency(curr);
  };

  // Source and Destination currencies derived
  const sourceCurrency = useMemo(() => lookupAccountCurrency(account), [account, accountsList]);
  const destCurrency = useMemo(() => lookupAccountCurrency(toAccount), [toAccount, accountsList]);

  // Auto calculate transfer FX amounts when parameters change
  useEffect(() => {
    if (type !== 'TRANSFER') return;

    const parsedSent = parseFloat(amount);
    if (isNaN(parsedSent) || parsedSent <= 0) {
      if (fxEditMode === 'AUTO') {
        setReceiveAmount('');
        setCustomFxRate('');
      }
      return;
    }

    if (sourceCurrency === destCurrency) {
      // Same currency transfer 1:1
      setReceiveAmount(amount);
      setCustomFxRate('1.00');
      return;
    }

    // Cross-currency transfer (e.g. ARS <-> USD)
    if (fxEditMode === 'AUTO') {
      if (sourceCurrency === 'ARS' && destCurrency === 'USD') {
        const rec = parsedSent / usdArsRate;
        setReceiveAmount(rec.toFixed(2));
        setCustomFxRate(usdArsRate.toString());
      } else if (sourceCurrency === 'USD' && destCurrency === 'ARS') {
        const rec = parsedSent * usdArsRate;
        setReceiveAmount(rec.toFixed(2));
        setCustomFxRate(usdArsRate.toString());
      } else {
        setReceiveAmount(amount);
        setCustomFxRate('1.00');
      }
    } else if (fxEditMode === 'CUSTOM_RATE') {
      const rate = parseFloat(customFxRate);
      if (!isNaN(rate) && rate > 0) {
        if (sourceCurrency === 'ARS' && destCurrency === 'USD') {
          setReceiveAmount((parsedSent / rate).toFixed(2));
        } else if (sourceCurrency === 'USD' && destCurrency === 'ARS') {
          setReceiveAmount((parsedSent * rate).toFixed(2));
        } else {
          setReceiveAmount((parsedSent * rate).toFixed(2));
        }
      }
    } else if (fxEditMode === 'CUSTOM_REC_AMT') {
      const rec = parseFloat(receiveAmount);
      if (!isNaN(rec) && rec > 0) {
        if (sourceCurrency === 'ARS' && destCurrency === 'USD') {
          setCustomFxRate((parsedSent / rec).toFixed(2));
        } else if (sourceCurrency === 'USD' && destCurrency === 'ARS') {
          setCustomFxRate((rec / parsedSent).toFixed(2));
        } else {
          setCustomFxRate((rec / parsedSent).toFixed(4));
        }
      }
    }
  }, [type, amount, sourceCurrency, destCurrency, usdArsRate, fxEditMode, customFxRate, receiveAmount]);

  if (!isOpen) return null;

  const isCC = isCreditCardAccount(account);

  // Computed effective FX rate for display
  const effectiveFxRateDisplay = (): { text: string; unit: string } => {
    const sent = parseFloat(amount);
    const rec = parseFloat(receiveAmount);
    if (!isNaN(sent) && !isNaN(rec) && sent > 0 && rec > 0) {
      if (sourceCurrency === 'ARS' && destCurrency === 'USD') {
        const rate = sent / rec;
        return { text: `1 USD = ${rate.toLocaleString('en-US', { maximumFractionDigits: 2 })} ARS`, unit: `${rate.toFixed(2)} ARS/USD` };
      } else if (sourceCurrency === 'USD' && destCurrency === 'ARS') {
        const rate = rec / sent;
        return { text: `1 USD = ${rate.toLocaleString('en-US', { maximumFractionDigits: 2 })} ARS`, unit: `${rate.toFixed(2)} ARS/USD` };
      } else {
        const rate = rec / sent;
        return { text: `1 ${sourceCurrency} = ${rate.toFixed(4)} ${destCurrency}`, unit: `${rate.toFixed(4)}` };
      }
    }
    return { text: `1 USD = ${usdArsRate} ARS (Live Rate)`, unit: `${usdArsRate}` };
  };

  const handleApplyLiveFxRate = () => {
    setFxEditMode('AUTO');
    setCustomFxRate(usdArsRate.toString());
    const parsedSent = parseFloat(amount);
    if (!isNaN(parsedSent) && parsedSent > 0) {
      if (sourceCurrency === 'ARS' && destCurrency === 'USD') {
        setReceiveAmount((parsedSent / usdArsRate).toFixed(2));
      } else if (sourceCurrency === 'USD' && destCurrency === 'ARS') {
        setReceiveAmount((parsedSent * usdArsRate).toFixed(2));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    if (type === 'CC_PAYMENT') {
      const paymentTx: Transaction = {
        id: `manual-ccpay-${Date.now()}`,
        date: new Date(date).toISOString(),
        title: title || `Pago ${toAccount}`,
        category: 'Tarjetas de Crédito',
        account: account,
        toAccount: toAccount,
        amount: parsedAmount,
        transferAmount: parsedAmount,
        receiveAmount: parsedAmount,
        currency,
        transferCurrency: currency,
        receiveCurrency: currency,
        type: 'CC_PAYMENT',
        description: description || `Payment to ${toAccount}`,
        statementCloseDate: statementCloseDate || undefined,
      };
      onAddTransaction(paymentTx);
    } else if (type === 'TRANSFER') {
      const parsedReceiveAmt = parseFloat(receiveAmount) || parsedAmount;
      const transferTx: Transaction = {
        id: `manual-transfer-${Date.now()}`,
        date: new Date(date).toISOString(),
        title: title || `Transferencia: ${account} → ${toAccount}`,
        category: category || 'Transferencias',
        account: account,
        toAccount: toAccount,
        amount: parsedAmount,
        currency: sourceCurrency,
        transferAmount: parsedAmount,
        transferCurrency: sourceCurrency,
        receiveAmount: parsedReceiveAmt,
        receiveCurrency: destCurrency,
        type: 'TRANSFER',
        description: description || undefined,
      };
      onAddTransaction(transferTx);
    } else {
      const autoCloseDate = statementCloseDate || (isCC ? getStatementCloseDateForTx(date, 25) : undefined);
      const newTx: Transaction = {
        id: `manual-${Date.now()}`,
        date: new Date(date).toISOString(),
        title: title || (type === 'INCOME' ? 'Income' : 'Expense'),
        category: category || 'General',
        account: account,
        amount: parsedAmount,
        currency,
        type,
        description: description || undefined,
        installments: installments || undefined,
        statementCloseDate: autoCloseDate,
      };
      onAddTransaction(newTx);
    }

    onClose();
    // Reset form
    setTitle('');
    setAmount('');
    setReceiveAmount('');
    setCustomFxRate('');
    setFxEditMode('AUTO');
    setDescription('');
    setInstallments('');
    setStatementCloseDate('');
  };

  // Popular quick categories for fast selection
  const topCategories = ['Alimentos y Bebidas', 'Supermercado', 'Restaurante / Salidas', 'Facturas y Servicios', 'Sueldo'];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#11141c] border border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl my-auto space-y-4 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-xl border ${
              type === 'EXPENSE' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
              type === 'INCOME' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              type === 'TRANSFER' ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' :
              'bg-purple-500/10 border-purple-500/20 text-purple-400'
            }`}>
              {type === 'EXPENSE' && <ArrowDownLeft className="w-5 h-5" />}
              {type === 'INCOME' && <ArrowUpRight className="w-5 h-5" />}
              {type === 'TRANSFER' && <ArrowRightLeft className="w-5 h-5" />}
              {type === 'CC_PAYMENT' && <CreditCard className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {type === 'EXPENSE' && 'Record New Expense'}
                {type === 'INCOME' && 'Record New Income'}
                {type === 'TRANSFER' && 'Account Transfer'}
                {type === 'CC_PAYMENT' && 'Credit Card Payment'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {type === 'TRANSFER' ? 'Transfer funds between accounts with automatic FX conversion' : 'Quick & structured financial tracking'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction Type Pills */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#0a0c10] border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setType('EXPENSE');
              setCategory('Alimentos y Bebidas');
            }}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              type === 'EXPENSE'
                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
            <span>Expense</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setType('INCOME');
              setCategory('Sueldo');
            }}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              type === 'INCOME'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
            <span>Income</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setType('TRANSFER');
              setCategory('Transferencias');
            }}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              type === 'TRANSFER'
                ? 'bg-sky-500/20 border border-sky-500/40 text-sky-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
            <span>Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setType('CC_PAYMENT');
              setCategory('Tarjetas de Crédito');
            }}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              type === 'CC_PAYMENT'
                ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 shrink-0" />
            <span>CC Pay</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Main Amount Input */}
          <div className="p-3.5 bg-[#0a0c10] border border-slate-800/90 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-[11px] font-medium text-slate-400">
              <label>
                {type === 'TRANSFER' ? 'Sent Amount' : 'Amount'}
              </label>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] text-slate-500">Quick Date:</span>
                <button
                  type="button"
                  onClick={() => setDate(getTodayStr())}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    date === getTodayStr() ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDate(getYesterdayStr())}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    date === getYesterdayStr() ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Yesterday
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  {currency === 'USD' ? '$' : 'ARS'}
                </span>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-12 pr-3 py-2.5 bg-[#161b22] border border-slate-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-base font-mono font-bold placeholder-slate-600"
                />
              </div>

              {type !== 'TRANSFER' ? (
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="px-3 py-2.5 bg-[#161b22] border border-slate-700 text-slate-200 font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-xs shrink-0 cursor-pointer"
                >
                  <option value="ARS">ARS 🇦🇷</option>
                  <option value="USD">USD 💵</option>
                  <option value="EUR">EUR 💶</option>
                  <option value="USDT">USDT 🪙</option>
                </select>
              ) : (
                <div className="px-3 py-2.5 bg-[#161b22] border border-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0">
                  <span>{sourceCurrency}</span>
                  <span className="text-[10px] text-slate-500">(From Acc)</span>
                </div>
              )}
            </div>
          </div>

          {/* TRANSFER SPECIFIC FX CONVERSION BLOCK */}
          {type === 'TRANSFER' && (
            <div className="p-3.5 bg-gradient-to-br from-[#0c1322] to-[#111827] border border-sky-500/30 rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4" /> Account Transfer & FX Conversion
                </span>
                <span className="text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded-full font-medium">
                  {sourceCurrency} → {destCurrency}
                </span>
              </div>

              {/* Account selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                    From Account (Outflow)
                  </label>
                  <select
                    value={account}
                    onChange={(e) => handleAccountChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium text-xs"
                  >
                    {accountNames.map((accName) => {
                      const curr = lookupAccountCurrency(accName);
                      return (
                        <option key={accName} value={accName}>
                          {accName} ({curr})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                    To Account (Inflow)
                  </label>
                  <select
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium text-xs"
                  >
                    {accountNames.map((accName) => {
                      const curr = lookupAccountCurrency(accName);
                      return (
                        <option key={accName} value={accName}>
                          {accName} ({curr})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Received Amount & FX Rate Fields */}
              <div className="p-3 bg-[#080b12] border border-slate-800 rounded-xl space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1 text-[10px] flex items-center justify-between">
                      <span>Received Amount ({destCurrency})</span>
                      {sourceCurrency !== destCurrency && (
                        <span className="text-[9px] text-sky-400 font-mono">
                          {destCurrency === 'USD' ? '$' : 'ARS'}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={receiveAmount}
                      onChange={(e) => {
                        setReceiveAmount(e.target.value);
                        setFxEditMode('CUSTOM_REC_AMT');
                      }}
                      className="w-full px-3 py-1.5 bg-[#11141c] border border-slate-700 text-slate-100 font-mono font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1 text-[10px] flex items-center justify-between">
                      <span>Exchange Rate Used</span>
                      <button
                        type="button"
                        onClick={handleApplyLiveFxRate}
                        className="text-[9px] text-amber-400 hover:text-amber-300 underline font-semibold flex items-center gap-0.5"
                        title="Reset to live rate"
                      >
                        <RefreshCw className="w-2.5 h-2.5" /> Live: {usdArsRate}
                      </button>
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder={`e.g. ${usdArsRate}`}
                      value={customFxRate}
                      onChange={(e) => {
                        setCustomFxRate(e.target.value);
                        setFxEditMode('CUSTOM_RATE');
                      }}
                      disabled={sourceCurrency === destCurrency}
                      className="w-full px-3 py-1.5 bg-[#11141c] border border-slate-700 text-amber-300 font-mono font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* FX summary indicator */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 font-mono">
                  <div className="flex items-center gap-1.5 text-sky-300 font-medium">
                    <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Effective Rate: {effectiveFxRateDisplay().text}</span>
                  </div>
                  {sourceCurrency !== destCurrency && (
                    <span className="text-slate-500 text-[9px]">
                      {fxEditMode === 'AUTO' ? 'Auto calculated with live FX' : 'Custom exchange rate override'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Title & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-medium mb-1">
                {type === 'CC_PAYMENT' ? 'Payment Note / Reference' : 'Title / Merchant'}
              </label>
              <input
                type="text"
                required
                placeholder={
                  type === 'CC_PAYMENT' ? 'e.g. Resumen Agosto Visa BBVA' : 
                  type === 'TRANSFER' ? 'e.g. Transferencia ahorro mensual' : 
                  type === 'INCOME' ? 'e.g. Sueldo / Honorarios Freelance' :
                  'e.g. Supermercado Coto, YPF, Uber'
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-500 font-medium text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" /> Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs"
              />
            </div>
          </div>

          {/* Category & Account selection (non-transfer mode) */}
          {type !== 'TRANSFER' && type !== 'CC_PAYMENT' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-500" /> Category
                </label>
                <input
                  type="text"
                  list="categoriesDatalist"
                  placeholder="e.g. Alimentos y Bebidas"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-500 text-xs"
                />
                <datalist id="categoriesDatalist">
                  {existingCategories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>

                {/* Top categories quick chips */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {topCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                        category === cat ? 'bg-slate-700 text-slate-100 font-semibold' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-slate-500" /> Account
                </label>
                <select
                  value={account}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-medium cursor-pointer"
                >
                  {accountNames.map((accName) => {
                    const curr = lookupAccountCurrency(accName);
                    return (
                      <option key={accName} value={accName}>
                        {accName} ({curr})
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Currency auto-synced: <span className="font-semibold text-slate-400">{currency}</span>
                </p>
              </div>
            </div>
          )}

          {/* Credit Card Payment Mode Details */}
          {type === 'CC_PAYMENT' && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/25 rounded-2xl space-y-3">
              <div className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-purple-400" /> Credit Card Settlement Details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1 text-[11px]">
                    Paid From (Bank Account)
                  </label>
                  <select
                    value={account}
                    onChange={(e) => handleAccountChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs font-medium"
                  >
                    {accountNames.map((accName) => (
                      <option key={accName} value={accName}>
                        {accName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1 text-[11px]">
                    Paid To (Credit Card)
                  </label>
                  <select
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs font-medium"
                  >
                    {accountNames.map((accName) => (
                      <option key={accName} value={accName}>
                        {accName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Additional Credit Card Fields / Installments (for Expenses or CC) */}
          {(isCC || type === 'EXPENSE') && (
            <div className="p-3 bg-[#0d1017] border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  💳 Credit Card / Cuotas Fields (Optional)
                </span>
                {isCC && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium">
                    Credit Card
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {type === 'EXPENSE' && (
                  <div>
                    <label className="block text-slate-400 text-[10px] font-medium mb-1">
                      Installments / Cuotas (e.g. 1/6)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1/6 or 3/12"
                      value={installments}
                      onChange={(e) => setInstallments(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#161b22] border border-slate-700 text-slate-200 rounded-lg focus:outline-none text-xs placeholder-slate-600 font-mono"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-slate-400 text-[10px] font-medium mb-1">
                    Statement Closing Date
                  </label>
                  <input
                    type="date"
                    value={statementCloseDate}
                    onChange={(e) => setStatementCloseDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#161b22] border border-slate-700 text-slate-200 rounded-lg focus:outline-none text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Description Notes */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Notes / Description (Optional)
            </label>
            <input
              type="text"
              placeholder="Add optional notes, tags, or invoice info..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-600 text-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-700 rounded-xl font-semibold text-slate-300 bg-[#121620] hover:bg-slate-800 transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2 rounded-xl font-bold text-white shadow-lg transition-all text-xs flex items-center gap-1.5 ${
                type === 'EXPENSE' ? 'bg-rose-600 hover:bg-rose-500 border border-rose-500 shadow-rose-900/20' :
                type === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 shadow-emerald-900/20' :
                type === 'TRANSFER' ? 'bg-sky-600 hover:bg-sky-500 border border-sky-500 shadow-sky-900/20' :
                'bg-purple-600 hover:bg-purple-500 border border-purple-500 shadow-purple-900/20'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {type === 'EXPENSE' && 'Save Expense'}
                {type === 'INCOME' && 'Save Income'}
                {type === 'TRANSFER' && 'Complete Transfer'}
                {type === 'CC_PAYMENT' && 'Record Payment'}
              </span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
