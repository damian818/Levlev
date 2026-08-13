import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:bottom-8 z-[100] flex items-center justify-between p-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-500/20 rounded-xl">
          <RefreshCw className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white">
            {offlineReady ? 'App ready to work offline' : 'New version available!'}
          </span>
          <span className="text-xs text-slate-400">
            {offlineReady ? 'You can use LevLev without internet' : 'Click reload to update the application'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {needRefresh && (
          <button
            onClick={() => updateServiceWorker(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-900/40"
          >
            Reload
          </button>
        )}
        <button
          onClick={close}
          className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
