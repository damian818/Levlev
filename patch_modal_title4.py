import re

with open("src/components/AddTransactionModal.tsx", "r") as f:
    content = f.read()

content = content.replace("Record New Expense", "{editingTx && editingTx.id ? 'Edit Expense' : 'Record New Expense'}")
content = content.replace("Record New Income", "{editingTx && editingTx.id ? 'Edit Income' : 'Record New Income'}")
content = content.replace("Account Transfer", "{editingTx && editingTx.id ? 'Edit Transfer' : 'Account Transfer'}")
content = content.replace("Credit Card Payment", "{editingTx && editingTx.id ? 'Edit Credit Card Payment' : 'Credit Card Payment'}")

with open("src/components/AddTransactionModal.tsx", "w") as f:
    f.write(content)
print("Done")
