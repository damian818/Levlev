import React from 'react';
import { AlertTriangle, Trash2, RefreshCw, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDeleteAll: () => void;
  onConfirmResetSample: () => void;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirmDeleteAll,
  onConfirmResetSample,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-start">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-100">Delete Existing Financial Data?</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            This action will permanently delete all stored transactions and custom budget goals from your local storage session. 
          </p>
        </div>

        <div className="p-3.5 bg-[#0f131a] rounded-xl border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
          <div className="font-semibold text-rose-400 flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Wipe All Records:</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            Clears all transaction logs, leaving a blank canvas ready for your custom CSV imports or manual entries.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={() => {
              onConfirmDeleteAll();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            <span>Yes, Delete All Data</span>
          </button>

          <button
            onClick={() => {
              onConfirmResetSample();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-[#0f131a] hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset to Default Demo Sample Data</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors text-center"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
