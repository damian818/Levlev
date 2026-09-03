import React, { useState, useMemo } from 'react';
import { 
  X, Search, CreditCard, Calendar, CheckCircle2, 
  AlertCircle, ChevronDown, ChevronUp, Edit2, 
  Trash2, ArrowRight, ShieldAlert, Check,
  Paperclip, Plus, Sparkles
} from 'lucide-react';
import { InstallmentPlan, Transaction, AccountItem, CategoryItem, DisplayCurrency } from '../types';
import { 
  settlePlanInTransactions, 
  editPlanAndChildren, 
  deleteOrCancelPlan 
} from '../utils/installmentPlans';

interface InstallmentPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: InstallmentPlan[];
  transactions: Transaction[];
  accountsList: AccountItem[];
  categoriesList: CategoryItem[];
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  onUpdatePlans: (updatedPlans: InstallmentPlan[]) => void;
  onUpdateTransactions: (updatedTxs: Transaction[]) => void;
  onDeleteTransactions: (txIds: string[]) => void;
  initialSelectedPlanId?: string;
  onOpenAttachments?: (tx: Transaction) => void;
}

export const InstallmentPlansModal: React.FC<InstallmentPlansModalProps> = ({
  isOpen,
  onClose,
  plans,
  transactions,
  accountsList,
  categoriesList,
  displayCurrency,
  usdArsRate,
  onUpdatePlans,
  onUpdateTransactions,
  onDeleteTransactions,
  initialSelectedPlanId,
  onOpenAttachments,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SETTLED' | 'CANCELLED'>('ALL');
  const [accountFilter, setAccountFilter] = useState<string>('ALL');
  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (initialSelectedPlanId) s.add(initialSelectedPlanId);
    return s;
  });

  // Edit Plan State
  const [editingPlan, setEditingPlan] = useState<InstallmentPlan | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAccount, setEditAccount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [propagateToChildren, setPropagateToChildren] = useState(true);

  // Confirmation Modals
  const [confirmSettlePlan, setConfirmSettlePlan] = useState<InstallmentPlan | null>(null);
  const [confirmDeletePlan, setConfirmDeletePlan] = useState<InstallmentPlan | null>(null);

  // Map transactions by planId
  const txByPlanMap = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    transactions.forEach(tx => {
      const pId = tx.planId || tx.installmentPlanId;
      if (pId) {
        if (!map.has(pId)) map.set(pId, []);
        map.get(pId)!.push(tx);
      }
    });
    // Sort transactions within each plan by date / installment number
    map.forEach(list => {
      list.sort((a, b) => {
        if (a.installmentNumber && b.installmentNumber) {
          return a.installmentNumber - b.installmentNumber;
        }
        return (a.date || '').localeCompare(b.date || '');
      });
    });
    return map;
  }, [transactions]);

  // Expand initial plan if provided
  React.useEffect(() => {
    if (initialSelectedPlanId) {
      setExpandedPlanIds(prev => new Set([...prev, initialSelectedPlanId]));
    }
  }, [initialSelectedPlanId]);

  if (!isOpen) return null;

  const toggleExpand = (planId: string) => {
    setExpandedPlanIds(prev => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  const convertToDisplayCurrency = (amount: number, currency: string) => {
    if (currency === displayCurrency) return amount;
    if (currency === 'ARS' && displayCurrency === 'USD') {
      return usdArsRate > 0 ? amount / usdArsRate : amount;
    }
    if (currency === 'USD' && displayCurrency === 'ARS') {
      return usdArsRate > 0 ? amount * usdArsRate : amount;
    }
    return amount;
  };

  // Metrics computation
  const activePlans = plans.filter(p => p.status === 'ACTIVE');
  const settledPlans = plans.filter(p => p.status === 'SETTLED');

  const totalRemainingDebt = activePlans.reduce((sum, p) => {
    const paid = p.paidInstallments || 0;
    const remainingCount = Math.max(0, p.totalInstallments - paid);
    const remainingAmount = remainingCount * p.installmentAmount;
    return sum + convertToDisplayCurrency(remainingAmount, p.currency);
  }, 0);

  // Monthly commitment for current active month
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const monthlyCommitment = activePlans.reduce((sum, p) => {
    return sum + convertToDisplayCurrency(p.installmentAmount, p.currency);
  }, 0);

  // Filtered plans
  const filteredPlans = plans.filter(p => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (accountFilter !== 'ALL' && p.account !== accountFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchCat = p.category.toLowerCase().includes(q);
      const matchAcc = p.account.toLowerCase().includes(q);
      if (!matchTitle && !matchCat && !matchAcc) return false;
    }
    return true;
  });

  // Action: Open Edit Plan Modal
  const handleOpenEdit = (plan: InstallmentPlan) => {
    setEditingPlan(plan);
    setEditTitle(plan.title);
    setEditCategory(plan.category);
    setEditAccount(plan.account);
    setEditDescription(plan.description || '');
    setPropagateToChildren(true);
  };

  // Action: Save Edit Plan
  const handleSaveEdit = () => {
    if (!editingPlan) return;
    const updates: Partial<InstallmentPlan> = {
      title: editTitle.trim() || editingPlan.title,
      category: editCategory,
      account: editAccount,
      description: editDescription.trim() || undefined,
    };

    if (propagateToChildren) {
      const { updatedTransactions, updatedPlans } = editPlanAndChildren(
        editingPlan.id,
        updates,
        transactions,
        plans
      );
      onUpdatePlans(updatedPlans);
      onUpdateTransactions(updatedTransactions);
    } else {
      const updatedPlans = plans.map(p => p.id === editingPlan.id ? { ...p, ...updates } : p);
      onUpdatePlans(updatedPlans);
    }

    setEditingPlan(null);
  };

  // Action: Settle Entire Plan
  const handleSettlePlan = (plan: InstallmentPlan) => {
    const { updatedTransactions, updatedPlans } = settlePlanInTransactions(
      plan.id,
      transactions,
      plans
    );
    onUpdatePlans(updatedPlans);
    onUpdateTransactions(updatedTransactions);
    setConfirmSettlePlan(null);
  };

  // Action: Delete Plan
  const handleDeletePlan = (plan: InstallmentPlan, mode: 'DELETE_ALL' | 'CANCEL_FUTURE') => {
    const { updatedTransactions, updatedPlans, deletedTxIds } = deleteOrCancelPlan(
      plan.id,
      mode,
      transactions,
      plans
    );
    onUpdatePlans(updatedPlans);
    if (deletedTxIds.length > 0) {
      onDeleteTransactions(deletedTxIds);
    }
    onUpdateTransactions(updatedTransactions);
    setConfirmDeletePlan(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-[#0f131a] border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#141a24] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Installment Plans Management
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                  {plans.length} {plans.length === 1 ? 'Plan' : 'Plans'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Centralized parent-child installment engine. View progress, edit group details, or settle entire commitments.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Metrics */}
        <div className="p-4 sm:p-6 bg-slate-900/40 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="p-3 bg-[#131822] border border-slate-800 rounded-xl">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Active Plans</p>
            <p className="text-lg sm:text-xl font-bold text-white mt-1">{activePlans.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Ongoing installment commitments</p>
          </div>

          <div className="p-3 bg-[#131822] border border-slate-800 rounded-xl">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Outstanding Balance</p>
            <p className="text-lg sm:text-xl font-bold text-amber-400 mt-1">
              {displayCurrency} {Math.round(totalRemainingDebt).toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Total remaining debt across plans</p>
          </div>

          <div className="p-3 bg-[#131822] border border-slate-800 rounded-xl">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Monthly Cuota Burden</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-400 mt-1">
              {displayCurrency} {Math.round(monthlyCommitment).toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Sum of active monthly installments</p>
          </div>

          <div className="p-3 bg-[#131822] border border-slate-800 rounded-xl">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Settled Plans</p>
            <p className="text-lg sm:text-xl font-bold text-blue-400 mt-1">{settledPlans.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Fully completed or paid off</p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-[#10141d] shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative w-full max-w-xs">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search plans, merchants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
              {(['ALL', 'ACTIVE', 'SETTLED', 'CANCELLED'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === status 
                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {status === 'ALL' ? 'All' : status === 'ACTIVE' ? 'Active' : status === 'SETTLED' ? 'Settled' : 'Cancelled'}
                </button>
              ))}
            </div>

            {/* Account Filter */}
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Accounts</option>
              {accountsList.map(a => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Plans List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {filteredPlans.length === 0 ? (
            <div className="p-12 text-center border border-slate-800 rounded-xl bg-slate-900/30 text-slate-500">
              <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-600 opacity-50" />
              <p className="text-sm font-medium text-slate-300">No installment plans found</p>
              <p className="text-xs text-slate-500 mt-1">
                {plans.length === 0 
                  ? 'Add transactions with installments (>1 cuota) to automatically track them here.'
                  : 'Try adjusting your filters or search query.'}
              </p>
            </div>
          ) : (
            filteredPlans.map(plan => {
              const childTxs = txByPlanMap.get(plan.id) || [];
              const isExpanded = expandedPlanIds.has(plan.id);

              // Progress calculation
              const paidCount = plan.paidInstallments || 0;
              const totalCount = plan.totalInstallments || 1;
              const percentPaid = Math.min(100, Math.round((paidCount / totalCount) * 100));
              const remainingCount = Math.max(0, totalCount - paidCount);
              const remainingAmount = remainingCount * plan.installmentAmount;

              return (
                <div
                  key={plan.id}
                  className={`border rounded-2xl transition-all duration-200 overflow-hidden ${
                    plan.status === 'ACTIVE'
                      ? 'bg-[#131822] border-slate-800 hover:border-slate-700/80'
                      : plan.status === 'SETTLED'
                      ? 'bg-[#10151f] border-slate-800/80 opacity-90'
                      : 'bg-[#101217] border-slate-800/60 opacity-70'
                  }`}
                >
                  {/* Plan Card Main Header */}
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Title, Account, Category */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-bold text-white truncate">
                            {plan.title}
                          </h4>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            plan.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : plan.status === 'SETTLED'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {plan.status === 'ACTIVE' ? 'Active' : plan.status === 'SETTLED' ? 'Settled' : 'Cancelled'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 font-medium">
                            {plan.account}
                          </span>
                          <span>&bull;</span>
                          <span className="text-slate-300">{plan.category}</span>
                          <span>&bull;</span>
                          <span>Started: {plan.startDate}</span>
                          {plan.description && (
                            <>
                              <span>&bull;</span>
                              <span className="text-slate-400 italic truncate max-w-xs">{plan.description}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: Amounts and Quick Stats */}
                      <div className="text-left sm:text-right shrink-0">
                        <p className="text-base font-bold text-white">
                          {plan.currency} {plan.totalAmount.toLocaleString()}
                        </p>
                        <p className="text-xs text-emerald-400 font-medium mt-0.5">
                          {plan.totalInstallments} cuotas of {plan.currency} {plan.installmentAmount.toLocaleString()}
                        </p>
                        {plan.status === 'ACTIVE' && remainingCount > 0 && (
                          <p className="text-[11px] text-amber-400 font-medium mt-0.5">
                            Remaining: {plan.currency} {remainingAmount.toLocaleString()} ({remainingCount} cuotas left)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                        <span className="flex items-center gap-1.5 font-medium">
                          Progress: <span className="text-slate-200 font-semibold">{paidCount} / {totalCount}</span> cuotas completed
                        </span>
                        <span className="font-semibold text-slate-300">{percentPaid}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${
                            plan.status === 'SETTLED' 
                              ? 'bg-blue-500' 
                              : plan.status === 'CANCELLED'
                              ? 'bg-slate-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percentPaid}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                      <button
                        onClick={() => toggleExpand(plan.id)}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {isExpanded ? 'Hide Cuotas' : `View All Cuotas (${childTxs.length})`}
                      </button>

                      <div className="flex items-center gap-2">
                        {/* Settle Plan */}
                        {plan.status === 'ACTIVE' && (
                          <button
                            onClick={() => setConfirmSettlePlan(plan)}
                            className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg flex items-center gap-1.5 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Settle Entire Plan
                          </button>
                        )}

                        {/* Edit Plan */}
                        <button
                          onClick={() => handleOpenEdit(plan)}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit Plan
                        </button>

                        {/* Delete / Cancel Plan */}
                        <button
                          onClick={() => setConfirmDeletePlan(plan)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                          title="Cancel or Delete Plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Child Transactions Table */}
                  {isExpanded && (
                    <div className="bg-[#0b0e14] border-t border-slate-800 px-4 py-3 sm:px-6">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Individual Installment Transactions ({childTxs.length})
                      </h5>
                      {childTxs.length === 0 ? (
                        <p className="text-xs text-slate-500 py-3">No individual transaction records linked to this plan.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead>
                              <tr className="border-b border-slate-800/80 text-slate-500 font-medium">
                                <th className="pb-2 font-medium">Cuota</th>
                                <th className="pb-2 font-medium">Date</th>
                                <th className="pb-2 font-medium">Amount</th>
                                <th className="pb-2 font-medium">Status</th>
                                <th className="pb-2 font-medium text-right">Attachments</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              {childTxs.map(tx => {
                                const isTxPaid = tx.isPaid || (tx.date && tx.date <= new Date().toISOString().substring(0, 10));
                                const hasAttachments = tx.attachments && tx.attachments.length > 0;

                                return (
                                  <tr key={tx.id} className="hover:bg-slate-900/40">
                                    <td className="py-2.5 font-semibold text-white">
                                      {tx.installments || (tx.installmentNumber ? `${tx.installmentNumber}/${plan.totalInstallments}` : 'Cuota')}
                                    </td>
                                    <td className="py-2.5 text-slate-400">{tx.date}</td>
                                    <td className="py-2.5 font-medium">
                                      {tx.currency} {tx.amount.toLocaleString()}
                                    </td>
                                    <td className="py-2.5">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                        isTxPaid 
                                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                      }`}>
                                        {isTxPaid ? 'Paid' : 'Pending'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 text-right">
                                      {hasAttachments ? (
                                        <button
                                          onClick={() => onOpenAttachments && onOpenAttachments(tx)}
                                          className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20"
                                        >
                                          <Paperclip className="w-3 h-3" /> {tx.attachments!.length}
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => onOpenAttachments && onOpenAttachments(tx)}
                                          className="text-slate-600 hover:text-slate-400 p-1"
                                          title="Add Attachment"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end bg-[#141a24] shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div 
          className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setEditingPlan(null)}
        >
          <div 
            className="bg-[#111620] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" /> Edit Installment Plan
              </h4>
              <button onClick={() => setEditingPlan(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Plan Title / Merchant</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  {categoriesList.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Account</label>
                <select
                  value={editAccount}
                  onChange={(e) => setEditAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  {accountsList.map(a => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Description / Notes</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={propagateToChildren}
                    onChange={(e) => setPropagateToChildren(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 bg-slate-900"
                  />
                  <span>Propagate edits to all {editingPlan.totalInstallments} installment transactions</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingPlan(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-900/30"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Plan Confirmation Modal */}
      {confirmSettlePlan && (
        <div 
          className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setConfirmSettlePlan(null)}
        >
          <div 
            className="bg-[#111620] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-base font-bold text-white">Settle Remaining Installments?</h4>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to mark all remaining installments of &ldquo;<span className="text-slate-200 font-semibold">{confirmSettlePlan.title}</span>&rdquo; as paid today?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                onClick={() => setConfirmSettlePlan(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSettlePlan(confirmSettlePlan)}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-900/30"
              >
                Yes, Settle Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Cancel Plan Confirmation Modal */}
      {confirmDeletePlan && (
        <div 
          className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setConfirmDeletePlan(null)}
        >
          <div 
            className="bg-[#111620] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Manage Plan Deletion</h4>
                <p className="text-xs text-slate-400 truncate max-w-xs">{confirmDeletePlan.title}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              How would you like to handle this installment plan? You can cancel only future installments or permanently remove the entire plan and its transactions.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => handleDeletePlan(confirmDeletePlan, 'CANCEL_FUTURE')}
                className="w-full text-left p-3 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-900 transition-colors group"
              >
                <p className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400">
                  Cancel Future Cuotas Only
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Keep past/paid installments recorded in history, cancel future unpaid ones.
                </p>
              </button>

              <button
                onClick={() => handleDeletePlan(confirmDeletePlan, 'DELETE_ALL')}
                className="w-full text-left p-3 rounded-xl border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 transition-colors group"
              >
                <p className="text-xs font-semibold text-red-400">
                  Delete Entire Group & All Cuotas
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Permanently remove the parent plan and all {confirmDeletePlan.totalInstallments} child transactions.
                </p>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setConfirmDeletePlan(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
