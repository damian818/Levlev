import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, DisplayCurrency, AccountCustomBalance, TransactionFilter, CreditCardClosingRule, AccountItem, SharedMember } from '../types';
import { computeAccountBalances, formatCurrency, isCreditCardAccount, getCreditCardStatements, getCurrentStatement, getNextCloseDate, getClosingRuleLabel, getTodayString, getTransferOutflow, getTransferInflow } from '../utils/financeUtils';
import { Wallet, DollarSign, Landmark, Edit3, Check, RotateCcw, HelpCircle, History, ArrowRightLeft, ExternalLink, CreditCard, ChevronRight, AlertCircle, Sparkles, Calendar, Settings, Users, Share2, UserPlus, ArrowUp, ArrowDown, Eye, EyeOff, MoreVertical, Trash2, Building2, Coins, GripVertical } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { motion, Reorder } from 'motion/react';
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
  onReorderAccounts?: (accounts: AccountItem[]) => void;
  currentUserId?: string;
  showSharedData?: boolean;
  userTimezone?: string;
}

const COLORS = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#f43f5e', '#38bdf8', '#818cf8', '#fb7185'];

const getAccountIcon = (type: string, icon?: string) => {
  const className = "w-5 h-5";
  switch (icon) {
    case 'bank': return <Building2 className={className} />;
    case 'card': return <CreditCard className={className} />;
    case 'cash': return <Coins className={className} />;
    case 'wallet': return <Wallet className={className} />;
    case 'landmark': return <Landmark className={className} />;
    case 'other': return <HelpCircle className={className} />;
    default:
      return type === 'CREDIT_CARD' ? <CreditCard className={className} /> : <Landmark className={className} />;
  }
};

