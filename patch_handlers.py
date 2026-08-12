import re

with open("src/App.tsx", "r") as f:
    content = f.read()

handlers_old = r"""  const handleDeleteTransaction = async \(idOrIds: string \| string\[\]\) => \{"""

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

  const handleDeleteTransaction = async (idOrIds: string | string[]) => {"""

if "handleEditTransaction" not in content:
    content = re.sub(handlers_old, handlers_new, content)
    with open("src/App.tsx", "w") as f:
        f.write(content)
    print("Done adding handlers")
else:
    print("Handlers already exist")

# Fix color property error in App.tsx
color_old = r"""            const defaultCat: CategoryItem = \{
              id: `cat-\$\{Date\.now\(\)\}`,
              name: 'General',
              type: 'EXPENSE',
              color: '#94a3b8'
            \};"""

color_new = """            const defaultCat: CategoryItem = {
              id: `cat-${Date.now()}`,
              name: 'General',
              type: 'EXPENSE',
            };"""

if "color: '#94a3b8'" in content:
    content = re.sub(color_old, color_new, content)
    with open("src/App.tsx", "w") as f:
        f.write(content)
    print("Done fixing color property")
