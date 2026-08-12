import re

with open("src/components/AddTransactionModal.tsx", "r") as f:
    content = f.read()

content = content.replace("{type === 'EXPENSE' && 'Record New Expense'}", "{type === 'EXPENSE' && (editingTx && editingTx.id ? 'Edit Expense' : 'Record New Expense')}")
content = content.replace("{type === 'INCOME' && 'Record New Income'}", "{type === 'INCOME' && (editingTx && editingTx.id ? 'Edit Income' : 'Record New Income')}")
content = content.replace("{type === 'TRANSFER' && 'Account Transfer'}", "{type === 'TRANSFER' && (editingTx && editingTx.id ? 'Edit Transfer' : 'Account Transfer')}")
content = content.replace("{type === 'CC_PAYMENT' && 'Credit Card Payment'}", "{type === 'CC_PAYMENT' && (editingTx && editingTx.id ? 'Edit Credit Card Payment' : 'Credit Card Payment')}")

with open("src/components/AddTransactionModal.tsx", "w") as f:
    f.write(content)
print("Done")
