import re

with open("src/App.tsx", "r") as f:
    content = f.read()

handlers_old = r"""  const handleDeleteTransaction = \(idOrIds: string \| string\[\]\) => \{"""

handlers_new = """  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsAddModalOpen(true);
  };

  const handleDuplicateTransaction = (tx: Transaction) => {
    const duplicatedTx = {
      ...tx,
      id: '', // Empty ID means it's a new transaction
      title: `${tx.title} (Copy)`,
    };
    setEditingTransaction(duplicatedTx);
    setIsAddModalOpen(true);
  };

  const handleDeleteTransaction = (idOrIds: string | string[]) => {"""

content = re.sub(handlers_old, handlers_new, content)

with open("src/App.tsx", "w") as f:
    f.write(content)
print("Done")
