import re

with open("src/App.tsx", "r") as f:
    content = f.read()

state_old = r"""  const \[isAddModalOpen, setIsAddModalOpen\] = useState\(false\);"""

state_new = """  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);"""

content = re.sub(state_old, state_new, content)

handlers_old = r"""  const handleDeleteTransaction = async \(idOrIds: string \| string\[\]\) => \{"""

handlers_new = """  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsAddModalOpen(true);
  };

  const handleDuplicateTransaction = (tx: Transaction) => {
    const duplicatedTx = {
      ...tx,
      title: `${tx.title} (Copy)`,
    };
    setEditingTransaction(duplicatedTx);
    setIsAddModalOpen(true);
  };

  const handleDeleteTransaction = async (idOrIds: string | string[]) => {"""

content = re.sub(handlers_old, handlers_new, content)

modal_old = r"""      <AddTransactionModal
        isOpen=\{isAddModalOpen\}
        onClose=\{\(\) => setIsAddModalOpen\(false\)\}
        onAddTransaction=\{handleAddTransaction\}
        accountsList=\{accounts\}
        existingAccounts=\{accounts.map\(a => a.name\)\}
        existingCategories=\{categories.map\(c => c.name\)\}
        existingTransactions=\{transactions\}
        onAddCategory=\{handleAddCategory\}
        onAddAccount=\{handleAddAccount\}
        usdArsRate=\{usdArsRate\}
      />"""

modal_new = """      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTransaction(null);
        }}
        onAddTransaction={handleAddTransaction}
        onUpdateTransaction={handleUpdateTransaction}
        editingTx={editingTransaction}
        accountsList={accounts}
        existingAccounts={accounts.map(a => a.name)}
        existingCategories={categories.map(c => c.name)}
        existingTransactions={transactions}
        onAddCategory={handleAddCategory}
        onAddAccount={handleAddAccount}
        usdArsRate={usdArsRate}
      />"""

content = re.sub(modal_old, modal_new, content)

tab_old = r"""          <TransactionsTab
            transactions=\{transactions\}
            displayCurrency=\{displayCurrency\}
            usdArsRate=\{usdArsRate\}
            historyData=\{historyData\}
            onDeleteTransaction=\{handleDeleteTransaction\}
            onUpdateTransaction=\{handleUpdateTransaction\}
            categoriesList=\{categories\}
            accountsList=\{accounts\}
            onOpenAddModal=\{\(\) => setIsAddModalOpen\(true\)\}
            onOpenDeleteModal=\{\(\) => setIsDeleteModalOpen\(true\)\}
            activeFilter=\{activeFilter\}
            onClearFilter=\{\(\) => setActiveFilter\(undefined\)\}
            currentUserId=\{authUser\?.id\}
            showSharedData=\{showSharedData\}
          />"""

tab_new = """          <TransactionsTab
            transactions={transactions}
            displayCurrency={displayCurrency}
            usdArsRate={usdArsRate}
            historyData={historyData}
            onDeleteTransaction={handleDeleteTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onEditTransaction={handleEditTransaction}
            onDuplicateTransaction={handleDuplicateTransaction}
            categoriesList={categories}
            accountsList={accounts}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
            activeFilter={activeFilter}
            onClearFilter={() => setActiveFilter(undefined)}
            currentUserId={authUser?.id}
            showSharedData={showSharedData}
          />"""

content = re.sub(tab_old, tab_new, content)

with open("src/App.tsx", "w") as f:
    f.write(content)
print("Done")
