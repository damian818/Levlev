import re

with open("src/components/TransactionsTab.tsx", "r") as f:
    content = f.read()

interface_old = r"""  onOpenDeleteModal\?: \(\) => void;
  activeFilter\?: TransactionFilter;
  onClearFilter\?: \(\) => void;"""

interface_new = """  onOpenDeleteModal?: () => void;
  onEditTransaction?: (tx: Transaction) => void;
  onDuplicateTransaction?: (tx: Transaction) => void;
  activeFilter?: TransactionFilter;
  onClearFilter?: () => void;"""

content = re.sub(interface_old, interface_new, content)

props_old = r"""  onOpenDeleteModal,
  activeFilter,
  onClearFilter,"""

props_new = """  onOpenDeleteModal,
  onEditTransaction,
  onDuplicateTransaction,
  activeFilter,
  onClearFilter,"""

content = re.sub(props_old, props_new, content)

table_icons = r"""                      <td className="p-3 text-center">
                        <button
                          onClick=\{\(\) => handleDeleteClick\(tx\)\}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded-md hover:bg-rose-950/50 transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>"""

table_icons_new = """                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-60 hover:opacity-100 transition-opacity">
                          {onEditTransaction && (
                            <button
                              onClick={() => onEditTransaction(tx)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/50 rounded-md transition-colors"
                              title="Edit transaction"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDuplicateTransaction && (
                            <button
                              onClick={() => onDuplicateTransaction(tx)}
                              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-950/50 rounded-md transition-colors"
                              title="Duplicate transaction"
                            >
                              <Layers className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteClick(tx)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded-md transition-colors"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>"""

content = re.sub(table_icons, table_icons_new, content)

with open("src/components/TransactionsTab.tsx", "w") as f:
    f.write(content)
print("Done")
