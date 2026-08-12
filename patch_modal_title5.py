import re

with open("src/components/AddTransactionModal.tsx", "r") as f:
    content = f.read()

content = content.replace("{type === 'EXPENSE' && (editingTx && editingTx.id ? 'Edit Expense' : '{editingTx && editingTx.id ? 'Edit Expense' : 'Record New Expense'}')}", "{type === 'EXPENSE' && (editingTx && editingTx.id ? 'Edit Expense' : 'Record New Expense')}")
content = content.replace("{type === 'INCOME' && (editingTx && editingTx.id ? 'Edit Income' : '{editingTx && editingTx.id ? 'Edit Income' : 'Record New Income'}')}", "{type === 'INCOME' && (editingTx && editingTx.id ? 'Edit Income' : 'Record New Income')}")
content = content.replace("{type === 'TRANSFER' && (editingTx && editingTx.id ? 'Edit Transfer' : '{editingTx && editingTx.id ? 'Edit Transfer' : 'Account Transfer'}')}", "{type === 'TRANSFER' && (editingTx && editingTx.id ? 'Edit Transfer' : 'Account Transfer')}")
content = content.replace("{type === 'CC_PAYMENT' && (editingTx && editingTx.id ? 'Edit Credit Card Payment' : '{editingTx && editingTx.id ? 'Edit Credit Card Payment' : 'Credit Card Payment'}')}", "{type === 'CC_PAYMENT' && (editingTx && editingTx.id ? 'Edit Credit Card Payment' : 'Credit Card Payment')}")


with open("src/components/AddTransactionModal.tsx", "w") as f:
    f.write(content)
print("Done")
