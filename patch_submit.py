import re

with open("src/components/AddTransactionModal.tsx", "r") as f:
    content = f.read()

submit_old = r"""  const handleSubmit = \(e: React.FormEvent\) => \{
    e.preventDefault\(\);
    const parsedAmount = parseFloat\(amount\);
    if \(isNaN\(parsedAmount\) \|\| parsedAmount <= 0\) return;

    if \(type === 'CC_PAYMENT'\) \{
      const paymentTx: Transaction = \{
        id: `tx-\$\{Date.now\(\)\}`,
        date,
        title: title \|\| 'Pago de Tarjeta',
        category: 'Transferencias',
        account: account,
        toAccount: toAccount,
        amount: parsedAmount,
        currency,
        type,
        description: description \|\| undefined,
      \};
      onAddTransaction\(paymentTx\);
      onClose\(\);
    \} else if \(type === 'TRANSFER'\) \{
      const transferTx: Transaction = \{
        id: `tx-\$\{Date.now\(\)\}`,
        date,
        title: title \|\| 'Transferencia',
        category: 'Transferencias',
        account: account,
        toAccount: toAccount,
        amount: parsedAmount,
        currency,
        type,
        description: description \|\| undefined,
        receiveAmount: receiveAmount \? parseFloat\(receiveAmount\) : undefined,
        fxRate: fxEditMode === 'CUSTOM_RATE' && customFxRate \? parseFloat\(customFxRate\) : undefined
      \};
      onAddTransaction\(transferTx\);
      onClose\(\);
    \} else \{
      if \(isCC && numInstallments > 1 && installmentSchedule.length > 0\) \{
        const txList: Transaction\[\] = installmentSchedule.map\(\(cuota, idx\) => \(\{
          id: `tx-\$\{Date.now\(\)\}-\$\{idx\}`,
          date: cuota.date,
          title,
          category,
          account: account,
          amount: cuota.amount,
          currency,
          type,
          description: description \? `\$\{description\} \(Cuota \$\{cuota.label\}\)` : `Cuota \$\{cuota.label\}`,
          installments: cuota.label,
          installmentNumber: cuota.installmentNum,
          totalInstallments: numInstallments,
          originalAmount: parsedAmount,
          statementCloseDate: isCC \? cuota.stmtCloseDate : undefined,
        \}\)\);
        onAddTransaction\(txList\);
      \} else \{
        const newTx: Transaction = \{
          id: `tx-\$\{Date.now\(\)\}`,
          date,
          title,
          category,
          account: account,
          amount: parsedAmount,
          currency,
          type,
          description: description \|\| undefined,
          installments: numInstallments > 1 \? `1/\$\{numInstallments\}` : undefined,
          installmentNumber: 1,
          totalInstallments: numInstallments > 1 \? numInstallments : undefined,
          statementCloseDate: isCC \? statementCloseDate : undefined,
        \};
        onAddTransaction\(newTx\);
      \}
      onClose\(\);
    \}
  \};"""

submit_new = """  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    if (editingTx && onUpdateTransaction) {
      if (type === 'CC_PAYMENT') {
        onUpdateTransaction(editingTx.id, {
          date,
          title: title || 'Pago de Tarjeta',
          category: 'Transferencias',
          account: account,
          toAccount: toAccount,
          amount: parsedAmount,
          currency,
          type,
          description: description || undefined,
        });
      } else if (type === 'TRANSFER') {
        onUpdateTransaction(editingTx.id, {
          date,
          title: title || 'Transferencia',
          category: 'Transferencias',
          account: account,
          toAccount: toAccount,
          amount: parsedAmount,
          currency,
          type,
          description: description || undefined,
          receiveAmount: receiveAmount ? parseFloat(receiveAmount) : undefined,
          fxRate: fxEditMode === 'CUSTOM_RATE' && customFxRate ? parseFloat(customFxRate) : undefined
        });
      } else {
        onUpdateTransaction(editingTx.id, {
          date,
          title,
          category,
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
        id: `tx-${Date.now()}`,
        date,
        title: title || 'Pago de Tarjeta',
        category: 'Transferencias',
        account: account,
        toAccount: toAccount,
        amount: parsedAmount,
        currency,
        type,
        description: description || undefined,
      };
      onAddTransaction(paymentTx);
      onClose();
    } else if (type === 'TRANSFER') {
      const transferTx: Transaction = {
        id: `tx-${Date.now()}`,
        date,
        title: title || 'Transferencia',
        category: 'Transferencias',
        account: account,
        toAccount: toAccount,
        amount: parsedAmount,
        currency,
        type,
        description: description || undefined,
        receiveAmount: receiveAmount ? parseFloat(receiveAmount) : undefined,
        fxRate: fxEditMode === 'CUSTOM_RATE' && customFxRate ? parseFloat(customFxRate) : undefined
      };
      onAddTransaction(transferTx);
      onClose();
    } else {
      if (isCC && numInstallments > 1 && installmentSchedule.length > 0) {
        const txList: Transaction[] = installmentSchedule.map((cuota, idx) => ({
          id: `tx-${Date.now()}-${idx}`,
          date: cuota.date,
          title,
          category,
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
          id: `tx-${Date.now()}`,
          date,
          title,
          category,
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
      onClose();
    }
  };"""

content = re.sub(submit_old, submit_new, content)

with open("src/components/AddTransactionModal.tsx", "w") as f:
    f.write(content)
print("Done")