export const AccountsTab = React.memo(function AccountsTab({
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
  onReorderAccounts,
  currentUserId,
  showSharedData = true,
  userTimezone = 'America/Argentina/Buenos_Aires',
}: AccountsTabProps) {
  const { t } = useTranslation();
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleMoveAccount = (accName: string, direction: 'up' | 'down') => {
    if (!onReorderAccounts || !accounts || accounts.length < 2) return;
    let index = accounts.findIndex(a => a.name.toLowerCase() === accName.toLowerCase());
    
    // If account is not in the explicit accounts list (auto-detected), add it first
    if (index === -1) {
      const summary = liquidAccounts.find(a => a.accountName.toLowerCase() === accName.toLowerCase()) || 
                      creditCardAccounts.find(a => a.accountName.toLowerCase() === accName.toLowerCase());
      if (summary && onAddAccount) {
        const newAcc: AccountItem = {
          id: `acc-${Date.now()}`,
          name: summary.accountName,
          type: summary.isCreditCard ? 'CREDIT_CARD' : 'CHECKING',
          currency: summary.currency,
          order: accounts.length
        };
        onAddAccount(newAcc);
        // We can't immediately reorder because the state update is async, 
        // but adding it ensures the next reorder attempt will work.
        // Actually, let's try to do it in one go if possible, but the parent handleReorderAccounts 
        // expects the full list. For now, adding it is a good first step.
        return;
      }
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= accounts.length) return;

    const newAccounts = [...accounts];
    const [moved] = newAccounts.splice(index, 1);
    newAccounts.splice(targetIndex, 0, moved);
    onReorderAccounts(newAccounts);
  };

  const handleReorderLiquidAccounts = (newOrder: typeof liquidAccounts) => {
    if (!onReorderAccounts) return;
    const ccItems = accounts.filter(a => a.type === 'CREDIT_CARD');
    const reorderedItems = newOrder.map(re => accounts.find(a => a.name === re.accountName)).filter(Boolean) as AccountItem[];
    // Find liquid items that might not be in the reordered list (unlikely)
    const missingItems = accounts.filter(a => a.type !== 'CREDIT_CARD' && !reorderedItems.find(r => r.name === a.name));
    onReorderAccounts([...ccItems, ...reorderedItems, ...missingItems]);
  };

  const handleReorderCreditCardAccounts = (newOrder: typeof creditCardAccounts) => {
    if (!onReorderAccounts) return;
    const liquidItems = accounts.filter(a => a.type !== 'CREDIT_CARD');
    const reorderedItems = newOrder.map(re => accounts.find(a => a.name === re.accountName)).filter(Boolean) as AccountItem[];
    const missingItems = accounts.filter(a => a.type === 'CREDIT_CARD' && !reorderedItems.find(r => r.name === a.name));
    onReorderAccounts([...reorderedItems, ...missingItems, ...liquidItems]);
  };

  const handleToggleHideFromNewTx = (accName: string) => {
    const existingAcc = accounts?.find(a => a.name.toLowerCase() === accName.toLowerCase());
    if (existingAcc) {
      if (onEditAccount) {
        onEditAccount(existingAcc.name, { ...existingAcc, isHiddenFromNewTx: !existingAcc.isHiddenFromNewTx }, false);
      }
    } else if (onAddAccount) {
      onAddAccount({
        id: `acc-${Date.now()}`,
        name: accName,
        type: 'CHECKING',
        currency: accName.toLowerCase().includes('usd') ? 'USD' : 'ARS',
        isHiddenFromNewTx: true,
      });
    }
  };

  // Selected credit card for detail modal
  const [selectedCardAccount, setSelectedCardAccount] = useState<string | null>(null);

  // Selected account for sharing modal
  const [sharingAccountName, setSharingAccountName] = useState<string | null>(null);

  const handleSaveCcRule = (accName: string, rule: CreditCardClosingRule) => {
    const existingAcc = accounts.find(a => a.name.toLowerCase() === accName.toLowerCase());
    if (existingAcc && onEditAccount) {
      onEditAccount(existingAcc.name, { ...existingAcc, closingRule: rule }, false);
    }
  };

  const toggleAccountClassification = (accName: string, currentIsCC: boolean) => {
    const nextIsCC = !currentIsCC;

    const existingAcc = accounts.find(a => a.name.toLowerCase() === accName.toLowerCase());
    if (existingAcc && onEditAccount) {
      onEditAccount(existingAcc.name, { ...existingAcc, type: nextIsCC ? 'CREDIT_CARD' : 'CHECKING' }, false);
    } else if (onAddAccount) {
      onAddAccount({
        id: `acc-${Date.now()}`,
        name: accName,
        type: nextIsCC ? 'CREDIT_CARD' : 'CHECKING',
        currency: accName.toLowerCase().includes('usd') ? 'USD' : 'ARS',
        closingRule: { ruleType: 'FIXED_DAY', fixedDay: 25 },
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
  const computedSummaries = useMemo(() => 
    computeAccountBalances(filteredTransactions, usdArsRate, customBalances, filteredAccountItems),
    [filteredTransactions, usdArsRate, customBalances, filteredAccountItems]
  );

  // Reconstructed summary list with Credit Card classification
  const reconstructedAccounts = useMemo(() => {
    return computedSummaries.map(summary => {
      const name = summary.accountName;
      const currency = summary.originalCurrency;
      const isUsd = currency.toUpperCase().includes('USD');
      const currentBalance = summary.balanceOriginal;
      const currentARS = summary.balanceARS;
      const currentUSD = summary.balanceUSD;

      const accItem = accounts.find(a => a.name === name);
      const isCC = accItem?.type === 'CREDIT_CARD' || isCreditCardAccount(name, [], accounts);
      const accountRule = accItem?.closingRule || { ruleType: 'FIXED_DAY', fixedDay: 25 };
      const icon = accItem?.icon;

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
        icon,
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
  }, [computedSummaries, filteredTransactions, accounts, periodStatusOverrides, customBalances]);

  // Separate Liquid Accounts vs Credit Card Accounts
  const liquidAccounts = useMemo(() => reconstructedAccounts.filter(a => !a.isCreditCard), [reconstructedAccounts]);
  const creditCardAccounts = useMemo(() => reconstructedAccounts.filter(a => a.isCreditCard), [reconstructedAccounts]);

  // Totals calculations
  const { totalLiquidARS, totalLiquidUSD, totalCcDebtARS, totalCcDebtUSD } = useMemo(() => {
    const liqARS = liquidAccounts.reduce((acc, curr) => acc + curr.currentARS, 0);
    const liqUSD = liquidAccounts.reduce((acc, curr) => acc + curr.currentUSD, 0);

    const debtARS = creditCardAccounts.reduce((acc, curr) => {
      const debt = curr.currentStatement ? Math.max(0, curr.currentStatement.netDue) : Math.abs(Math.min(0, curr.currentBalance));
      const dARS = curr.isUsd ? debt * usdArsRate : debt;
      return acc + dARS;
    }, 0);

    const debtUSD = usdArsRate > 0 ? debtARS / usdArsRate : 0;

    return {
      totalLiquidARS: liqARS,
      totalLiquidUSD: liqUSD,
      totalCcDebtARS: debtARS,
      totalCcDebtUSD: debtUSD
    };
  }, [liquidAccounts, creditCardAccounts, usdArsRate]);

  const netWorthARS = totalLiquidARS - totalCcDebtARS;
  const netWorthUSD = totalLiquidUSD - totalCcDebtUSD;

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  const handleSetAccountIcon = (accName: string, icon: 'bank' | 'card' | 'cash' | 'wallet' | 'landmark' | 'other') => {
    const existingAcc = accounts.find(a => a.name.toLowerCase() === accName.toLowerCase());
    if (existingAcc && onEditAccount) {
      onEditAccount(existingAcc.name, { ...existingAcc, icon }, false);
    } else if (onAddAccount) {
      onAddAccount({
        id: `acc-${Date.now()}`,
        name: accName,
        type: accName.toLowerCase().includes('card') ? 'CREDIT_CARD' : 'CHECKING',
        currency: accName.toLowerCase().includes('usd') ? 'USD' : 'ARS',
        icon
      });
    }
  };

  const selectedAccountToShare = useMemo(() => {
    if (!sharingAccountName) return null;
    const found = accounts?.find(a => a.name === sharingAccountName);
    if (found) return found;
    return {
      id: `acc_${sharingAccountName}`,
      name: sharingAccountName,
      type: (accounts.find(a => a.name === sharingAccountName)?.type === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'CHECKING') as any,
      currency: liquidAccounts.find(a => a.accountName === sharingAccountName)?.currency || creditCardAccounts.find(a => a.accountName === sharingAccountName)?.currency || 'ARS',
      isShared: false,
      sharedMembers: [],
    };
  }, [sharingAccountName, accounts, liquidAccounts, creditCardAccounts]);

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
              <span>{t('accounts.management_title')}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                {t('accounts.credit_cards_isolated')}
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('accounts.management_sub')}
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
            <span>{isWorkspaceShared ? t('accounts.shared_household', { count: workspaceMembersCount }) : t('accounts.share_full_household')}</span>
          </button>
        )}
      </div>

      {/* Financial Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t('accounts.liquid_bank_cash')}</p>
            <h3 className="text-xl font-bold text-emerald-400 mt-1">
              {formatCurrency(displayCurrency === 'USD' ? totalLiquidUSD : totalLiquidARS, displayCurrency)}
            </h3>
            <span className="text-[10px] text-slate-500 mt-1 block">{t('accounts.available_funds')}</span>
          </div>
          <div className="p-3 bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 rounded-xl shadow-inner">
            <Landmark className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t('accounts.card_statement_debt')}</p>
            <h3 className="text-xl font-bold text-amber-400 mt-1">
              {formatCurrency(displayCurrency === 'USD' ? totalCcDebtUSD : totalCcDebtARS, displayCurrency)}
            </h3>
            <span className="text-[10px] text-slate-500 mt-1 block">{t('accounts.pending_liabilities')}</span>
          </div>
          <div className="p-3 bg-amber-950/80 border border-amber-800/60 text-amber-300 rounded-xl shadow-inner">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t('accounts.net_liquid_wealth')}</p>
            <h3 className={`text-xl font-bold mt-1 ${netWorthARS >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
              {formatCurrency(displayCurrency === 'USD' ? netWorthUSD : netWorthARS, displayCurrency)}
            </h3>
            <span className="text-[10px] text-slate-500 mt-1 block">{t('accounts.liquid_minus_debt')}</span>
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
              <span>{t('accounts.credit_cards_cycles')}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {t('accounts.credit_cards_sub')}
            </p>
          </div>
        </div>

        {creditCardAccounts.length === 0 ? (
          <div className="p-6 text-center text-slate-500 bg-[#121620] rounded-xl border border-slate-800 text-xs">
            {t('accounts.no_cc_accounts')}
          </div>
        ) : (
          <Reorder.Group 
            axis="y" 
            values={creditCardAccounts} 
            onReorder={handleReorderCreditCardAccounts}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {creditCardAccounts.map((acc) => {
              const stmt = acc.currentStatement;
              const netDue = stmt ? stmt.netDue : 0;
              const nextClose = acc.nextCloseDate || stmt?.closeDate;

              const matchedAccount = accounts?.find(a => a.name === acc.accountName);
              const isShared = matchedAccount?.isShared || (matchedAccount?.sharedMembers && matchedAccount.sharedMembers.length > 0);
              const memberCount = matchedAccount?.sharedMembers?.length || 0;
              const menuId = `cc-${acc.accountName}`;

              return (
                <Reorder.Item
                  key={acc.accountName}
                  value={acc}
                  className="p-4 rounded-2xl border border-slate-800 bg-[#121620] hover:bg-[#1a212d] transition-all shadow-sm flex flex-col relative group cursor-grab active:cursor-grabbing"
                >
                  {/* Drag Handle Overlay */}
                  <div className="absolute top-4 right-12 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-600">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Card Content */}
                  <div className="flex-1 space-y-4">
                    {/* Top Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                          {getAccountIcon('CREDIT_CARD', acc.icon)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-100 truncate">{acc.accountName}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] font-bold uppercase text-purple-300/80">
                              {acc.currency}
                            </span>
                            {isShared && (
                              <span className="w-1 h-1 rounded-full bg-slate-700" />
                            )}
                            {isShared && (
                              <span className="text-[9px] font-bold text-purple-400 flex items-center gap-1">
                                <Users className="w-2.5 h-2.5" /> {memberCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {matchedAccount?.isHiddenFromNewTx && (
                          <div className="p-1 rounded-lg bg-amber-500/10 text-amber-500/80" title={t('accounts.hidden')}>
                            <EyeOff className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === menuId ? null : menuId); }}
                            className="p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuId === menuId && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-full mt-1 w-48 bg-[#1c2128] border border-slate-700 rounded-xl shadow-2xl z-20 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleMoveAccount(acc.accountName, 'up'); setOpenMenuId(null); }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" /> {t('accounts.move_up')}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleMoveAccount(acc.accountName, 'down'); setOpenMenuId(null); }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" /> {t('accounts.move_down')}
                                </button>
                                <div className="h-px bg-slate-800 my-1" />
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleToggleHideFromNewTx(acc.accountName); setOpenMenuId(null); }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  {matchedAccount?.isHiddenFromNewTx ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                  {matchedAccount?.isHiddenFromNewTx ? t('accounts.visible') : t('accounts.hidden')}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setSharingAccountName(acc.accountName); setOpenMenuId(null); }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <Share2 className="w-3.5 h-3.5" /> {t('accounts.share')}
                                </button>
                                <div className="h-px bg-slate-800 my-1" />
                                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  {t('accounts.select_icon', { defaultValue: 'Select Icon' })}
                                </div>
                                <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                                  {[
                                    { id: 'bank', icon: Building2 },
                                    { id: 'card', icon: CreditCard },
                                    { id: 'cash', icon: Coins },
                                    { id: 'wallet', icon: Wallet },
                                    { id: 'landmark', icon: Landmark },
                                    { id: 'other', icon: HelpCircle }
                                  ].map((iconData) => (
                                    <button
                                      key={iconData.id}
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleSetAccountIcon(acc.accountName, iconData.id as any); setOpenMenuId(null); }}
                                      className={`p-2 rounded-lg border transition-all hover:bg-slate-700 flex items-center justify-center ${
                                        acc.icon === iconData.id 
                                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' 
                                          : 'bg-slate-800 border-slate-700 text-slate-400'
                                      }`}
                                      title={iconData.id}
                                    >
                                      <iconData.icon className="w-3.5 h-3.5" />
                                    </button>
                                  ))}
                                </div>
                                <div className="h-px bg-slate-800 my-1" />
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleAccountClassification(acc.accountName, true); setOpenMenuId(null); }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <Settings className="w-3.5 h-3.5" /> {t('accounts.to_bank')}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Balance Display */}
                    <div>
                      <div className="text-2xl font-bold text-slate-100 tracking-tight">
                        {formatCurrency(netDue, acc.originalCurrency as DisplayCurrency)}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wider">
                        {t('accounts.current_statement_due')}
                      </p>
                    </div>

                    {/* Meta Grid */}
                    <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-800/60">
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">
                          {t('accounts.closing_schedule')}
                        </span>
                        <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" /> {getClosingRuleLabel(acc.closingRule)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">
                          {t('accounts.next_close_label')}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-300">
                          {nextClose || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800/40">
                    <button
                      type="button"
                      onClick={() => setSelectedCardAccount(acc.accountName)}
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2"
                    >
                      <span>{t('accounts.details')}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liquid Accounts List & Balance Editor */}
        <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-400" />
                <span>{t('accounts.liquid_accounts_title')}</span>
              </h3>
              <p className="text-xs text-slate-400">{t('accounts.liquid_accounts_sub')}</p>
            </div>
          </div>

          <Reorder.Group 
            axis="y" 
            values={liquidAccounts} 
            onReorder={handleReorderLiquidAccounts}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {liquidAccounts.map((acc) => {
              const isEditing = editingAccount === acc.accountName;

              const matchedAccount = accounts?.find(a => a.name === acc.accountName);
              const isShared = matchedAccount?.isShared || (matchedAccount?.sharedMembers && matchedAccount.sharedMembers.length > 0);
              const memberCount = matchedAccount?.sharedMembers?.length || 0;
              const menuId = `liquid-${acc.accountName}`;

              return (
                <Reorder.Item 
                  key={acc.accountName} 
                  value={acc}
                  className="p-4 rounded-2xl border border-slate-800 bg-[#121620] hover:bg-[#1a212d] transition-all cursor-pointer shadow-sm flex flex-col relative group cursor-grab active:cursor-grabbing"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
                    onNavigateToTransactionsWithFilter({ account: acc.accountName });
                  }}
                >
                  {/* Drag Handle Overlay */}
                  <div className="absolute top-4 right-12 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-600">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div className="flex-1 space-y-4">
                    {/* Top Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          {getAccountIcon('CHECKING', acc.icon)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-100 truncate flex items-center">
                            <span>{acc.accountName}</span>
                            <ExternalLink className="w-3 h-3 ml-1.5 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] font-bold uppercase text-emerald-300/80">
                              {acc.currency}
                            </span>
                            {isShared && (
                              <span className="w-1 h-1 rounded-full bg-slate-700" />
                            )}
                            {isShared && (
                              <span className="text-[9px] font-bold text-purple-400 flex items-center gap-1">
                                <Users className="w-2.5 h-2.5" /> {memberCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {matchedAccount?.isHiddenFromNewTx && (
                          <div className="p-1 rounded-lg bg-amber-500/10 text-amber-500/80" title={t('accounts.hidden')}>
                            <EyeOff className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === menuId ? null : menuId); }}
                            className="p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuId === menuId && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-full mt-1 w-48 bg-[#1c2128] border border-slate-700 rounded-xl shadow-2xl z-20 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleMoveAccount(acc.accountName, 'up'); setOpenMenuId(null); }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" /> {t('accounts.move_up')}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleMoveAccount(acc.accountName, 'down'); setOpenMenuId(null); }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" /> {t('accounts.move_down')}
                                </button>
                                <div className="h-px bg-slate-800 my-1" />
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleToggleHideFromNewTx(acc.accountName); setOpenMenuId(null); }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  {matchedAccount?.isHiddenFromNewTx ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                  {matchedAccount?.isHiddenFromNewTx ? t('accounts.visible') : t('accounts.hidden')}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setSharingAccountName(acc.accountName); setOpenMenuId(null); }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <Share2 className="w-3.5 h-3.5" /> {t('accounts.share')}
                                </button>
                                <div className="h-px bg-slate-800 my-1" />
                                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  {t('accounts.select_icon', { defaultValue: 'Select Icon' })}
                                </div>
                                <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                                  {[
                                    { id: 'bank', icon: Building2 },
                                    { id: 'card', icon: CreditCard },
                                    { id: 'cash', icon: Coins },
                                    { id: 'wallet', icon: Wallet },
                                    { id: 'landmark', icon: Landmark },
                                    { id: 'other', icon: HelpCircle }
                                  ].map((iconData) => (
                                    <button
                                      key={iconData.id}
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleSetAccountIcon(acc.accountName, iconData.id as any); setOpenMenuId(null); }}
                                      className={`p-2 rounded-lg border transition-all hover:bg-slate-700 flex items-center justify-center ${
                                        acc.icon === iconData.id 
                                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' 
                                          : 'bg-slate-800 border-slate-700 text-slate-400'
                                      }`}
                                      title={iconData.id}
                                    >
                                      <iconData.icon className="w-3.5 h-3.5" />
                                    </button>
                                  ))}
                                </div>
                                <div className="h-px bg-slate-800 my-1" />
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleAccountClassification(acc.accountName, false); setOpenMenuId(null); }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <Settings className="w-3.5 h-3.5" /> {t('accounts.to_card')}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Balance Display */}
                    <div>
                      {isEditing ? (
                        <div className="flex items-center space-x-2 my-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xl text-slate-500 font-bold">$</span>
                          <input
                            type="number"
                            step="any"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-3 py-2 bg-[#0a0c10] border border-emerald-500/50 rounded-xl text-xl font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="text-2xl font-bold text-slate-100 tracking-tight">
                          {formatCurrency(acc.balanceOriginal, acc.originalCurrency as DisplayCurrency)}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                          {t('accounts.live_balance')}
                        </p>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {t('accounts.transactions_count', { count: acc.txCount })}
                        </span>
                      </div>
                    </div>

                    {/* Meta Grid (ARS/USD conversion) */}
                    <div className="grid grid-cols-2 gap-4 py-3 border-t border-slate-800/40">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">
                          ARS
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-300">
                          {formatCurrency(acc.currentARS, 'ARS')}
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">
                          USD
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-300">
                          {formatCurrency(acc.currentUSD, 'USD')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800/40">
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleStartEdit(acc.accountName, acc.currentBalance); }}
                        className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{t('accounts.set_balance')}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSaveEdit(acc.accountName, acc.currency); }}
                        className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('common.save')}</span>
                      </button>
                    )}
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </div>

        {/* Asset Distribution */}
        <div className="bg-[#161b22] p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-100">{t('accounts.liquid_distribution')}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono uppercase">
              {t('accounts.by_currency', { currency: displayCurrency })}
            </span>
          </div>
          
          <div className="h-64 w-full relative">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                {t('accounts.no_positive_balances')}
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
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
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
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">{t('accounts.liquid_total')}</span>
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
          closingRule={accounts.find(a => a.name === selectedCardAccount)?.closingRule || { ruleType: 'FIXED_DAY', fixedDay: 25 }}
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
});

