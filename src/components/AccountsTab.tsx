import React, { useState, useMemo } from 'react';
import { Transaction, DisplayCurrency, AccountCustomBalance, TransactionFilter, CreditCardClosingRule, AccountItem, SharedMember } from '../types';
import { computeAccountBalances, formatCurrency, isCreditCardAccount, getCreditCardStatements, getCurrentStatement, getNextCloseDate, getClosingRuleLabel, getTodayString, getTransferOutflow, getTransferInflow } from '../utils/financeUtils';
import { Wallet, DollarSign, Landmark, Edit3, Check, RotateCcw, HelpCircle, History, ArrowRightLeft, ExternalLink, CreditCard, ChevronRight, AlertCircle, Sparkles, Calendar, Settings, Users, Share2, UserPlus } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { CreditCardDetailModal } from './CreditCardDetailModal';
import { ShareAccountModal } from './ShareAccountModal';

interface AccountsTabProps {
  transactions: Transaction[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  customBalances: Record<string, AccountCustomBalance>;
  accounts?: AccountItem[];
  periodStatusOverrides?: Record<string, 'PAID' | 'OPEN'>;
  isWorkspaceShared?: boolean;
  workspaceMembersCount?: number;
  onOpenShareWorkspaceModal?: () => void;
  onUpdatePeriodStatus?: (accountName: string, closeDate: string, status?: 'PAID' | 'OPEN') => void;
  onUpdateAccountBalance: (accountName: string, currentBalance: number, currency: string) => void;
  onNavigateToTransactionsWithFilter: (filter: TransactionFilter) => void;
  onAddTransaction: (tx: Transaction) => void;
  onReassignTransactionPeriod?: (txId: string, statementCloseDate: string | undefined) => void;
  onUpdateAccountSharing?: (accName: string, isShared: boolean, sharedMembers: SharedMember[]) => void;
  onEditAccount?: (oldName: string, updatedAcc: AccountItem, updateTransactions: boolean) => void;
  onAddAccount?: (newAcc: AccountItem) => void;
  currentUserId?: string;
  showSharedData?: boolean;
  userTimezone?: string;
}

const COLORS = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#f43f5e', '#38bdf8', '#818cf8', '#fb7185'];

export function AccountsTab({
  transactions,
  displayCurrency,
  usdArsRate,
  customBalances,
  accounts = [],
  periodStatusOverrides,
  isWorkspaceShared = false,
  workspaceMembersCount = 0,
  onOpenShareWorkspaceModal,
  onUpdatePeriodStatus,
  onUpdateAccountBalance,
  onNavigateToTransactionsWithFilter,
  onAddTransaction,
  onReassignTransactionPeriod,
  onUpdateAccountSharing,
  onEditAccount,
  onAddAccount,
  currentUserId,
  showSharedData = true,
  userTimezone = 'America/Argentina/Buenos_Aires',
}: AccountsTabProps) {
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Selected credit card for detail modal
  const [selectedCardAccount, setSelectedCardAccount] = useState<string | null>(null);

  // Selected account for sharing modal
  const [sharingAccountName, setSharingAccountName] = useState<string | null>(null);

  // Custom user overrides for account classification (persisted in local state/storage)
  const [customCCMap, setCustomCCMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('finance_app_cc_map');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  // Credit Card closing rules map
  const [ccRulesMap, setCcRulesMap] = useState<Record<string, CreditCardClosingRule>>(() => {
    let map: Record<string, CreditCardClosingRule> = {};
    try {
      const saved = localStorage.getItem('finance_app_cc_rules');
      if (saved) map = JSON.parse(saved);
    } catch (e) {}
    accounts?.forEach(acc => {
      if (acc.closingRule && !map[acc.name]) {
        map[acc.name] = acc.closingRule;
      }
    });
    return map;
  });

  const handleSaveCcRule = (accName: string, rule: CreditCardClosingRule) => {
    const updated = { ...ccRulesMap, [accName]: rule };
    setCcRulesMap(updated);
    try {
      localStorage.setItem('finance_app_cc_rules', JSON.stringify(updated));
    } catch (e) {}

    const existingAcc = accounts.find(a => a.name.toLowerCase() === accName.toLowerCase());
    if (existingAcc && onEditAccount) {
      onEditAccount(existingAcc.name, { ...existingAcc, closingRule: rule }, false);
    }
  };

  const toggleAccountClassification = (accName: string, currentIsCC: boolean) => {
    const nextIsCC = !currentIsCC;
    const updated = { ...customCCMap, [accName]: nextIsCC };
    setCustomCCMap(updated);
    try {
      localStorage.setItem('finance_app_cc_map', JSON.stringify(updated));
    } catch (e) {}

    const existingAcc = accounts.find(a => a.name.toLowerCase() === accName.toLowerCase());
    if (existingAcc && onEditAccount) {
      onEditAccount(existingAcc.name, { ...existingAcc, type: nextIsCC ? 'CREDIT_CARD' : 'CHECKING' }, false);
    } else if (onAddAccount) {
      onAddAccount({
        id: `acc-${Date.now()}`,
        name: accName,
        type: nextIsCC ? 'CREDIT_CARD' : 'CHECKING',
        currency: accName.toLowerCase().includes('usd') ? 'USD' : 'ARS',
        closingRule: ccRulesMap[accName] || { ruleType: 'FIXED_DAY', fixedDay: 25 },
      });
    }
  };

  // Filter transactions based on shared data preference
  const filteredTransactions = useMemo(() => {
    if (showSharedData) return transactions;
    return transactions.filter(t => {
      const isShared = t.ownerId && currentUserId && t.ownerId !== currentUserId;
      return !isShared;
    });
  }, [transactions, showSharedData, currentUserId]);

  // Filter accounts based on shared data preference
  const filteredAccountItems = useMemo(() => {
    if (showSharedData) return accounts;
    return accounts.filter(acc => {
      const isShared = acc.ownerId && currentUserId && acc.ownerId !== currentUserId;
      return !isShared;
    });
  }, [accounts, showSharedData, currentUserId]);

  // Calculate account summaries using central financeUtils helper
  const computedSummaries = computeAccountBalances(filteredTransactions, usdArsRate, customBalances, filteredAccountItems);

  // Reconstructed summary list with Credit Card classification
  const reconstructedAccounts = computedSummaries.map(summary => {
    const name = summary.accountName;
    const currency = summary.originalCurrency;
    const isUsd = currency.toUpperCase().includes('USD');
    const currentBalance = summary.balanceOriginal;
    const currentARS = summary.balanceARS;
    const currentUSD = summary.balanceUSD;

    const isCC = isCreditCardAccount(name, customCCMap, accounts);
    const accountRule = ccRulesMap[name] || { ruleType: 'FIXED_DAY', fixedDay: 25 };

    // If it's a credit card, compute statement summary based on current date & time
    const statements = isCC ? getCreditCardStatements(filteredTransactions, name, accountRule, periodStatusOverrides) : [];
    const currentStatement = isCC ? getCurrentStatement(statements, accountRule) : undefined;
    const nextCloseDate = isCC ? getNextCloseDate(accountRule) : undefined;

    return {
      accountName: name,
      currency,
      originalCurrency: currency,
      isUsd,
      isCreditCard: isCC,
      closingRule: accountRule,
      currentBalance,
      balanceOriginal: currentBalance,
      netDelta: currentBalance,
      reconstructedInitialBalance: 0,
      currentARS,
      currentUSD,
      txCount: summary.txCount,
      hasCustom: customBalances[name] !== undefined,
      currentStatement,
      nextCloseDate,
      statements,
    };
  });

  // Separate Liquid Accounts vs Credit Card Accounts
  const liquidAccounts = reconstructedAccounts.filter(a => !a.isCreditCard);
  const creditCardAccounts = reconstructedAccounts.filter(a => a.isCreditCard);

  // Totals calculations
  const totalLiquidARS = liquidAccounts.reduce((acc, curr) => acc + curr.currentARS, 0);
  const totalLiquidUSD = liquidAccounts.reduce((acc, curr) => acc + curr.currentUSD, 0);

  // Credit Card Outstanding Debt (Expenses minus payments)
  const totalCcDebtARS = creditCardAccounts.reduce((acc, curr) => {
    const debt = curr.currentStatement ? Math.max(0, curr.currentStatement.netDue) : Math.abs(Math.min(0, curr.currentBalance));
    const debtARS = curr.isUsd ? debt * usdArsRate : debt;
    return acc + debtARS;
  }, 0);

  const totalCcDebtUSD = usdArsRate > 0 ? totalCcDebtARS / usdArsRate : 0;

  const netWorthARS = totalLiquidARS - totalCcDebtARS;
  const netWorthUSD = totalLiquidUSD - totalCcDebtUSD;

  const pieData = useMemo(() => {
    return liquidAccounts
      .filter(acc => (displayCurrency === 'USD' ? acc.currentUSD : acc.currentARS) > 0)
      .map(acc => ({
        name: acc.accountName,
        value: displayCurrency === 'USD' ? acc.currentUSD : acc.currentARS
      }))
      .sort((a, b) => b.value - a.value);
  }, [liquidAccounts, displayCurrency]);

  const handleStartEdit = (accName: string, curVal: number) => {
    setEditingAccount(accName);
    setEditValue(curVal.toString());
  };

  const handleSaveEdit = (accName: string, currency: string) => {
    const num = parseFloat(editValue);
    if (!isNaN(num)) {
      onUpdateAccountBalance(accName, num, currency);
    }
    setEditingAccount(null);
  };

  const selectedAccountToShare = useMemo(() => {
    if (!sharingAccountName) return null;
    const found = accounts?.find(a => a.name === sharingAccountName);
    if (found) return found;
    return {
      id: `acc_${sharingAccountName}`,
      name: sharingAccountName,
      type: isCreditCardAccount(sharingAccountName, customCCMap) ? ('CREDIT_CARD' as const) : ('CHECKING' as const),
      currency: liquidAccounts.find(a => a.accountName === sharingAccountName)?.currency || creditCardAccounts.find(a => a.accountName === sharingAccountName)?.currency || 'ARS',
      isShared: false,
      sharedMembers: [],
    };
  }, [sharingAccountName, accounts, liquidAccounts, creditCardAccounts, customCCMap]);

  return (
    <div className="space-y-6">
      {/* Guidance Banner */}
      <div className="bg-[#121620] p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-800 border border-slate-700 text-emerald-400 rounded-xl">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span>Account & Credit Card Management</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                Credit Cards Isolated
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Liquid bank accounts track cash assets. Credit card expenses are grouped into <strong>statement cycles with close dates</strong> and settled via explicit credit card payments.
            </p>
          </div>
        </div>

        {onOpenShareWorkspaceModal && (
          <button
            type="button"
            onClick={onOpenShareWorkspaceModal}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 shrink-0 ${
              isWorkspaceShared
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30'
                : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isWorkspaceShared ? `Shared Household (${workspaceMembersCount})` : 'Share Full Household Workspace'}</span>
          </button>
        )}
      </div>

      {/* Financial Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Liquid Bank Cash</p>
            <h3 className="text-xl font-bold text-emerald-400 mt-1">
              {formatCurrency(displayCurrency === 'USD' ? totalLiquidUSD : totalLiquidARS, displayCurrency)}
            </h3>
            <span className="text-[10px] text-slate-500 mt-1 block">Available liquid funds</span>
          </div>
          <div className="p-3 bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 rounded-xl shadow-inner">
            <Landmark className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Credit Card Statement Debt</p>
            <h3 className="text-xl font-bold text-amber-400 mt-1">
              {formatCurrency(displayCurrency === 'USD' ? totalCcDebtUSD : totalCcDebtARS, displayCurrency)}
            </h3>
            <span className="text-[10px] text-slate-500 mt-1 block">Pending statement liabilities</span>
          </div>
          <div className="p-3 bg-amber-950/80 border border-amber-800/60 text-amber-300 rounded-xl shadow-inner">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Net Liquid Wealth</p>
            <h3 className={`text-xl font-bold mt-1 ${netWorthARS >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
              {formatCurrency(displayCurrency === 'USD' ? netWorthUSD : netWorthARS, displayCurrency)}
            </h3>
            <span className="text-[10px] text-slate-500 mt-1 block">Liquid Cash minus Card Debt</span>
          </div>
          <div className="p-3 bg-slate-800 border border-slate-700 text-white rounded-xl shadow-inner">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Credit Card Accounts Section */}
      <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-400" />
              <span>Credit Card Accounts & Statement Cycles</span>
            </h3>
            <p className="text-xs text-slate-400">
              Track itemized expenses inside each credit card and record payments from main bank accounts when settling statements.
            </p>
          </div>
        </div>

        {creditCardAccounts.length === 0 ? (
          <div className="p-6 text-center text-slate-500 bg-[#121620] rounded-xl border border-slate-800 text-xs">
            No credit card accounts detected. Toggle any account below to classify it as a Credit Card.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creditCardAccounts.map((acc) => {
              const stmt = acc.currentStatement;
              const netDue = stmt ? stmt.netDue : 0;
              const nextClose = acc.nextCloseDate || stmt?.closeDate;

              const matchedAccount = accounts?.find(a => a.name === acc.accountName);
              const isShared = matchedAccount?.isShared || (matchedAccount?.sharedMembers && matchedAccount.sharedMembers.length > 0);
              const memberCount = matchedAccount?.sharedMembers?.length || 0;

              return (
                <div
                  key={acc.accountName}
                  className="p-4 rounded-xl border border-purple-500/20 bg-[#121620] hover:border-purple-500/50 transition-all space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-md flex items-center gap-1">
                          <CreditCard className="w-3 h-3" /> Credit Card ({acc.currency})
                        </span>
                        {isShared && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" /> Shared ({memberCount})
                          </span>
                        )}
                        {matchedAccount?.ownerId && currentUserId && matchedAccount.ownerId !== currentUserId && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 text-[9px] font-bold">Workspace</span>
                        )}
                        <button
                          onClick={() => toggleAccountClassification(acc.accountName, true)}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
                          title="Switch to Bank Account"
                        >
                          Change type
                        </button>
                      </div>
                      <h4 className="text-sm font-bold text-slate-100 mt-1.5">{acc.accountName}</h4>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => setSharingAccountName(acc.accountName)}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Share account with another person"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Share</span>
                      </button>

                      <button
                        onClick={() => setSelectedCardAccount(acc.accountName)}
                        className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 border border-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Statement metrics box */}
                  <div className="p-3 bg-[#161b22] rounded-xl border border-slate-800 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">Current Statement Due:</span>
                      <span className={`text-base font-bold ${netDue > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {formatCurrency(netDue, acc.originalCurrency as DisplayCurrency)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-medium block">Closing Date Schedule:</span>
                      <span className="text-xs font-semibold text-purple-300">
                        {getClosingRuleLabel(acc.closingRule)}
                      </span>
                      {nextClose && (
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                          Next close: {nextClose}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                    <span>{acc.txCount} recorded card transactions</span>
                    <button
                      onClick={() => setSelectedCardAccount(acc.accountName)}
                      className="text-purple-400 hover:text-purple-300 font-medium underline"
                    >
                      Record Statement Payment
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liquid Accounts List & Balance Editor */}
        <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-400" />
                <span>Liquid Bank Accounts & Cash</span>
              </h3>
              <p className="text-xs text-slate-400">Click the edit button on any account to adjust its exact live bank balance.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {liquidAccounts.map((acc) => {
              const isEditing = editingAccount === acc.accountName;

              const matchedAccount = accounts?.find(a => a.name === acc.accountName);
              const isShared = matchedAccount?.isShared || (matchedAccount?.sharedMembers && matchedAccount.sharedMembers.length > 0);
              const memberCount = matchedAccount?.sharedMembers?.length || 0;

              return (
                <div 
                  key={acc.accountName} 
                  className="p-4 rounded-xl border border-slate-800 bg-[#121620] hover:border-emerald-500/50 hover:bg-[#1a212d] transition-all cursor-pointer space-y-3 group"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
                    onNavigateToTransactionsWithFilter({ account: acc.accountName });
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-md">
                          {acc.currency}
                        </span>
                        {isShared && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" /> Shared ({memberCount})
                          </span>
                        )}
                        {matchedAccount?.ownerId && currentUserId && matchedAccount.ownerId !== currentUserId && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 text-[9px] font-bold">Workspace</span>
                        )}
                        {acc.hasCustom && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            Calibrated
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAccountClassification(acc.accountName, false);
                          }}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 hover:text-slate-300 border border-slate-700"
                          title="Classify as Credit Card"
                        >
                          Make Credit Card
                        </button>
                      </div>
                      <h4 className="text-sm font-bold text-slate-100 mt-1.5 flex items-center">
                        {acc.accountName}
                        <ExternalLink className="w-3 h-3 ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </h4>
                    </div>
                    
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSharingAccountName(acc.accountName);
                        }}
                        className="p-1.5 text-purple-300 hover:text-white bg-[#161b22] hover:bg-purple-900/40 border border-purple-500/30 rounded-lg transition-colors text-xs flex items-center"
                        title="Share account with another person"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      {!isEditing ? (
                        <button
                          onClick={() => handleStartEdit(acc.accountName, acc.currentBalance)}
                          className="p-1.5 text-slate-400 hover:text-slate-100 bg-[#161b22] hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-xs flex items-center"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1" />
                          <span className="text-[11px]">Set Balance</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSaveEdit(acc.accountName, acc.currency)}
                          className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-950/80 border border-emerald-800 rounded-lg transition-colors text-xs flex items-center"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          <span className="text-[11px]">Save</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Balance Display or Input */}
                  <div className="bg-[#161b22] p-3 rounded-lg border border-slate-800 space-y-1">
                    <div className="text-[11px] text-slate-400 font-medium flex justify-between">
                      <span>Current Live Balance:</span>
                      <span className="text-slate-500">{acc.txCount} transactions</span>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          step="any"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full px-2 py-1 bg-[#0f131a] border border-slate-600 rounded text-sm font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-lg font-bold text-slate-50">
                          {formatCurrency(acc.balanceOriginal, acc.originalCurrency as DisplayCurrency)}
                        </div>
                        <div className="flex items-center space-x-3 text-[10px]">
                          <div className="flex items-center text-slate-400">
                            <span className="font-medium mr-1 uppercase opacity-60">ARS:</span>
                            <span className="font-mono text-slate-300">{formatCurrency(acc.currentARS, 'ARS')}</span>
                          </div>
                          <div className="flex items-center text-slate-400 border-l border-slate-800 pl-3">
                            <span className="font-medium mr-1 uppercase opacity-60">USD:</span>
                            <span className="font-mono text-slate-300">{formatCurrency(acc.currentUSD, 'USD')}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Asset Distribution */}
        <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-100">Liquid Asset Distribution</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono uppercase">
              By {displayCurrency}
            </span>
          </div>
          
          <div className="h-64 w-full relative">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No positive liquid balances found
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1200}
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                          stroke="#161b22" 
                          strokeWidth={3}
                          className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                          onClick={() => onNavigateToTransactionsWithFilter({ account: entry.name })}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0];
                          const percent = ((Number(data.value) / (displayCurrency === 'USD' ? totalLiquidUSD : totalLiquidARS)) * 100).toFixed(1);
                          return (
                            <div className="bg-[#161b22] border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5">
                              <p className="font-bold text-slate-200">{data.name}</p>
                              <div className="flex justify-between gap-6">
                                <span className="text-slate-400">Balance:</span>
                                <span className="font-bold text-emerald-400">{formatCurrency(Number(data.value), displayCurrency)}</span>
                              </div>
                              <div className="flex justify-between gap-6">
                                <span className="text-slate-400">Share:</span>
                                <span className="font-bold text-slate-300">{percent}%</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Center Content for Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Liquid Total</span>
                  <span className="text-sm font-bold text-slate-100">
                    {formatCurrency(displayCurrency === 'USD' ? totalLiquidUSD : totalLiquidARS, displayCurrency)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Legend / Breakdown List */}
          <div className="mt-4 space-y-2 overflow-y-auto max-h-48 pr-1 custom-scrollbar">
            {pieData.map((entry, index) => {
              const percent = ((entry.value / (displayCurrency === 'USD' ? totalLiquidUSD : totalLiquidARS)) * 100).toFixed(1);
              return (
                <div 
                  key={entry.name}
                  onClick={() => onNavigateToTransactionsWithFilter({ account: entry.name })}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/40 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <div 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-xs text-slate-300 truncate group-hover:text-white transition-colors">{entry.name}</span>
                  </div>
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <span className="text-[11px] font-mono font-bold text-slate-200">{formatCurrency(entry.value, displayCurrency)}</span>
                    <span className="text-[10px] text-slate-500 w-8 text-right">{percent}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Credit Card Detailed View Modal */}
      {selectedCardAccount && (
        <CreditCardDetailModal
          isOpen={!!selectedCardAccount}
          onClose={() => setSelectedCardAccount(null)}
          accountName={selectedCardAccount}
          transactions={filteredTransactions}
          displayCurrency={displayCurrency}
          usdArsRate={usdArsRate}
          closingRule={ccRulesMap[selectedCardAccount] || { ruleType: 'FIXED_DAY', fixedDay: 25 }}
          periodStatusOverrides={periodStatusOverrides}
          onUpdatePeriodStatus={onUpdatePeriodStatus}
          onUpdateClosingRule={(rule) => handleSaveCcRule(selectedCardAccount, rule)}
          onAddTransaction={onAddTransaction}
          onNavigateToTransactionsWithFilter={onNavigateToTransactionsWithFilter}
          onReassignTransactionPeriod={onReassignTransactionPeriod}
        />
      )}

      {/* Share Account Modal */}
      {sharingAccountName && selectedAccountToShare && (
        <ShareAccountModal
          isOpen={!!sharingAccountName}
          onClose={() => setSharingAccountName(null)}
          account={selectedAccountToShare}
          onUpdateAccountSharing={(accName, isShared, sharedMembers) => {
            if (onUpdateAccountSharing) {
              onUpdateAccountSharing(accName, isShared, sharedMembers);
            }
          }}
        />
      )}
    </div>
  );
}

