import re

with open("src/components/AddTransactionModal.tsx", "r") as f:
    content = f.read()

submit_btn = r"""              <button
                type="submit"
                className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl transition-all shadow-[0_0_15px_rgba\(16,185,129,0.2\)] hover:shadow-[0_0_20px_rgba\(16,185,129,0.4\)] text-sm"
              >
                \{isCC && numInstallments > 1 \? `Record \$\{numInstallments\} Installments` : 'Add Transaction'\}
              </button>"""

submit_btn_new = """              <button
                type="submit"
                className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] text-sm"
              >
                {editingTx && editingTx.id ? 'Save Changes' : (isCC && numInstallments > 1 ? `Record ${numInstallments} Installments` : 'Add Transaction')}
              </button>"""

content = re.sub(submit_btn, submit_btn_new, content)

with open("src/components/AddTransactionModal.tsx", "w") as f:
    f.write(content)
print("Done")
