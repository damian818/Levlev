import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, AccountItem, CategoryItem } from '../types';
import { 
  X, 
  CreditCard, 
  ArrowRightLeft, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Calendar, 
  Tag, 
  Wallet, 
  RefreshCw, 
  Check, 
  Sparkles, 
  Plus,
  Clock,
  Layers
} from 'lucide-react';
import { 
  isCreditCardAccount, 
  getStatementCloseDateForTx, 
  getUpcomingStatementCloseDates,
  getCloseDateForMonthAndYear,
  calculateStatementCloseDate,
  formatCurrency 
} from '../utils/financeUtils';

export interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (tx: Transaction | Transaction[]) => void;
  onUpdateTransaction?: (id: string, updates: Partial<Transaction>) => void;
  editingTx?: Transaction | null;
  accountsList?: AccountItem[];
  existingAccounts?: string[];
  existingCategories?: string[];
  existingTransactions?: Transaction[];
  onAddCategory?: (cat: CategoryItem) => void;
  onAddAccount?: (acc: AccountItem) => void;
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

// Add months helper for installment date calculation
function addMonthsToDateStr(dateStr: string, monthsToAdd: number): string {
  if (!dateStr) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  let y = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10) - 1; // 0-indexed
  let d = parseInt(parts[2], 10);

  const targetDate = new Date(y, m + monthsToAdd, d);
  // Handle month length overflow (e.g., Jan 31 -> Feb 28)
  if (targetDate.getDate() !== d) {
    targetDate.setDate(0); // set to last day of previous month
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;
}

