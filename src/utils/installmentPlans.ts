import { InstallmentPlan, Transaction } from '../types';

/**
 * Normalizes title for grouping legacy installment transactions
 */
function normalizeKey(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/\(cuota\s+\d+\/\d+\)/gi, '')
    .replace(/cuota\s+\d+\/\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Synchronizes and discovers Installment Plans from existing plans and transactions.
 * If legacy transactions exist without a parent planId, parent plans are synthesized automatically.
 */
export function buildOrSyncInstallmentPlans(
  existingPlans: InstallmentPlan[] = [],
  transactions: Transaction[] = []
): { plans: InstallmentPlan[]; updatedTransactions: Transaction[] } {
  const planMap = new Map<string, InstallmentPlan>();
  (existingPlans || []).forEach(p => {
    if (p && p.id) {
      planMap.set(p.id, { ...p });
    }
  });

  const txByPlanId = new Map<string, Transaction[]>();
  const unlinkedInstallmentTxs: Transaction[] = [];
  const updatedTransactions = [...transactions];
  let hasTxUpdates = false;

  // 1. Group transactions with explicit planId
  updatedTransactions.forEach(tx => {
    const pId = tx.planId || tx.installmentPlanId;
    if (pId) {
      if (!txByPlanId.has(pId)) txByPlanId.set(pId, []);
      txByPlanId.get(pId)!.push(tx);
    } else if (
      tx.type === 'EXPENSE' &&
      ((tx.totalInstallments && tx.totalInstallments > 1) ||
       (tx.installments && tx.installments.includes('/')))
    ) {
      unlinkedInstallmentTxs.push(tx);
    }
  });

  // 2. Discover/synthesize plans for unlinked legacy installment transactions
  const legacyGroups = new Map<string, Transaction[]>();
  unlinkedInstallmentTxs.forEach(tx => {
    let totalInst = tx.totalInstallments;
    if (!totalInst && tx.installments && tx.installments.includes('/')) {
      const parts = tx.installments.split('/');
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed) && parsed > 1) totalInst = parsed;
    }
    const safeTotal = totalInst || 1;
    const baseTitle = normalizeKey(tx.title);
    const key = `${baseTitle}__${tx.account}__${tx.currency || 'ARS'}__${safeTotal}`;

    if (!legacyGroups.has(key)) {
      legacyGroups.set(key, []);
    }
    legacyGroups.get(key)!.push(tx);
  });

  // Match or synthesize plans for legacy groups
  legacyGroups.forEach((groupTxs, groupKey) => {
    const firstTx = groupTxs[0];
    const baseTitle = normalizeKey(firstTx.title);
    
    // Check if an existing plan matches this group
    let matchingPlan = Array.from(planMap.values()).find(p => {
      return (
        normalizeKey(p.title) === baseTitle &&
        p.account === firstTx.account &&
        p.currency === (firstTx.currency || 'ARS')
      );
    });

    if (!matchingPlan) {
      // Create synthetic parent plan
      const planId = `plan_${firstTx.id.replace(/-[0-9]+$/, '')}_${Date.now().toString(36)}`;
      let totalInst = firstTx.totalInstallments;
      if (!totalInst && firstTx.installments && firstTx.installments.includes('/')) {
        const p = parseInt(firstTx.installments.split('/')[1], 10);
        if (!isNaN(p)) totalInst = p;
      }
      totalInst = totalInst || groupTxs.length || 1;

      const totalAmount = firstTx.originalAmount || (firstTx.amount * totalInst);

      // Earliest date
      const sortedTxs = [...groupTxs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const startDate = sortedTxs[0]?.date || new Date().toISOString().substring(0, 10);

      matchingPlan = {
        id: planId,
        title: firstTx.title.replace(/\s*\(cuota\s+\d+\/\d+\)/gi, '').trim() || 'Installment Plan',
        category: firstTx.category || 'General',
        account: firstTx.account,
        totalAmount: Math.round(totalAmount * 100) / 100,
        installmentAmount: firstTx.amount,
        currency: firstTx.currency || 'ARS',
        totalInstallments: totalInst,
        startDate: startDate,
        status: 'ACTIVE',
        description: firstTx.description || undefined,
        statementCloseDate: firstTx.statementCloseDate || undefined,
        createdAt: firstTx.timestamp || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      planMap.set(planId, matchingPlan);
    }

    // Attach planId to these child transactions
    groupTxs.forEach(gtx => {
      gtx.planId = matchingPlan!.id;
      gtx.installmentPlanId = matchingPlan!.id;
      hasTxUpdates = true;
      if (!txByPlanId.has(matchingPlan!.id)) txByPlanId.set(matchingPlan!.id, []);
      txByPlanId.get(matchingPlan!.id)!.push(gtx);
    });
  });

  // 3. Compute stats (paid count, status) for all plans
  const todayStr = new Date().toISOString().substring(0, 10);

  const finalPlans = Array.from(planMap.values()).map(plan => {
    const childTxs = txByPlanId.get(plan.id) || [];
    
    // Count paid installments
    let paidCount = 0;
    childTxs.forEach(tx => {
      if (tx.isPaid || (tx.date && tx.date <= todayStr)) {
        paidCount++;
      }
    });

    // If total installments reached and not manually cancelled, mark settled
    let status = plan.status;
    if (status !== 'CANCELLED') {
      if (paidCount >= plan.totalInstallments && plan.totalInstallments > 0) {
        status = 'SETTLED';
      } else {
        status = 'ACTIVE';
      }
    }

    return {
      ...plan,
      paidInstallments: Math.min(paidCount, plan.totalInstallments),
      status,
    };
  });

  return {
    plans: finalPlans,
    updatedTransactions: hasTxUpdates ? updatedTransactions : transactions,
  };
}

/**
 * Settles all remaining future installments for an entire plan
 */
export function settlePlanInTransactions(
  planId: string,
  transactions: Transaction[],
  plans: InstallmentPlan[]
): { updatedTransactions: Transaction[]; updatedPlans: InstallmentPlan[] } {
  const targetPlan = plans.find(p => p.id === planId);
  const nowStr = new Date().toISOString();

  const updatedPlans = plans.map(p => {
    if (p.id === planId) {
      return {
        ...p,
        status: 'SETTLED' as const,
        paidInstallments: p.totalInstallments,
        updatedAt: nowStr,
      };
    }
    return p;
  });

  const updatedTransactions = transactions.map(tx => {
    if (tx.planId === planId || tx.installmentPlanId === planId) {
      return {
        ...tx,
        isPaid: true,
      };
    }
    // Also match by plan title & account if legacy
    if (targetPlan && normalizeKey(tx.title) === normalizeKey(targetPlan.title) && tx.account === targetPlan.account) {
      return {
        ...tx,
        isPaid: true,
        planId,
      };
    }
    return tx;
  });

  return { updatedTransactions, updatedPlans };
}

/**
 * Propagates edits on the parent plan (title, category, account, notes) to all child transactions
 */
export function editPlanAndChildren(
  planId: string,
  updates: Partial<InstallmentPlan>,
  transactions: Transaction[],
  plans: InstallmentPlan[]
): { updatedTransactions: Transaction[]; updatedPlans: InstallmentPlan[] } {
  const nowStr = new Date().toISOString();

  const updatedPlans = plans.map(p => {
    if (p.id === planId) {
      return {
        ...p,
        ...updates,
        updatedAt: nowStr,
      };
    }
    return p;
  });

  const updatedTransactions = transactions.map(tx => {
    if (tx.planId === planId || tx.installmentPlanId === planId) {
      const nextTitle = updates.title 
        ? (tx.installmentNumber && tx.totalInstallments 
            ? `${updates.title} (Cuota ${tx.installmentNumber}/${tx.totalInstallments})` 
            : updates.title)
        : tx.title;

      return {
        ...tx,
        title: nextTitle,
        category: updates.category || tx.category,
        account: updates.account || tx.account,
        description: updates.description !== undefined ? updates.description : tx.description,
      };
    }
    return tx;
  });

  return { updatedTransactions, updatedPlans };
}

/**
 * Cancels or deletes an installment plan and its child transactions
 */
export function deleteOrCancelPlan(
  planId: string,
  mode: 'CANCEL_FUTURE' | 'DELETE_ALL',
  transactions: Transaction[],
  plans: InstallmentPlan[]
): { updatedTransactions: Transaction[]; updatedPlans: InstallmentPlan[]; deletedTxIds: string[] } {
  const todayStr = new Date().toISOString().substring(0, 10);
  const nowStr = new Date().toISOString();
  const deletedTxIds: string[] = [];

  let updatedPlans: InstallmentPlan[];
  let updatedTransactions: Transaction[];

  if (mode === 'DELETE_ALL') {
    // Remove the plan completely
    updatedPlans = plans.filter(p => p.id !== planId);
    updatedTransactions = transactions.filter(tx => {
      const isMatch = tx.planId === planId || tx.installmentPlanId === planId;
      if (isMatch) deletedTxIds.push(tx.id);
      return !isMatch;
    });
  } else {
    // CANCEL_FUTURE: Keep past/paid transactions, remove future unpaid ones, and set plan status to CANCELLED
    updatedPlans = plans.map(p => {
      if (p.id === planId) {
        return {
          ...p,
          status: 'CANCELLED' as const,
          updatedAt: nowStr,
        };
      }
      return p;
    });

    updatedTransactions = transactions.filter(tx => {
      const isMatch = tx.planId === planId || tx.installmentPlanId === planId;
      if (isMatch) {
        const isFuture = tx.date && tx.date > todayStr && !tx.isPaid;
        if (isFuture) {
          deletedTxIds.push(tx.id);
          return false;
        }
      }
      return true;
    });
  }

  return { updatedTransactions, updatedPlans, deletedTxIds };
}
