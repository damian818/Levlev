import re

with open("src/components/AddTransactionModal.tsx", "r") as f:
    content = f.read()

# Let's see if we can find New Transaction
if "New Transaction" in content:
    content = content.replace("New Transaction", "{editingTx && editingTx.id ? 'Edit Transaction' : 'New Transaction'}")
    with open("src/components/AddTransactionModal.tsx", "w") as f:
        f.write(content)
    print("Done")
else:
    print("Not found")

