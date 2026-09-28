import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowRightLeft,
  Calendar,
  CreditCard,
  ChevronRight,
  Filter,
  Check,
  Edit2,
  Trash2,
  Sparkles,
  Loader2,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  PlusCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import {
  Transaction,
  AccountItem,
  CategoryItem,
  DisplayCurrency,
  StatementParsedData,
  StatementReconciliationItem,
  StatementReconciliationSummary
} from '../types';
import { formatCurrency, isCreditCardAccount } from '../utils/financeUtils';
import {
  reconcileStatementWithApp,
  getDemoStatementData
} from '../utils/statementReconciliation';

interface StatementReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountItem[];
  categories: CategoryItem[];
  transactions: Transaction[];
  initialAccountName?: string;
  initialCloseDate?: string;
  displayCurrency: DisplayCurrency;
  usdArsRate: number;
  onProcessBatchRecords: (data: {
    newTransactions: Transaction[];
    updatedTransactions: Transaction[];
    accountName: string;
    statementCloseDate?: string;
  }) => void;
}

export function StatementReconciliationModal({
  isOpen,
  onClose,
  accounts,
  categories,
  transactions,
  initialAccountName,
  initialCloseDate,
  displayCurrency,
  usdArsRate,
  onProcessBatchRecords,
}: StatementReconciliationModalProps) {
  const { t } = useTranslation();

  // Filter credit card accounts
  const creditCardAccounts = useMemo(() => {
    const cc = accounts.filter(a => isCreditCardAccount(a.name, accounts));
    return cc.length > 0 ? cc : accounts;
  }, [accounts]);

  // Selected Target Account
  const [selectedAccount, setSelectedAccount] = useState<string>(() => {
    if (initialAccountName) return initialAccountName;
    return creditCardAccounts[0]?.name || accounts[0]?.name || 'Credit Card';
  });

  // Flow State
  const [step, setStep] = useState<'UPLOAD' | 'REVIEW' | 'SUCCESS'>('UPLOAD');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingMessage, setAnalyzingMessage] = useState<string>('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Upload state
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileSize, setUploadedFileSize] = useState<number>(0);
  const [pastedText, setPastedText] = useState<string>('');
  const [showPasteArea, setShowPasteArea] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsed and Reconciled Data
  const [parsedStatement, setParsedStatement] = useState<StatementParsedData | null>(null);
  const [reconciliationItems, setReconciliationItems] = useState<StatementReconciliationItem[]>([]);
  
  // Review Filters
  const [activeTab, setActiveTab] = useState<'ALL' | 'NEW' | 'MODIFIED' | 'MATCHED' | 'APP_ONLY'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Success summary
  const [processedSummary, setProcessedSummary] = useState<{ newCount: number; modCount: number } | null>(null);

  if (!isOpen) return null;

  // Process uploaded PDF
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setAnalysisError('Please upload a valid PDF document (.pdf)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAnalysisError('The PDF file is too large (max 5 MB). Please compress the PDF or paste the text directly.');
      return;
    }

    setUploadedFileName(file.name);
    setUploadedFileSize(file.size);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalyzingMessage(t('reconciliation.reading_pdf', { defaultValue: 'Reading PDF document...' }));

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string) || '';
          setAnalyzingMessage(t('reconciliation.ai_analyzing', { defaultValue: 'Analyzing statement expenses, installments & dates...' }));

          const response = await fetch('/api/parse-statement-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pdfBase64: base64Data,
              cardHint: selectedAccount,
              accounts: accounts.map(a => a.name),
              categories: categories.map(c => c.name),
            }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server responded with status ${response.status}`);
          }

          const statementData: StatementParsedData = await response.json();
          if (!statementData.items || statementData.items.length === 0) {
            throw new Error('No expenses or transactions could be detected in this document. Please check the PDF or paste the statement text.');
          }

          setAnalyzingMessage(t('reconciliation.matching_expenses', { defaultValue: 'Comparing against recorded app expenses...' }));

          // Run reconciliation
          const { reconciliationItems: recItems } = reconcileStatementWithApp(
            statementData,
            transactions,
            selectedAccount
          );

          setParsedStatement(statementData);
          setReconciliationItems(recItems);
          setIsAnalyzing(false);
          setStep('REVIEW');
        } catch (innerErr: any) {
          console.error('Error parsing PDF response:', innerErr);
          setAnalysisError(innerErr.message || 'Failed to extract statement data.');
          setIsAnalyzing(false);
        }
      };

      reader.onerror = () => {
        setAnalysisError('Failed to read the local PDF file.');
        setIsAnalyzing(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Upload error:', err);
      setAnalysisError(err.message || 'Failed to start file upload.');
      setIsAnalyzing(false);
    }
  };

  // Process pasted text
  const handlePastedTextSubmit = async () => {
    if (!pastedText.trim()) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalyzingMessage('Analyzing statement text with AI...');

    try {
      const response = await fetch('/api/parse-statement-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statementText: pastedText,
          cardHint: selectedAccount,
          accounts: accounts.map(a => a.name),
          categories: categories.map(c => c.name),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to analyze statement text.');
      }

      const statementData: StatementParsedData = await response.json();
      const { reconciliationItems: recItems } = reconcileStatementWithApp(
        statementData,
        transactions,
        selectedAccount
      );

      setUploadedFileName('Pasted Statement Text');
      setUploadedFileSize(pastedText.length);
      setParsedStatement(statementData);
      setReconciliationItems(recItems);
      setIsAnalyzing(false);
      setStep('REVIEW');
    } catch (err: any) {
      setAnalysisError(err.message || 'Failed to analyze text.');
      setIsAnalyzing(false);
    }
  };

  // Load interactive demo statement
  const handleLoadDemo = () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalyzingMessage('Generating realistic credit card demo statement...');

    setTimeout(() => {
      const demoData = getDemoStatementData(selectedAccount);
      const { reconciliationItems: recItems } = reconcileStatementWithApp(
        demoData,
        transactions,
        selectedAccount
      );

      setUploadedFileName('Demo_Visa_Santander_Statement.pdf');
      setUploadedFileSize(184200);
      setParsedStatement(demoData);
      setReconciliationItems(recItems);
      setIsAnalyzing(false);
      setStep('REVIEW');
    }, 600);
  };

  // Re-run reconciliation if target account changes in Review mode
  const handleAccountChangeInReview = (newAcc: string) => {
    setSelectedAccount(newAcc);
    if (parsedStatement) {
      const { reconciliationItems: recItems } = reconcileStatementWithApp(
        parsedStatement,
        transactions,
        newAcc
      );
      setReconciliationItems(recItems);
    }
  };

  // Item toggle
  const handleToggleItem = (id: string) => {
    setReconciliationItems(prev =>
      prev.map(item => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Select all visible / active tab items
  const handleToggleSelectAll = (select: boolean) => {
    setReconciliationItems(prev =>
      prev.map(item => {
        if (item.status === 'MATCHED' || item.status === 'APP_ONLY') return item;
        if (activeTab !== 'ALL' && item.status !== activeTab) return item;
        return { ...item, selected: select };
      })
    );
  };

  // Inline edit for draft transaction
  const handleUpdateDraft = (id: string, updates: Partial<Transaction>) => {
    setReconciliationItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            draftTx: { ...item.draftTx, ...updates },
          };
        }
        return item;
      })
    );
  };

  // Remove item from draft list
  const handleDismissItem = (id: string) => {
    setReconciliationItems(prev => prev.filter(item => item.id !== id));
  };

  // Summary counts and totals
  const counts = useMemo(() => {
    const newItems = reconciliationItems.filter(r => r.status === 'NEW');
    const modItems = reconciliationItems.filter(r => r.status === 'MODIFIED');
    const matchItems = reconciliationItems.filter(r => r.status === 'MATCHED');
    const appOnlyItems = reconciliationItems.filter(r => r.status === 'APP_ONLY');

    const selectedNew = newItems.filter(r => r.selected);
    const selectedMod = modItems.filter(r => r.selected);

    const statementTotal = parsedStatement?.statementTotal || 0;
    const selectedNewTotal = selectedNew.reduce((sum, r) => sum + (Number(r.draftTx.amount) || 0), 0);

    return {
      total: reconciliationItems.length,
      newCount: newItems.length,
      modCount: modItems.length,
      matchCount: matchItems.length,
      appOnlyCount: appOnlyItems.length,
      selectedNewCount: selectedNew.length,
      selectedModCount: selectedMod.length,
      totalSelected: selectedNew.length + selectedMod.length,
      statementTotal,
      selectedNewTotal,
    };
  }, [reconciliationItems, parsedStatement]);

  // Filtered reconciliation items for review list
  const filteredItems = useMemo(() => {
    return reconciliationItems.filter(item => {
      // Tab filter
      if (activeTab !== 'ALL' && item.status !== activeTab) return false;

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const title = (item.draftTx.title || '').toLowerCase();
        const desc = (item.draftTx.description || '').toLowerCase();
        const cat = (item.draftTx.category || '').toLowerCase();
        const amt = String(item.draftTx.amount || '');
        if (!title.includes(term) && !desc.includes(term) && !cat.includes(term) && !amt.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [reconciliationItems, activeTab, searchTerm]);

  // Batch process all selected items
  const handleProcessSelected = () => {
    const selectedNew = reconciliationItems
      .filter(r => r.status === 'NEW' && r.selected)
      .map(r => r.draftTx);

    const selectedMod = reconciliationItems
      .filter(r => r.status === 'MODIFIED' && r.selected)
      .map(r => r.draftTx);

    if (selectedNew.length === 0 && selectedMod.length === 0) {
      alert('Please select at least one new transaction or modification to process.');
      return;
    }

    onProcessBatchRecords({
      newTransactions: selectedNew,
      updatedTransactions: selectedMod,
      accountName: selectedAccount,
      statementCloseDate: parsedStatement?.closeDate,
    });

    setProcessedSummary({
      newCount: selectedNew.length,
      modCount: selectedMod.length,
    });
    setStep('SUCCESS');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-[#121620] border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#151a26]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  {t('reconciliation.modal_title', { defaultValue: 'Credit Card Statement Reconciliation' })}
                </h3>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  PDF · Gemini AI
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('reconciliation.modal_subtitle', {
                  defaultValue: 'Upload your bank or credit card statement to compare recorded expenses and draft batch additions or modifications.',
                })}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: UPLOAD */}
          {step === 'UPLOAD' && (
            <div className="space-y-6 max-w-2xl mx-auto py-4">
              {/* Account Selector & Target Configuration */}
              <div className="bg-[#161c28] p-4 rounded-xl border border-slate-800/90 space-y-3">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>{t('reconciliation.select_card_label', { defaultValue: 'Select Card Account to Reconcile' })}</span>
                  <span className="text-[11px] text-slate-500">{creditCardAccounts.length} cards available</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {creditCardAccounts.map(acc => {
                    const isSelected = acc.name === selectedAccount;
                    return (
                      <button
                        key={acc.name}
                        type="button"
                        onClick={() => setSelectedAccount(acc.name)}
                        className={`px-3.5 py-2.5 rounded-xl text-left border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600/15 border-purple-500/50 text-white shadow-xs'
                            : 'bg-[#0f131a] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <CreditCard className={`w-4 h-4 ${isSelected ? 'text-purple-400' : 'text-slate-500'}`} />
                          <span className="text-xs font-semibold">{acc.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">{acc.currency || 'ARS'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PDF Dropzone */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                  isAnalyzing
                    ? 'border-purple-500/40 bg-purple-950/10'
                    : 'border-slate-700 hover:border-purple-500/50 bg-[#161c28]/60 hover:bg-[#161c28]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                {isAnalyzing ? (
                  <div className="space-y-4 py-6">
                    <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{analyzingMessage}</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Extracting dates, merchants, installments, and calculating comparisons...
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto shadow-inner">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-100">
                        {t('reconciliation.upload_drag_title', { defaultValue: 'Drag and drop your Credit Card Statement PDF' })}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Supports PDF statements from Visa, Mastercard, AMEX, Santander, BBVA, Galicia, Macro, Chase, etc.
                      </p>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-950/40 flex items-center space-x-2 cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                        <span>{t('reconciliation.browse_file', { defaultValue: 'Select PDF File' })}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleLoadDemo}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer"
                        title="Try with simulated Visa Santander statement with 11 purchases & installments"
                      >
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>{t('reconciliation.try_demo_statement', { defaultValue: 'Try Demo Statement' })}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {analysisError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-3">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                    <div className="flex-1">
                      <strong className="font-bold text-rose-200">{t('reconciliation.error_title', { defaultValue: 'Statement Analysis Notice' })}</strong>
                      <p className="mt-0.5 text-rose-300 leading-relaxed">{analysisError}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-500/20">
                    <button
                      type="button"
                      onClick={handleLoadDemo}
                      className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>{t('reconciliation.load_demo', { defaultValue: 'Load Demo Statement' })}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasteArea(true);
                        setAnalysisError(null);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-purple-400" />
                      <span>{t('reconciliation.paste_text_manually', { defaultValue: 'Paste Statement Text' })}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalysisError(null)}
                      className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
                    >
                      {t('common.dismiss', { defaultValue: 'Dismiss' })}
                    </button>
                  </div>
                </div>
              )}

              {/* Paste Text Option */}
              <div className="pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowPasteArea(!showPasteArea)}
                  className="text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 cursor-pointer"
                >
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showPasteArea ? 'rotate-90' : ''}`} />
                  <span>Or paste statement text directly (useful for online banking summaries)</span>
                </button>

                {showPasteArea && (
                  <div className="mt-3 space-y-3 p-4 bg-[#161c28] rounded-xl border border-slate-800 animate-in fade-in duration-150">
                    <textarea
                      rows={5}
                      value={pastedText}
                      onChange={e => setPastedText(e.target.value)}
                      placeholder="Paste copy-pasted statement rows here (e.g. 15/08 COTO SUC 14 $ 45.200,00 01/01 ...)"
                      className="w-full p-3 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-slate-600"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handlePastedTextSubmit}
                        disabled={!pastedText.trim() || isAnalyzing}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                      >
                        Analyze Text
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & RECONCILIATION COMPARISON */}
          {step === 'REVIEW' && (
            <div className="space-y-6">
              {/* Statement Metadata Summary Card */}
              <div className="bg-[#161c28] rounded-2xl border border-slate-800 p-5 space-y-4 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                        <span>{parsedStatement?.issuer || selectedAccount}</span>
                        {parsedStatement?.cardLast4 && (
                          <span className="text-xs text-slate-400 font-mono">···· {parsedStatement.cardLast4}</span>
                        )}
                      </h4>
                      <span className="text-xs text-slate-500 font-mono">
                        {parsedStatement?.periodStart} → {parsedStatement?.periodEnd || parsedStatement?.closeDate}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-2">
                      <span>Source: {uploadedFileName}</span>
                      <span>·</span>
                      <span>Card Account:</span>
                      <select
                        value={selectedAccount}
                        onChange={e => handleAccountChangeInReview(e.target.value)}
                        className="bg-[#0f131a] border border-slate-700 rounded px-2 py-0.5 text-xs text-purple-300 font-semibold focus:outline-none"
                      >
                        {creditCardAccounts.map(acc => (
                          <option key={acc.name} value={acc.name}>{acc.name}</option>
                        ))}
                      </select>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('UPLOAD');
                      setAnalysisError(null);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 self-start lg:self-auto cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Upload Different Statement</span>
                  </button>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-[#0f131a] rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Statement Total</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-purple-400 mt-0.5 block">
                      {formatCurrency(counts.statementTotal, (parsedStatement?.currency || 'ARS') as DisplayCurrency)}
                    </span>
                    <span className="text-[10px] text-slate-500">{parsedStatement?.items.length || 0} line items</span>
                  </div>

                  <div className="p-3 bg-[#0f131a] rounded-xl border border-slate-800">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">New to Add</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-emerald-400 mt-0.5 block">
                      +{counts.newCount}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatCurrency(counts.selectedNewTotal, (parsedStatement?.currency || 'ARS') as DisplayCurrency)}
                    </span>
                  </div>

                  <div className="p-3 bg-[#0f131a] rounded-xl border border-slate-800">
                    <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider block">Modifications</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-amber-400 mt-0.5 block">
                      {counts.modCount}
                    </span>
                    <span className="text-[10px] text-slate-500">Amounts / Cuotas to update</span>
                  </div>

                  <div className="p-3 bg-[#0f131a] rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Already Matched</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-slate-200 mt-0.5 block">
                      {counts.matchCount}
                    </span>
                    <span className="text-[10px] text-slate-500">Expenses in sync</span>
                  </div>
                </div>
              </div>

              {/* Segmented Filter Bar & Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center bg-[#0f131a] p-1 rounded-xl border border-slate-800 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ALL')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                      activeTab === 'ALL'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All ({counts.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('NEW')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                      activeTab === 'NEW'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>New to Add ({counts.newCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('MODIFIED')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                      activeTab === 'MODIFIED'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Modifications ({counts.modCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('MATCHED')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                      activeTab === 'MATCHED'
                        ? 'bg-slate-800 text-slate-200 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Matched ({counts.matchCount})
                  </button>
                  {counts.appOnlyCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('APP_ONLY')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                        activeTab === 'APP_ONLY'
                          ? 'bg-slate-800 text-slate-200 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      In App Only ({counts.appOnlyCount})
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Filter by merchant or amount..."
                    className="w-full sm:w-56 px-3 py-1.5 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />

                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(true)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 whitespace-nowrap cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(false)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-medium rounded-lg border border-slate-700 whitespace-nowrap cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {filteredItems.length === 0 ? (
                  <div className="p-8 text-center bg-[#161c28]/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
                    No transactions found in this view.
                  </div>
                ) : (
                  filteredItems.map(item => {
                    const isNew = item.status === 'NEW';
                    const isMod = item.status === 'MODIFIED';
                    const isMatched = item.status === 'MATCHED';
                    const isAppOnly = item.status === 'APP_ONLY';

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-all ${
                          item.selected
                            ? isNew
                              ? 'bg-emerald-950/15 border-emerald-500/40 shadow-xs'
                              : 'bg-amber-950/15 border-amber-500/40 shadow-xs'
                            : isMatched
                            ? 'bg-[#141822]/60 border-slate-800/80 opacity-75'
                            : isAppOnly
                            ? 'bg-[#141822]/40 border-slate-800/60 opacity-60'
                            : 'bg-[#161c28] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Left: Checkbox & Status */}
                          <div className="flex items-start space-x-3 flex-1 min-w-0">
                            {(isNew || isMod) ? (
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => handleToggleItem(item.id)}
                                className="w-4 h-4 mt-1 rounded border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                              />
                            ) : (
                              <div className="w-4 h-4 mt-1 flex items-center justify-center text-slate-500">
                                {isMatched && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                                {isAppOnly && <Clock className="w-4 h-4 text-slate-500" />}
                              </div>
                            )}

                            <div className="space-y-1 flex-1 min-w-0">
                              {/* Header line */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {isNew && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    NEW TRANSACTION
                                  </span>
                                )}
                                {isMod && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    MODIFICATION PROPOSED
                                  </span>
                                )}
                                {isMatched && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                    VERIFIED MATCH
                                  </span>
                                )}
                                {isAppOnly && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                    RECORDED IN APP ONLY
                                  </span>
                                )}

                                <span className="text-xs text-slate-400 font-mono">
                                  {item.draftTx.date}
                                </span>

                                {item.draftTx.installments && (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    Cuota {item.draftTx.installments}
                                  </span>
                                )}
                              </div>

                              {/* Editable Fields for New or Modified items */}
                              {(isNew || isMod) ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                                  <div>
                                    <label className="text-[9px] text-slate-500 uppercase font-bold block">Merchant Title</label>
                                    <input
                                      type="text"
                                      value={item.draftTx.title}
                                      onChange={e => handleUpdateDraft(item.id, { title: e.target.value })}
                                      className="w-full px-2 py-1 bg-[#0f131a] border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-slate-500 uppercase font-bold block">Category</label>
                                    <select
                                      value={item.draftTx.category}
                                      onChange={e => handleUpdateDraft(item.id, { category: e.target.value })}
                                      className="w-full px-2 py-1 bg-[#0f131a] border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    >
                                      {categories.map(c => (
                                        <option key={c.id || c.name} value={c.name}>{c.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-slate-500 uppercase font-bold block">Amount</label>
                                    <input
                                      type="number"
                                      step="any"
                                      value={item.draftTx.amount}
                                      onChange={e => handleUpdateDraft(item.id, { amount: parseFloat(e.target.value) || 0 })}
                                      className="w-full px-2 py-1 bg-[#0f131a] border border-slate-700 rounded text-xs font-mono font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <h5 className="text-xs font-bold text-slate-200">{item.draftTx.title}</h5>
                                  <p className="text-[11px] text-slate-400">
                                    {item.draftTx.category} · {item.draftTx.account}
                                  </p>
                                </div>
                              )}

                              {/* Diff details if modified */}
                              {isMod && item.diffs.length > 0 && (
                                <div className="mt-2 p-2 bg-[#0f131a] rounded-lg border border-slate-800 text-[11px] space-y-1">
                                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Proposed Changes:</span>
                                  {item.diffs.map((d, dIdx) => (
                                    <div key={dIdx} className="flex items-center space-x-2 text-slate-300">
                                      <span className="font-semibold text-slate-400">{d.label}:</span>
                                      <span className="line-through text-slate-500">
                                        {d.field === 'amount'
                                          ? formatCurrency(d.oldVal, item.draftTx.currency as DisplayCurrency)
                                          : String(d.oldVal)}
                                      </span>
                                      <ChevronRight className="w-3 h-3 text-slate-600" />
                                      <span className="font-bold text-emerald-400 font-mono">
                                        {d.field === 'amount'
                                          ? formatCurrency(d.newVal, item.draftTx.currency as DisplayCurrency)
                                          : String(d.newVal)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Raw description note */}
                              {item.statementItem?.rawDescription && (
                                <p className="text-[10px] text-slate-500 font-mono pt-1">
                                  Statement line: "{item.statementItem.rawDescription}"
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right: Amount & Actions */}
                          <div className="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end gap-2 shrink-0">
                            <span className="text-sm font-bold font-mono text-slate-100">
                              {formatCurrency(item.draftTx.amount, (item.draftTx.currency || 'ARS') as DisplayCurrency)}
                            </span>

                            {isNew && (
                              <button
                                type="button"
                                onClick={() => handleDismissItem(item.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Dismiss draft"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 'SUCCESS' && (
            <div className="py-12 text-center max-w-md mx-auto space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-950/40">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-slate-100">Statement Reconciled Successfully!</h4>
                <p className="text-xs text-slate-400">
                  All approved transactions have been saved directly to your account ledger and database.
                </p>
              </div>

              {processedSummary && (
                <div className="p-4 bg-[#161c28] rounded-xl border border-slate-800 grid grid-cols-2 gap-3 text-left">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">New Expenses Added</span>
                    <span className="text-lg font-bold text-emerald-400 block font-mono">+{processedSummary.newCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Transactions Updated</span>
                    <span className="text-lg font-bold text-amber-400 block font-mono">{processedSummary.modCount}</span>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
                >
                  Done & View Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Action Bar */}
        {step === 'REVIEW' && (
          <div className="px-6 py-4 border-t border-slate-800 bg-[#151a26] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-300">
              <span className="font-semibold">Selected for Processing:</span>{' '}
              <span className="text-emerald-400 font-bold">{counts.selectedNewCount} new</span>,{' '}
              <span className="text-amber-400 font-bold">{counts.selectedModCount} modifications</span>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleProcessSelected}
                disabled={counts.totalSelected === 0}
                className="flex-1 sm:flex-initial px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Process All Records ({counts.totalSelected}) at Once</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
