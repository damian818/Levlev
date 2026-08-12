import re

with open("src/components/AddTransactionModal.tsx", "r") as f:
    content = f.read()

submit_old = r"""  const handleSubmit = \(e: React.FormEvent\) => \{
    e.preventDefault\(\);
    const parsedAmount = parseFloat\(amount\);
    if \(isNaN\(parsedAmount\) \|\| parsedAmount <= 0\) return;

    if \(type === 'CC_PAYMENT'\) \{"""

submit_new = """  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    if (editingTx && onUpdateTransaction) {
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

    if (type === 'CC_PAYMENT') {"""

content = re.sub(submit_old, submit_new, content)

with open("src/components/AddTransactionModal.tsx", "w") as f:
    f.write(content)
print("Done")
