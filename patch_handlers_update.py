import re

with open("src/App.tsx", "r") as f:
    content = f.read()

handlers_old = r"""  const handleUpdateTransaction = \(idOrIds: string \| string\[\], updates: Partial<Transaction>\) => \{
    const ids = Array\.isArray\(idOrIds\) \? idOrIds : \[idOrIds\];
    setTransactions\(prev => prev\.map\(t => ids\.includes\(t\.id\) \? \{ \.\.\.t, \.\.\.updates \} : t\)\);
  \};"""

handlers_new = """  const handleUpdateTransaction = (idOrIds: string | string[], updates: Partial<Transaction>) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    setTransactions(prev => {
      const updated = prev.map(t => ids.includes(t.id) ? { ...t, ...updates } : t);
      try {
        localStorage.setItem('finance_app_transactions', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };"""

content = re.sub(handlers_old, handlers_new, content)

with open("src/App.tsx", "w") as f:
    f.write(content)
print("Done")
