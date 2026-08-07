import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogOut, UserCheck } from 'lucide-react';
import { signOutFromSupabase } from '../lib/supabase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleResetCache = () => {
    try {
      localStorage.removeItem('finance_app_transactions');
      localStorage.removeItem('finance_app_budgets');
      localStorage.removeItem('finance_app_account_balances');
      localStorage.setItem('finlev_guest_mode', 'true');
      localStorage.setItem('levlev_guest_mode', 'true');
    } catch (e) {
      console.warn('Cache clear error:', e);
    }
    window.location.href = window.location.origin;
  };

  private handleSignOut = async () => {
    try {
      await signOutFromSupabase();
    } catch (e) {
      console.warn('Sign out failed:', e);
    }
    try {
      localStorage.setItem('finlev_guest_mode', 'false');
      localStorage.setItem('levlev_guest_mode', 'false');
    } catch (e) {
      console.warn('Storage set error:', e);
    }
    window.location.href = window.location.origin;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0b0d] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mb-6 text-rose-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-slate-400 max-w-md text-sm mb-6">
            An unexpected error occurred while loading or rendering the application.
          </p>

          {this.state.error && (
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 text-left font-mono text-xs text-rose-300 overflow-x-auto max-h-48">
              <p className="font-bold mb-1">{this.state.error.toString()}</p>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 max-w-md w-full">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm flex items-center gap-2 transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" /> Reload App
            </button>
            <button
              onClick={this.handleSignOut}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-sm flex items-center gap-2 border border-slate-700 transition-all active:scale-95"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
            <button
              onClick={this.handleResetCache}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 font-semibold rounded-xl text-xs flex items-center gap-2 border border-slate-800 transition-all"
            >
              <UserCheck className="w-4 h-4" /> Reset Cache &amp; Guest Mode
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
