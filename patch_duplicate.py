import re

with open("src/App.tsx", "r") as f:
    content = f.read()

handlers_old = r"""  const handleDuplicateTransaction = \(tx: Transaction\) => \{
    const duplicatedTx = \{
      \.\.\.tx,
      title: `\$\{tx.title\} \(Copy\)`,
    \};
    setEditingTransaction\(duplicatedTx\);
    setIsAddModalOpen\(true\);
  \};"""

handlers_new = """  const handleDuplicateTransaction = (tx: Transaction) => {
    // To duplicate, we pass a transaction with no id, or we add an explicit flag.
    // For now, setting it as editingTransaction without an ID will break onUpdateTransaction,
    // so we can clear the ID to force it as a new transaction when saving.
    const duplicatedTx = {
      ...tx,
      id: '', // Empty ID means it's a new transaction
      title: `${tx.title} (Copy)`,
    };
    setEditingTransaction(duplicatedTx);
    setIsAddModalOpen(true);
  };"""

content = re.sub(handlers_old, handlers_new, content)

with open("src/App.tsx", "w") as f:
    f.write(content)

with open("src/components/AddTransactionModal.tsx", "r") as f:
    content = f.read()

submit_old = r"""    if \(editingTx && onUpdateTransaction\) \{"""

submit_new = """    if (editingTx && onUpdateTransaction && editingTx.id) {"""

content = re.sub(submit_old, submit_new, content)

with open("src/components/AddTransactionModal.tsx", "w") as f:
    f.write(content)

print("Done")
