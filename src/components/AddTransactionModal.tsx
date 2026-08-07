import React, { useState } from 'react';
import { Transaction } from '../types';
import { X, CreditCard, ArrowRightLeft } from 'lucide-react';
import { isCreditCardAccount, getStatementCloseDateForTx } from '../utils/financeUtils';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (tx: Transaction) => void;
  existingAccounts?: string[];
  existingCategories?: string[];
  initialAccount?: string;
}

export function AddTransactionModal({ 
  isOpen, 
  onClose, 
  onAddTransaction,
  existingAccounts = ['BBVA', 'DollarApp', 'Visa BBVA', 'Master BBVA', 'Visa Santander', 'ICBC/Comafi Visa'],
  existingCategories = ['Alimentos y Bebidas', 'Transporte', 'Restaurant', 'Hogar', 'Salud', 'Ropa', 'Facturas y tarifas', 'Educación', 'Regalos', 'Inversiones', 'Sueldo', 'Freelance', 'General'],
  initialAccount
}: AddTransactionModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Alimentos y Bebidas');
  const [account, setAccount] = useState(initialAccount || 'BBVA');
  const [toAccount, setToAccount] = useState('Visa BBVA');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('ARS');
  const [type, setType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER' | 'CC_PAYMENT'>('EXPENSE');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [statementCloseDate, setStatementCloseDate] = useState('');
  const [installments, setInstallments] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const isCC = isCreditCardAccount(account);

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
        account: account, // Outflow account (bank)
        toAccount: toAccount, // Inflow account (credit card)
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
    } else {
      const autoCloseDate = statementCloseDate || (isCC ? getStatementCloseDateForTx(date, 25) : undefined);
      const newTx: Transaction = {
        id: `manual-${Date.now()}`,
        date: new Date(date).toISOString(),
        title: title || (type === 'TRANSFER' ? 'Transfer' : 'Expense'),
        category: category || 'General',
        account: account,
        toAccount: type === 'TRANSFER' ? toAccount : undefined,
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
    setTitle('');
    setAmount('');
    setDescription('');
    setInstallments('');
    setStatementCloseDate('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#161b22] rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-800 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              <CreditCard className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-100">
              {type === 'CC_PAYMENT' ? 'Record Credit Card Payment' : 'Add New Transaction'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Type</label>
              <select
                value={type}
                onChange={(e: any) => {
                  const val = e.target.value;
                  setType(val);
                  if (val === 'CC_PAYMENT') {
                    setCategory('Tarjetas de Crédito');
                  }
                }}
                className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 font-medium"
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
                <option value="TRANSFER">Bank Transfer</option>
                <option value="CC_PAYMENT">💳 Credit Card Payment</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Transaction Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">
              {type === 'CC_PAYMENT' ? 'Payment Reference / Note' : 'Title / Merchant'}
            </label>
            <input
              type="text"
              required
              placeholder={type === 'CC_PAYMENT' ? 'e.g. Resumen Agosto Visa BBVA' : 'e.g. Supermarket Coto'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 font-medium"
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {type === 'CC_PAYMENT' ? (
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-3">
              <div className="text-[11px] font-semibold text-purple-300 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5" /> Credit Card Payment Details
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Paid From (Bank)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BBVA / DollarApp ARS"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Paid To (Credit Card)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Visa BBVA"
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Category</label>
                <input
                  type="text"
                  list="categoriesDatalist"
                  placeholder="e.g. Alimentos y Bebidas"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-500"
                />
                <datalist id="categoriesDatalist">
                  {existingCategories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Account</label>
                <input
                  type="text"
                  list="accountsDatalist"
                  placeholder="e.g. Visa BBVA / Main Account"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-500"
                />
                <datalist id="accountsDatalist">
                  {existingAccounts.map((acc) => (
                    <option key={acc} value={acc} />
                  ))}
                </datalist>
              </div>
            </div>
          )}

          {(isCC || type === 'CC_PAYMENT' || type === 'EXPENSE') && (
            <div className="p-3 bg-[#0d1117] border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  💳 Credit Card / Statement Fields
                </span>
                {isCC && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Credit Card Account</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[10px] font-medium mb-1">Statement Close Date</label>
                  <input
                    type="date"
                    value={statementCloseDate}
                    onChange={(e) => setStatementCloseDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#161b22] border border-slate-700 text-slate-200 rounded-lg focus:outline-none text-xs"
                  />
                  <p className="text-[9px] text-slate-500 mt-0.5">Defaults to 25th of cycle</p>
                </div>
                {type === 'EXPENSE' && (
                  <div>
                    <label className="block text-slate-400 text-[10px] font-medium mb-1">Installments (Cuotas)</label>
                    <input
                      type="text"
                      placeholder="e.g. 1/6 or 3/12"
                      value={installments}
                      onChange={(e) => setInstallments(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#161b22] border border-slate-700 text-slate-200 rounded-lg focus:outline-none text-xs placeholder-slate-600"
                    />
                    <p className="text-[9px] text-slate-500 mt-0.5">Optional cuota progress</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-400 font-medium mb-1">Notes / Description (Optional)</label>
            <input
              type="text"
              placeholder="Additional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-[#0f131a] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-500"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-700 rounded-lg font-medium text-slate-300 bg-[#121620] hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 border border-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-500 shadow-sm"
            >
              {type === 'CC_PAYMENT' ? 'Record Payment' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

