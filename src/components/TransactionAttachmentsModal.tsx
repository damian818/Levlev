import React, { useState, useRef } from 'react';
import { X, Upload, Trash2, Download, Eye, Paperclip, FileText, Check, AlertCircle } from 'lucide-react';
import { Transaction, TransactionAttachment } from '../types';

interface TransactionAttachmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onUpdateTransaction: (updatedTx: Transaction) => void;
}

export const TransactionAttachmentsModal: React.FC<TransactionAttachmentsModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onUpdateTransaction,
}) => {
  const [attachments, setAttachments] = useState<TransactionAttachment[]>(() => transaction?.attachments || []);
  const [previewAttachment, setPreviewAttachment] = useState<TransactionAttachment | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if transaction prop changes
  React.useEffect(() => {
    if (transaction) {
      setAttachments(transaction.attachments || []);
      setErrorMsg(null);
      setIsSaved(false);
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);

    const maxFileSize = 8 * 1024 * 1024; // 8MB limit
    const newItems: TransactionAttachment[] = [];

    Array.from(files).forEach(file => {
      if (file.size > maxFileSize) {
        setErrorMsg(`"${file.name}" is larger than 8MB. Please select a smaller file.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const newAttachment: TransactionAttachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl,
          uploadedAt: new Date().toISOString(),
        };

        setAttachments(prev => {
          const updated = [...prev, newAttachment];
          // Auto-persist changes to the transaction
          const updatedTx = { ...transaction, attachments: updated };
          onUpdateTransaction(updatedTx);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 2000);
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDeleteAttachment = (id: string) => {
    const updated = attachments.filter(a => a.id !== id);
    setAttachments(updated);
    if (previewAttachment?.id === id) {
      setPreviewAttachment(null);
    }
    const updatedTx = { ...transaction, attachments: updated };
    onUpdateTransaction(updatedTx);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isImage = (type?: string) => {
    return type?.startsWith('image/');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-[#0f131a] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#141a24]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Paperclip className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                Transaction Attachments
                {attachments.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                    {attachments.length}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {transaction.title} &bull; {transaction.currency} {transaction.amount.toLocaleString()} &bull; {transaction.date}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Upload Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              dragActive 
                ? 'border-blue-500 bg-blue-500/5 scale-[0.99]' 
                : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-900/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,application/pdf"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400 group-hover:text-blue-400">
              <Upload className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-sm font-medium text-slate-200 mb-1">
              Click to upload receipts or invoices, or drag and drop
            </p>
            <p className="text-xs text-slate-500">
              Supports PNG, JPG, WEBP, GIF, and PDF (up to 8MB each)
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Attachments List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Attached Files ({attachments.length})
              </h4>
              {isSaved && (
                <span className="flex items-center gap-1 text-xs text-emerald-400 animate-fadeIn">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>

            {attachments.length === 0 ? (
              <div className="p-8 text-center border border-slate-800/80 rounded-xl bg-slate-900/20 text-slate-500 text-sm">
                No attachments uploaded for this transaction yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-3 hover:border-slate-700 transition-colors group"
                  >
                    {/* Thumbnail / Icon */}
                    <div 
                      onClick={() => setPreviewAttachment(file)}
                      className="w-12 h-12 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {isImage(file.type) ? (
                        <img 
                          src={file.dataUrl} 
                          alt={file.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-6 h-6 text-blue-400" />
                      )}
                    </div>

                    {/* Meta */}
                    <div className="min-w-0 flex-1">
                      <p 
                        className="text-xs font-medium text-slate-200 truncate cursor-pointer hover:text-blue-400"
                        title={file.name}
                        onClick={() => setPreviewAttachment(file)}
                      >
                        {file.name}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatFileSize(file.size)} &bull; {new Date(file.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setPreviewAttachment(file)}
                        title="Preview"
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <a
                        href={file.dataUrl}
                        download={file.name}
                        title="Download"
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteAttachment(file.id)}
                        title="Delete"
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end bg-[#141a24]">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Lightbox Preview Modal */}
      {previewAttachment && (
        <div 
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setPreviewAttachment(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[85vh] w-full bg-[#0d1117] border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 bg-[#161b22] border-b border-slate-800 flex items-center justify-between text-slate-300">
              <div className="flex items-center gap-2 truncate">
                <Paperclip className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-medium truncate">{previewAttachment.name}</span>
                <span className="text-xs text-slate-500">({formatFileSize(previewAttachment.size)})</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewAttachment.dataUrl}
                  download={previewAttachment.name}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Viewer Content */}
            <div className="p-4 flex items-center justify-center flex-1 overflow-auto bg-black/40 min-h-[300px]">
              {isImage(previewAttachment.type) ? (
                <img
                  src={previewAttachment.dataUrl}
                  alt={previewAttachment.name}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                />
              ) : previewAttachment.type === 'application/pdf' ? (
                <iframe
                  src={previewAttachment.dataUrl}
                  title={previewAttachment.name}
                  className="w-full h-[70vh] border-0 rounded-lg"
                />
              ) : (
                <div className="text-center p-8">
                  <FileText className="w-16 h-16 text-slate-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-300 font-medium mb-1">{previewAttachment.name}</p>
                  <p className="text-xs text-slate-500 mb-4">Preview not available for this file type.</p>
                  <a
                    href={previewAttachment.dataUrl}
                    download={previewAttachment.name}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
