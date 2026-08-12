import re

with open("src/components/AddTransactionModal.tsx", "r") as f:
    content = f.read()

# Add editingTx to props interface
interface_old = r"""export interface AddTransactionModalProps \{
  isOpen: boolean;
  onClose: \(\) => void;
  onAddTransaction: \(tx: Transaction \| Transaction\[\]\) => void;"""

interface_new = """export interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (tx: Transaction | Transaction[]) => void;
  onUpdateTransaction?: (id: string, updates: Partial<Transaction>) => void;
  editingTx?: Transaction | null;"""

content = re.sub(interface_old, interface_new, content)

# Add editingTx to destructured props
props_old = r"""  onAddTransaction,
  accountsList = \[\],
  existingAccounts = DEFAULT_ACCOUNTS,"""

props_new = """  onAddTransaction,
  onUpdateTransaction,
  editingTx,
  accountsList = [],
  existingAccounts = DEFAULT_ACCOUNTS,"""

content = re.sub(props_old, props_new, content)

# Modify useEffect that runs on isOpen
effect_old = r"""  // Sync initial account when opened
  useEffect\(\(\) => \{
    if \(isOpen\) \{
      const defaultAcc = initialAccount \|\| accountNames\[0\] \|\| 'BBVA';
      setAccount\(defaultAcc\);
      setCurrency\(lookupAccountCurrency\(defaultAcc\)\);
      if \(initialAccount\) \{
        const accInfo = accountItems.find\(a => a.name === initialAccount\);
        if \(accInfo && accInfo.type === 'CREDIT_CARD'\) \{
          setType\('EXPENSE'\);
        \}
      \}
    \} else \{
      // Reset form
      setType\('EXPENSE'\);
      setTitle\(''\);
      setAmount\(''\);
      setDate\(getTodayStr\(\)\);
      setDescription\(''\);
      setNumInstallments\(1\);
      setReceiveAmount\(''\);
      setCustomFxRate\(''\);
      setFxEditMode\('AUTO'\);
    \}
  \}, \[isOpen, initialAccount\]\);"""

effect_new = """  // Sync initial account or edit data when opened
  useEffect(() => {
    if (isOpen) {
      if (editingTx) {
        setType(editingTx.type as any);
        setTitle(editingTx.title);
        setCategory(editingTx.category || 'General');
        setAccount(editingTx.account || accountNames[0] || 'BBVA');
        if (editingTx.toAccount) setToAccount(editingTx.toAccount);
        setAmount(String(editingTx.amount));
        setCurrency(editingTx.currency);
        if (editingTx.receiveAmount) setReceiveAmount(String(editingTx.receiveAmount));
        if (editingTx.fxRate) setCustomFxRate(String(editingTx.fxRate));
        if (editingTx.receiveAmount || editingTx.fxRate) setFxEditMode('CUSTOM_RATE');
        else setFxEditMode('AUTO');
        setDate(editingTx.date ? editingTx.date.substring(0, 10) : getTodayStr());
        setStatementCloseDate(editingTx.statementCloseDate || '');
        setDescription(editingTx.description || '');
        setNumInstallments(editingTx.totalInstallments || 1);
      } else {
        const defaultAcc = initialAccount || accountNames[0] || 'BBVA';
        setAccount(defaultAcc);
        setCurrency(lookupAccountCurrency(defaultAcc));
        if (initialAccount) {
          const accInfo = accountItems.find(a => a.name === initialAccount);
          if (accInfo && accInfo.type === 'CREDIT_CARD') {
            setType('EXPENSE');
          }
        }
      }
    } else {
      // Reset form
      setType('EXPENSE');
      setTitle('');
      setAmount('');
      setDate(getTodayStr());
      setDescription('');
      setNumInstallments(1);
      setReceiveAmount('');
      setCustomFxRate('');
      setFxEditMode('AUTO');
    }
  }, [isOpen, initialAccount, editingTx, accountItems]);"""

content = re.sub(effect_old, effect_new, content)

with open("src/components/AddTransactionModal.tsx", "w") as f:
    f.write(content)
print("Done")