export function AddTransactionModal({ 
  isOpen, 
  onClose, 
  onAddTransaction,
  onUpdateTransaction,
  editingTx,
  accountsList = [],
  existingAccounts = DEFAULT_ACCOUNTS,
  existingCategories = DEFAULT_CATEGORIES,
  existingTransactions = [],
  onAddCategory,
  onAddAccount,
  initialAccount,
  usdArsRate = 1250
}: AddTransactionModalProps) {
  
  // Local list state to support dynamic "Add New"
  const [categoriesList, setCategoriesList] = useState<string[]>(existingCategories);
  const [accountItems, setAccountItems] = useState<AccountItem[]>([]);

  // Sync incoming accounts & categories
  useEffect(() => {
    if (existingCategories && existingCategories.length > 0) {
      setCategoriesList(Array.from(new Set(existingCategories)));
    }
  }, [existingCategories]);

  useEffect(() => {
    if (accountsList && accountsList.length > 0) {
      setAccountItems(accountsList);
    } else {
      // Fallback convert strings to AccountItems
      const items: AccountItem[] = existingAccounts.map((name, idx) => ({
        id: `acc-${idx}`,
        name,
        type: isCreditCardAccount(name) ? 'CREDIT_CARD' : 'CHECKING',
        currency: name.toLowerCase().includes('usd') || name.toLowerCase().includes('dollar') ? 'USD' : 'ARS'
      }));
      setAccountItems(items);
    }
  }, [accountsList, existingAccounts]);

  // Helper to accurately check if an account is configured as a credit card
  const isAccountCreditCard = (acc: AccountItem): boolean => {
    // 1. Check user custom CC map override from Accounts tab
    try {
      const savedMap = localStorage.getItem('finance_app_cc_map');
      if (savedMap) {
        const map = JSON.parse(savedMap);
        if (map[acc.name] !== undefined) {
          return map[acc.name];
        }
      }
    } catch (e) {}

    // 2. Explicit type set on AccountItem
    if (acc.type) {
      return acc.type === 'CREDIT_CARD';
    }

    // 3. Keyword fallback
    return isCreditCardAccount(acc.name);
  };

  const accountNames = useMemo(() => accountItems.map(a => a.name), [accountItems]);

  // Non-credit card accounts for "Paid From" in CC_PAYMENT mode
  const nonCcAccounts = useMemo(() => {
    const filtered = accountItems.filter(a => !isAccountCreditCard(a));
    return filtered.length > 0 ? filtered : accountItems;
  }, [accountItems]);

  // Credit card accounts for "Paid To" in CC_PAYMENT mode
  const ccAccounts = useMemo(() => {
    return accountItems.filter(a => isAccountCreditCard(a));
  }, [accountItems]);

  // Lookup currency for account
  const lookupAccountCurrency = (accName: string): string => {
    const match = accountItems.find(a => a.name.toLowerCase() === accName.toLowerCase());
    if (match?.currency) return match.currency.toUpperCase();
    const lower = accName.toLowerCase();
    if (lower.includes('usd') || lower.includes('dollar') || lower.includes('wise') || lower.includes('payoneer') || lower.includes('usdt')) {
      return 'USD';
    }
    return 'ARS';
  };

  // Lookup closing rule for account (from account item or persisted ccRulesMap)
  const lookupAccountClosingRule = (accName: string) => {
    if (!accName) return { ruleType: 'FIXED_DAY', fixedDay: 25 };

    // 1. Check accountItems in state
    const match = accountItems.find(a => a.name.toLowerCase() === accName.toLowerCase());
    if (match?.closingRule) {
      return match.closingRule;
    }

    // 2. Check finance_app_cc_rules in localStorage
    try {
      const savedRules = localStorage.getItem('finance_app_cc_rules');
      if (savedRules) {
        const map = JSON.parse(savedRules);
        if (map[accName]) return map[accName];
        const key = Object.keys(map).find(k => k.toLowerCase() === accName.toLowerCase());
        if (key && map[key]) return map[key];
      }
    } catch (e) {}

    // 3. Check finance_app_custom_accounts in localStorage
    try {
      const savedAccounts = localStorage.getItem('finance_app_custom_accounts');
      if (savedAccounts) {
        const list: AccountItem[] = JSON.parse(savedAccounts);
        const matchAcc = list.find(a => a.name.toLowerCase() === accName.toLowerCase());
        if (matchAcc?.closingRule) return matchAcc.closingRule;
      }
    } catch (e) {}

    return { ruleType: 'FIXED_DAY', fixedDay: 25 };
  };

  // State
  const [type, setType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER' | 'CC_PAYMENT'>('EXPENSE');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Alimentos y Bebidas');
  const [account, setAccount] = useState(initialAccount || accountNames[0] || 'BBVA');
  const [toAccount, setToAccount] = useState(accountNames[1] || 'Visa BBVA');

  // Title suggestions state & auto-complete
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const uniquePastTitles = useMemo(() => {
    const map = new Map<string, string>(); // title -> most recent category
    existingTransactions.forEach(t => {
      if (t.title && !map.has(t.title)) {
        map.set(t.title, t.category);
      }
    });
    return Array.from(map.entries()).map(([t, cat]) => ({ title: t, category: cat }));
  }, [existingTransactions]);

  const titleSuggestions = useMemo(() => {
    if (!title.trim()) return uniquePastTitles.slice(0, 6);
    const query = title.toLowerCase().trim();
    return uniquePastTitles
      .filter(item => item.title.toLowerCase().includes(query))
      .slice(0, 6);
  }, [title, uniquePastTitles]);

  // Amounts & Currencies
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('ARS');

  // Transfer FX state
  const [receiveAmount, setReceiveAmount] = useState('');
  const [customFxRate, setCustomFxRate] = useState<string>('');
  const [fxEditMode, setFxEditMode] = useState<'AUTO' | 'CUSTOM_RATE' | 'CUSTOM_REC_AMT'>('AUTO');

  // Dates & Metadata
  const [date, setDate] = useState(getTodayStr());
  const [statementCloseDate, setStatementCloseDate] = useState('');
  const [description, setDescription] = useState('');

  // Installments state
  const [numInstallments, setNumInstallments] = useState<number>(1);

  // Dynamic Add Category Modal/Inline
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Dynamic Add Account Modal/Inline
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'CHECKING' | 'CREDIT_CARD' | 'WALLET' | 'SAVINGS'>('CHECKING');
  const [newAccCurrency, setNewAccCurrency] = useState<'ARS' | 'USD'>('ARS');

  // Sync form fields when modal opens or editingTx changes
  useEffect(() => {
    if (!isOpen) return;

    if (editingTx) {
      // Populating from transaction being edited or duplicated
      const txType = editingTx.type || 'EXPENSE';
      setType(txType);
      setTitle(editingTx.title || '');
      setCategory(
        editingTx.category || 
        (txType === 'TRANSFER' ? 'Transferencias' : txType === 'CC_PAYMENT' ? 'Tarjetas de Crédito' : 'General')
      );
      
      const acc = editingTx.account || initialAccount || accountNames[0] || 'BBVA';
      setAccount(acc);
      
      const toAcc = editingTx.toAccount || accountNames.find(a => a !== acc) || 'Visa BBVA';
      setToAccount(toAcc);
      
      setCurrency(editingTx.currency || lookupAccountCurrency(acc));

      const rawAmount = editingTx.originalAmount !== undefined && editingTx.originalAmount !== null
        ? editingTx.originalAmount
        : editingTx.amount;
      setAmount(rawAmount !== undefined && rawAmount !== null ? String(rawAmount) : '');

      if (editingTx.date) {
        const formattedDate = editingTx.date.includes('T') ? editingTx.date.split('T')[0] : editingTx.date.substring(0, 10);
        setDate(formattedDate);
      } else {
        setDate(getTodayStr());
      }

      setStatementCloseDate(editingTx.statementCloseDate || '');
      setDescription(editingTx.description || '');

      let instCount = 1;
      if (editingTx.totalInstallments && editingTx.totalInstallments > 1) {
        instCount = editingTx.totalInstallments;
      } else if (editingTx.installments && editingTx.installments.includes('/')) {
        const parts = editingTx.installments.split('/');
        const parsed = parseInt(parts[1], 10);
        if (!isNaN(parsed) && parsed > 1) instCount = parsed;
      }
      setNumInstallments(instCount);

      if (editingTx.receiveAmount !== undefined && editingTx.receiveAmount !== null) {
        setReceiveAmount(String(editingTx.receiveAmount));
      } else if (editingTx.transferAmount !== undefined && editingTx.transferAmount !== null) {
        setReceiveAmount(String(editingTx.transferAmount));
      } else {
        setReceiveAmount('');
      }

      setCustomFxRate('');
      setFxEditMode('AUTO');
    } else {
      // Reset form for creating a new transaction
      setType('EXPENSE');
      setTitle('');
      setCategory('Alimentos y Bebidas');

      const defaultAcc = initialAccount || accountNames[0] || 'BBVA';
      setAccount(defaultAcc);
      setCurrency(lookupAccountCurrency(defaultAcc));

      const altAcc = accountNames.find(a => a !== defaultAcc) || 'Visa BBVA';
      setToAccount(altAcc);

      setAmount('');
      setReceiveAmount('');
      setCustomFxRate('');
      setFxEditMode('AUTO');
      setDate(getTodayStr());
      setStatementCloseDate('');
      setDescription('');
      setNumInstallments(1);
    }
  }, [isOpen, editingTx, initialAccount, accountNames]);

  // Handle type change when clicking tab pills
  const handleTypeChange = (newType: 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'CC_PAYMENT') => {
    setType(newType);

    if (newType === 'CC_PAYMENT') {
      if (nonCcAccounts.length > 0 && (!account || isCreditCardAccount(nonCcAccounts[0].name))) {
        setAccount(nonCcAccounts[0].name);
      }
      if (ccAccounts.length > 0 && (!toAccount || !isCreditCardAccount(ccAccounts[0].name))) {
        setToAccount(ccAccounts[0].name);
      }
      setCategory('Tarjetas de Crédito');
    } else if (newType === 'TRANSFER') {
      setCategory('Transferencias');
    } else if (newType === 'INCOME' && category === 'Alimentos y Bebidas') {
      setCategory('Sueldo');
    } else if (newType === 'EXPENSE' && category === 'Sueldo') {
      setCategory('Alimentos y Bebidas');
    }
  };

  // Account change handler
  const handleAccountChange = (newAcc: string) => {
    if (newAcc === '__ADD_NEW__') {
      setIsAddingAccount(true);
      return;
    }
    setAccount(newAcc);
    setCurrency(lookupAccountCurrency(newAcc));
  };

  const handleToAccountChange = (newAcc: string) => {
    if (newAcc === '__ADD_NEW__') {
      setIsAddingAccount(true);
      return;
    }
    setToAccount(newAcc);
  };

  const handleCategorySelectChange = (val: string) => {
    if (val === '__ADD_NEW__') {
      setIsAddingCategory(true);
      return;
    }
    setCategory(val);
  };

  // Add new Category submit
  const handleSaveNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    if (!categoriesList.includes(trimmed)) {
      setCategoriesList(prev => [...prev, trimmed]);
      if (onAddCategory) {
        onAddCategory({
          id: `cat-${Date.now()}`,
          name: trimmed,
          type: type === 'INCOME' ? 'INCOME' : 'EXPENSE'
        });
      }
    }
    setCategory(trimmed);
    setNewCatName('');
    setIsAddingCategory(false);
  };

  // Add new Account submit
  const handleSaveNewAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAccName.trim();
    if (!trimmed) return;

    const newAccObj: AccountItem = {
      id: `acc-${Date.now()}`,
      name: trimmed,
      type: newAccType,
      currency: newAccCurrency
    };

    setAccountItems(prev => [...prev, newAccObj]);
    if (onAddAccount) {
      onAddAccount(newAccObj);
    }

    if (type === 'CC_PAYMENT' && newAccType === 'CREDIT_CARD') {
      setToAccount(trimmed);
    } else {
      setAccount(trimmed);
      setCurrency(newAccCurrency);
    }

    setNewAccName('');
    setIsAddingAccount(false);
  };

  // Check if current active account is Credit Card
  const isCC = useMemo(() => {
    if (type === 'CC_PAYMENT') return true;
    const match = accountItems.find(a => a.name.toLowerCase() === account.toLowerCase());
    if (match) return isAccountCreditCard(match);
    return isCreditCardAccount(account);
  }, [account, accountItems, type]);

  // Reset installments to 1 if the account is not a credit card
  useEffect(() => {
    if (!isCC) {
      setNumInstallments(1);
    }
  }, [isCC]);

  // Statement close dates list for the selected CC account
  const statementCloseDatesList = useMemo(() => {
    const targetAcc = type === 'CC_PAYMENT' ? toAccount : account;
    const rule = lookupAccountClosingRule(targetAcc);
    return getUpcomingStatementCloseDates(date, rule);
  }, [date, account, toAccount, type, accountItems, isOpen]);

  // Auto set statement close date to default current period when date or account changes
  useEffect(() => {
    if (isCC && statementCloseDatesList.length > 0) {
      const defaultPeriod = statementCloseDatesList.find(s => s.isDefault);
      if (defaultPeriod) {
        setStatementCloseDate(defaultPeriod.dateStr);
      } else {
        setStatementCloseDate(statementCloseDatesList[0].dateStr);
      }
    }
  }, [isCC, date, account, toAccount, type]);

  // Transfer FX computation
  const sourceCurrency = useMemo(() => lookupAccountCurrency(account), [account, accountItems]);
  const destCurrency = useMemo(() => lookupAccountCurrency(toAccount), [toAccount, accountItems]);

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
      setReceiveAmount(amount);
      setCustomFxRate('1.00');
      return;
    }

    if (fxEditMode === 'AUTO') {
      if (sourceCurrency === 'ARS' && destCurrency === 'USD') {
        setReceiveAmount((parsedSent / usdArsRate).toFixed(2));
        setCustomFxRate(usdArsRate.toString());
      } else if (sourceCurrency === 'USD' && destCurrency === 'ARS') {
        setReceiveAmount((parsedSent * usdArsRate).toFixed(2));
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
        } else {
          setReceiveAmount((parsedSent * rate).toFixed(2));
        }
      }
    } else if (fxEditMode === 'CUSTOM_REC_AMT') {
      const rec = parseFloat(receiveAmount);
      if (!isNaN(rec) && rec > 0) {
        if (sourceCurrency === 'ARS' && destCurrency === 'USD') {
          setCustomFxRate((parsedSent / rec).toFixed(2));
        } else {
          setCustomFxRate((rec / parsedSent).toFixed(4));
        }
      }
    }
  }, [type, amount, sourceCurrency, destCurrency, usdArsRate, fxEditMode, customFxRate, receiveAmount]);

  // Installment breakdown calculation
  const installmentSchedule = useMemo(() => {
    const totalAmt = parseFloat(amount);
    if (isNaN(totalAmt) || totalAmt <= 0 || numInstallments <= 1) {
      return [];
    }

    const totalCents = Math.round(totalAmt * 100);
    const baseCents = Math.floor(totalCents / numInstallments);
    const remainderCents = totalCents - (baseCents * numInstallments);

    const targetAcc = type === 'CC_PAYMENT' ? toAccount : account;
    const rule = lookupAccountClosingRule(targetAcc);
    const pad = (n: number) => String(n).padStart(2, '0');

    // Parse the selected purchase date (YYYY-MM-DD)
    const dateParts = (date || getTodayStr()).split('-');
    const baseYear = parseInt(dateParts[0], 10) || new Date().getFullYear();
    const baseMonth = (parseInt(dateParts[1], 10) || (new Date().getMonth() + 1)) - 1; // 0-indexed
    const baseDay = parseInt(dateParts[2], 10) || new Date().getDate();

    const list = [];
    for (let i = 1; i <= numInstallments; i++) {
      // 1st installment takes the remainder cents (e.g. 33.34 + 33.33 + 33.33 = 100)
      const centsForThisCuota = i === 1 ? baseCents + remainderCents : baseCents;
      const amtForThisCuota = centsForThisCuota / 100;

      // Purchase date for installment i: same day of month shifted by (i - 1) months
      const targetDt = new Date(baseYear, baseMonth + (i - 1), 1);
      const daysInMonth = new Date(targetDt.getFullYear(), targetDt.getMonth() + 1, 0).getDate();
      const actualDay = Math.min(baseDay, daysInMonth);
      const instTxDate = `${targetDt.getFullYear()}-${pad(targetDt.getMonth() + 1)}-${pad(actualDay)}`;

      // Calculate credit card statement close date for this installment date
      let stmtCloseDate = '';
      if (isCC) {
        stmtCloseDate = calculateStatementCloseDate(instTxDate, rule);
      }

      list.push({
        installmentNum: i,
        label: `${i}/${numInstallments}`,
        amount: amtForThisCuota,
        instTxDate,
        stmtCloseDate,
        isFirst: i === 1
      });
    }

    return list;
  }, [amount, numInstallments, date, account, toAccount, type, isCC, accountItems]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    if (editingTx && onUpdateTransaction && editingTx.id) {
      if (type === 'CC_PAYMENT') {
        onUpdateTransaction(editingTx.id, {
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
        });
      } else if (type === 'TRANSFER') {
        const parsedReceiveAmt = parseFloat(receiveAmount) || parsedAmount;
        // In the original, sourceCurrency and destCurrency are used. 
        // We will just use the current account currencies.
        onUpdateTransaction(editingTx.id, {
          date: new Date(date).toISOString(),
          title: title || `Transferencia: ${account} → ${toAccount}`,
          category: category || 'Transferencias',
          account: account,
          toAccount: toAccount,
          amount: parsedAmount,
          transferAmount: parsedAmount,
          receiveAmount: parsedReceiveAmt,
          type: 'TRANSFER',
          description: description || undefined,
        });
      } else {
        onUpdateTransaction(editingTx.id, {
          date: new Date(date).toISOString(),
          title: title || (type === 'INCOME' ? 'Income' : 'Expense'),
          category: category || 'General',
          account: account,
          amount: parsedAmount,
          currency,
          type,
          description: description || undefined,
          installments: numInstallments > 1 ? `1/${numInstallments}` : undefined,
          installmentNumber: 1,
          totalInstallments: numInstallments > 1 ? numInstallments : undefined,
          statementCloseDate: isCC ? statementCloseDate : undefined,
        });
      }
      onClose();
      return;
    }

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
      // EXPENSE or INCOME
      if (type === 'EXPENSE' && isCC && numInstallments > 1 && installmentSchedule.length > 0) {
        // Create multiple installment transactions
        const txList: Transaction[] = installmentSchedule.map((cuota, idx) => ({
          id: `manual-${Date.now()}-${idx + 1}`,
          date: new Date(`${cuota.instTxDate}T12:00:00`).toISOString(),
          title: title || 'Expense',
          category: category || 'General',
          account: account,
          amount: cuota.amount,
          currency,
          type,
          description: description ? `${description} (Cuota ${cuota.label})` : `Cuota ${cuota.label}`,
          installments: cuota.label,
          installmentNumber: cuota.installmentNum,
          totalInstallments: numInstallments,
          originalAmount: parsedAmount,
          statementCloseDate: isCC ? cuota.stmtCloseDate : undefined,
        }));
        onAddTransaction(txList);
      } else {
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
          installments: numInstallments > 1 ? `1/${numInstallments}` : undefined,
          installmentNumber: 1,
          totalInstallments: numInstallments > 1 ? numInstallments : undefined,
          statementCloseDate: isCC ? statementCloseDate : undefined,
        };
        onAddTransaction(newTx);
      }
    }

    onClose();
    // Reset form
    setTitle('');
    setAmount('');
    setReceiveAmount('');
    setCustomFxRate('');
    setFxEditMode('AUTO');
    setDescription('');
    setNumInstallments(1);
  };

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
                {type === 'EXPENSE' && (editingTx && editingTx.id ? 'Edit Expense' : 'Record New Expense')}
                {type === 'INCOME' && (editingTx && editingTx.id ? 'Edit Income' : 'Record New Income')}
                {type === 'TRANSFER' && (editingTx && editingTx.id ? 'Edit Transfer' : 'Account Transfer')}
                {type === 'CC_PAYMENT' && 'Credit Card Settlement'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {type === 'TRANSFER' ? 'Transfer funds with live FX calculation' : 'Fast, structured transaction logging'}
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
            onClick={() => handleTypeChange('EXPENSE')}
            className={`py-2 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
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
            onClick={() => handleTypeChange('INCOME')}
            className={`py-2 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
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
            onClick={() => handleTypeChange('TRANSFER')}
            className={`py-2 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
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
            onClick={() => handleTypeChange('CC_PAYMENT')}
            className={`py-2 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
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
                </div>
              )}
            </div>
          </div>

          {/* TITLE INPUT WITH AUTOCOMPLETE SUGGESTIONS */}
          <div className="relative">
            <label className="block text-slate-400 font-medium mb-1">
              {type === 'CC_PAYMENT' ? 'Payment Reference' : 'Title / Merchant'}
            </label>
            <div className="relative">
              <input
                ref={titleInputRef}
                type="text"
                required
                placeholder={
                  type === 'CC_PAYMENT' ? 'e.g. Resumen Agosto Visa BBVA' : 
                  type === 'TRANSFER' ? 'e.g. Transferencia ahorro mensual' : 
                  type === 'INCOME' ? 'e.g. Sueldo / Freelance' :
                  'e.g. Uber, Supermercado Coto, YPF'
                }
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setShowTitleSuggestions(true);
                }}
                onFocus={() => setShowTitleSuggestions(true)}
                className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-500 font-medium text-xs"
              />

              {/* Suggestions Dropdown */}
              {showTitleSuggestions && titleSuggestions.length > 0 && (
                <div 
                  className="absolute left-0 right-0 top-full mt-1 bg-[#161b22] border border-slate-700 rounded-xl shadow-xl z-30 max-h-44 overflow-y-auto divide-y divide-slate-800/60"
                  onMouseDown={(e) => e.preventDefault()} // Prevent input blur before click
                >
                  <div className="px-2.5 py-1 text-[9px] uppercase tracking-wider text-slate-500 font-bold bg-[#11141c]">
                    Previous Merchants / Suggestions
                  </div>
                  {titleSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTitle(item.title);
                        if (item.category && categoriesList.includes(item.category)) {
                          setCategory(item.category);
                        }
                        setShowTitleSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center justify-between transition-colors"
                    >
                      <span className="font-semibold text-emerald-300">{item.title}</span>
                      {item.category && (
                        <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          {item.category}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* DATE & CLOSING DATE ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" /> Transaction Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs"
              />
            </div>

            {/* Credit Card Statement Closing Date Dropdown */}
            {isCC && (
              <div>
                <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" /> Statement Closing Date
                </label>
                <select
                  value={statementCloseDate}
                  onChange={(e) => setStatementCloseDate(e.target.value)}
                  className="w-full px-2.5 py-2 bg-[#0a0c10] border border-amber-500/40 text-amber-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-semibold"
                >
                  {statementCloseDatesList.map((item) => (
                    <option key={item.dateStr} value={item.dateStr}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* TRANSFER SPECIFIC BLOCK */}
          {type === 'TRANSFER' && (
            <div className="p-3.5 bg-gradient-to-br from-[#0c1322] to-[#111827] border border-sky-500/30 rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4" /> {editingTx && editingTx.id ? 'Edit Transfer' : 'Account Transfer'} & FX Conversion
                </span>
                <span className="text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded-full font-medium">
                  {sourceCurrency} → {destCurrency}
                </span>
              </div>

              {/* Account Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                    From Account (Outflow)
                  </label>
                  <select
                    value={account}
                    onChange={(e) => handleAccountChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium text-xs cursor-pointer"
                  >
                    {accountItems.map((acc) => (
                      <option key={acc.id} value={acc.name}>
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                    <option value="__ADD_NEW__" className="text-sky-400 font-bold">+ Add New Account...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                    To Account (Inflow)
                  </label>
                  <select
                    value={toAccount}
                    onChange={(e) => handleToAccountChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium text-xs cursor-pointer"
                  >
                    {accountItems.map((acc) => (
                      <option key={acc.id} value={acc.name}>
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                    <option value="__ADD_NEW__" className="text-sky-400 font-bold">+ Add New Account...</option>
                  </select>
                </div>
              </div>

              {/* Received Amount & Exchange Rate */}
              <div className="p-3 bg-[#080b12] border border-slate-800 rounded-xl space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1 text-[10px]">
                      Received Amount ({destCurrency})
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
                      <span>FX Rate Used</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFxEditMode('AUTO');
                          setCustomFxRate(usdArsRate.toString());
                        }}
                        className="text-[9px] text-amber-400 hover:text-amber-300 underline font-semibold flex items-center gap-0.5"
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

                <div className="flex items-center justify-between text-[10px] text-sky-300 font-mono pt-1 border-t border-slate-800/80">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                    Rate: 1 {sourceCurrency} = {(parseFloat(receiveAmount) / (parseFloat(amount) || 1) || 1).toFixed(4)} {destCurrency}
                  </span>
                  <span className="text-slate-500 text-[9px]">
                    {fxEditMode === 'AUTO' ? 'Auto FX calculation' : 'Custom FX override'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* CREDIT CARD SETTLEMENT (CC_PAYMENT) SPECIFIC ACCOUNTS FILTER */}
          {type === 'CC_PAYMENT' && (
            <div className="p-3.5 bg-purple-500/10 border border-purple-500/25 rounded-2xl space-y-3">
              <div className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-purple-400" /> Credit Card Settlement Details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                    Paid From (Bank / Cash Account)
                  </label>
                  <select
                    value={account}
                    onChange={(e) => handleAccountChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs font-medium cursor-pointer"
                  >
                    {nonCcAccounts.map((acc) => (
                      <option key={acc.id} value={acc.name}>
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                    <option value="__ADD_NEW__" className="text-purple-400 font-bold">+ Add New Account...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                    Paid To (Credit Card)
                  </label>
                  <select
                    value={toAccount}
                    onChange={(e) => handleToAccountChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs font-medium cursor-pointer"
                  >
                    {ccAccounts.map((acc) => (
                      <option key={acc.id} value={acc.name}>
                        💳 {acc.name} ({acc.currency})
                      </option>
                    ))}
                    <option value="__ADD_NEW__" className="text-purple-400 font-bold">+ Add New Credit Card...</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STANDARD CATEGORY & ACCOUNT DROPDOWNS (Non-transfer) */}
          {type !== 'TRANSFER' && type !== 'CC_PAYMENT' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Category Dropdown */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-400 font-medium flex items-center gap-1">
                    <Tag className="w-3 h-3 text-slate-500" /> Category
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingCategory(true)}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-0.5"
                  >
                    <Plus className="w-2.5 h-2.5" /> New
                  </button>
                </div>
                <select
                  value={category}
                  onChange={(e) => handleCategorySelectChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#22c55e] text-xs font-medium cursor-pointer"
                >
                  {categoriesList.map((catName) => (
                    <option key={catName} value={catName}>
                      {catName}
                    </option>
                  ))}
                  <option value="__ADD_NEW__" className="text-emerald-400 font-bold">+ Add New Category...</option>
                </select>
              </div>

              {/* Account Dropdown */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-400 font-medium flex items-center gap-1">
                    <Wallet className="w-3 h-3 text-slate-500" /> Account
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingAccount(true)}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-0.5"
                  >
                    <Plus className="w-2.5 h-2.5" /> New
                  </button>
                </div>
                <select
                  value={account}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-500 text-xs font-medium cursor-pointer"
                >
                  {accountItems.map((acc) => (
                    <option key={acc.id} value={acc.name}>
                      {acc.name} ({acc.currency})
                    </option>
                  ))}
                  <option value="__ADD_NEW__" className="text-emerald-400 font-bold">+ Add New Account...</option>
                </select>
              </div>
            </div>
          )}

          {/* CREDIT CARD INSTALLMENTS BREAKDOWN ENGINE (For Expenses on Credit Cards) */}
          {type === 'EXPENSE' && isCC && (
            <div className="p-3.5 bg-[#0d1017] border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" /> Installments / Cuotas Breakdown
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {numInstallments === 1 ? 'Single Payment' : `${numInstallments} Monthly Payments`}
                </span>
              </div>

              {/* Quick cuota preset buttons + Custom input */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-slate-500 font-semibold shrink-0">Presets:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 3, 6, 12, 18, 24].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNumInstallments(num)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        numInstallments === num
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-xs'
                          : 'bg-[#161b22] text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {num === 1 ? '1x' : `${num}x`}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 ml-auto shrink-0 bg-[#161b22] px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-medium">Custom:</span>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    placeholder="e.g. 2, 4"
                    value={numInstallments}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setNumInstallments(isNaN(val) || val < 1 ? 1 : val);
                    }}
                    className="w-14 px-1.5 py-0.5 bg-[#0a0c10] border border-amber-500/40 text-amber-300 font-mono font-bold text-xs rounded focus:outline-none focus:ring-1 focus:ring-amber-500 text-center"
                  />
                  <span className="text-[10px] text-slate-400 font-medium">cuotas</span>
                </div>
              </div>

              {/* Installment breakdown list */}
              {numInstallments > 1 && installmentSchedule.length > 0 && (
                <div className="bg-[#080b12] border border-amber-500/30 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] font-bold text-amber-300 flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span>Cuota Schedule ({numInstallments} installments)</span>
                    <span className="text-slate-400 font-mono font-normal">
                      Cents centered on 1st cuota
                    </span>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                    {installmentSchedule.map((cuota) => (
                      <div 
                        key={cuota.installmentNum} 
                        className={`flex justify-between items-center px-2 py-1 rounded ${
                          cuota.isFirst ? 'bg-amber-500/10 border border-amber-500/20 text-amber-200' : 'text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-400">Cuota {cuota.label}</span>
                          {cuota.isFirst && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded font-sans">
                              (1st Cuota + Cents)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 text-[10px] font-sans">{cuota.instTxDate}</span>
                          <span className="font-bold text-emerald-400">
                            {formatCurrency(cuota.amount, currency)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1 border-t border-slate-800 flex justify-between text-[10px] text-slate-400">
                    <span>Total Amount:</span>
                    <span className="font-bold text-slate-100 font-mono">
                      {formatCurrency(parseFloat(amount) || 0, currency)}
                    </span>
                  </div>
                </div>
              )}
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
                {type === 'EXPENSE' && (numInstallments > 1 ? `Save ${numInstallments} Installments` : 'Save Expense')}
                {type === 'INCOME' && 'Save Income'}
                {type === 'TRANSFER' && 'Complete Transfer'}
                {type === 'CC_PAYMENT' && 'Record Payment'}
              </span>
            </button>
          </div>

        </form>

        {/* INLINE ADD CATEGORY MODAL / SUB-POPUP */}
        {isAddingCategory && (
          <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4">
            <div className="bg-[#161b22] border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-emerald-400" /> Create New Category
                </h4>
                <button 
                  type="button" 
                  onClick={() => setIsAddingCategory(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveNewCategory} className="space-y-3">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Mascotas, Gimnasio, Subscripciones"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingCategory(false)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
                  >
                    Add Category
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* INLINE ADD ACCOUNT MODAL / SUB-POPUP */}
        {isAddingAccount && (
          <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4">
            <div className="bg-[#161b22] border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-sky-400" /> Create New Account
                </h4>
                <button 
                  type="button" 
                  onClick={() => setIsAddingAccount(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveNewAccount} className="space-y-3">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. MercadoPago, Visa Galicia, Payoneer"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0c10] border border-slate-700 text-slate-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-300 text-xs font-semibold mb-1">
                      Type
                    </label>
                    <select
                      value={newAccType}
                      onChange={(e) => setNewAccType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl text-xs font-medium"
                    >
                      <option value="CHECKING">Checking / Cash</option>
                      <option value="CREDIT_CARD">Credit Card 💳</option>
                      <option value="WALLET">Digital Wallet 📱</option>
                      <option value="SAVINGS">Savings Account</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 text-xs font-semibold mb-1">
                      Currency
                    </label>
                    <select
                      value={newAccCurrency}
                      onChange={(e) => setNewAccCurrency(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-[#0a0c10] border border-slate-700 text-slate-200 rounded-xl text-xs font-medium"
                    >
                      <option value="ARS">ARS 🇦🇷</option>
                      <option value="USD">USD 💵</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingAccount(false)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
