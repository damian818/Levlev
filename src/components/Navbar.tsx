import React, { useState, useEffect } from 'react';
import { ViewTab, DisplayCurrency } from '../types';
import { LayoutDashboard, Receipt, Wallet, Target, Repeat, TrendingUp, Sparkles, Upload, PlusCircle, RefreshCw, Trash2, Sliders, BarChart3, UserCheck, LogIn, LogOut, Eye, EyeOff, Shield } from 'lucide-react';
import { getSupabaseClient, signInWithGoogle, signOutFromSupabase } from '../lib/supabase';
import { LevLevLogo } from './LevLevLogo';

interface NavbarProps {
  currentTab: ViewTab;
  setTab: (tab: ViewTab) => void;
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (curr: DisplayCurrency) => void;
  usdArsRate: number;
  setUsdArsRate: (rate: number) => void;
  privacyMode?: boolean;
  onTogglePrivacyMode?: () => void;
  onOpenAddModal: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetData: () => void;
  onOpenDeleteModal: () => void;
  onLogout?: () => void;
}

export function Navbar({
  currentTab,
  setTab,
  displayCurrency,
  setDisplayCurrency,
  usdArsRate,
  setUsdArsRate,
  privacyMode = false,
  onTogglePrivacyMode,
  onOpenAddModal,
  onFileUpload,
  onResetData,
  onOpenDeleteModal,
  onLogout,
}: NavbarProps) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (client) {
      client.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user || null);
      });
      const { data: { subscription } } = client.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user || null);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const handleSsoClick = async () => {
    if (user) {
      setTab('settings');
    } else {
      const { error } = await signInWithGoogle();
      if (error) {
        setTab('settings');
      }
    }
  };

  const handleLogoutClick = async () => {
    try {
      await signOutFromSupabase();
    } catch (e) {
      console.warn('Logout error:', e);
    }
    if (onLogout) {
      onLogout();
    }
  };

  const tabs: { id: ViewTab; label: string; shortLabel?: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4 text-emerald-400" /> },
    { id: 'transactions', label: 'Transactions', shortLabel: 'Txs', icon: <Receipt className="w-4 h-4" /> },
    { id: 'accounts', label: 'Accounts', icon: <Wallet className="w-4 h-4" /> },
    { id: 'budgets', label: 'Budgets', icon: <Target className="w-4 h-4" /> },
    { id: 'recurring', label: 'Recurring & Installments', shortLabel: 'Recurring', icon: <Repeat className="w-4 h-4" /> },
    { id: 'inflation', label: 'Inflation vs FX', shortLabel: 'Eco', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'ai-advisor', label: 'AI Advisor', icon: <Sparkles className="w-4 h-4 text-amber-500" /> },
    { id: 'settings', label: 'Settings', icon: <Sliders className="w-4 h-4 text-slate-400" /> },
  ];

  return (
    <header className="bg-[#0f131a] border-b border-slate-800/80 sticky top-0 z-30 shadow-md backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20 gap-2">
          {/* Logo / Title */}
          <button onClick={() => setTab('overview')} className="text-left focus:outline-none cursor-pointer group">
            <LevLevLogo badgeText="GLOBAL" size="md" />
          </button>

          {/* Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto no-scrollbar py-1">
            <div className="hidden lg:flex items-center space-x-2 bg-[#161b22] p-1 rounded-lg border border-slate-800 text-[10px] sm:text-xs">
              <span className="text-slate-400 px-2 font-medium">Rate:</span>
              <input
                type="number"
                value={usdArsRate}
                onChange={(e) => setUsdArsRate(parseFloat(e.target.value) || 1000)}
                className="w-16 sm:w-20 px-2 py-1 bg-[#0f131a] border border-slate-700 rounded font-semibold text-slate-200 focus:outline-none"
              />
            </div>

            <div className="flex bg-[#161b22] p-0.5 sm:p-1 rounded-lg border border-slate-800 shrink-0 items-center">
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
                className="bg-[#0f131a] text-slate-200 text-[10px] sm:text-xs font-bold px-2 py-1 rounded border border-slate-700 focus:outline-none cursor-pointer hover:border-slate-600 transition-colors"
                title="Select active view currency"
              >
                <option value="ARS">ARS ($)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="BRL">BRL (R$)</option>
                <option value="GBP">GBP (£)</option>
                <option value="MXN">MXN ($)</option>
                <option value="CLP">CLP ($)</option>
                <option value="USDT">USDT (₮)</option>
              </select>
            </div>

            {/* Privacy Mode Quick Toggle Button */}
            <button
              onClick={onTogglePrivacyMode}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold border transition-all shrink-0 active:scale-95 ${
                privacyMode
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-xs shadow-amber-950/50'
                  : 'bg-[#161b22] border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title={privacyMode ? 'Privacy Mode Active (Figures Masked)' : 'Enable Privacy Mode'}
            >
              {privacyMode ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span className="hidden sm:inline font-semibold">Private</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline font-normal">Privacy</span>
                </>
              )}
            </button>

            <label className="cursor-pointer inline-flex items-center px-2 sm:px-3 py-1.5 border border-slate-800 rounded-lg text-[10px] sm:text-xs font-medium text-slate-300 bg-[#161b22] hover:bg-slate-800 transition-colors shrink-0">
              <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5 sm:mr-1.5 text-slate-400" />
              <span className="hidden sm:inline">Import</span>
              <input type="file" accept=".csv" onChange={onFileUpload} className="hidden" />
            </label>

            <button
              onClick={onOpenAddModal}
              className="inline-flex items-center px-2 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] sm:text-xs font-bold transition-all shadow-sm shrink-0 active:scale-95"
            >
              <PlusCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Add</span>
            </button>

            {/* Google SSO Login / Status Badge */}
            <button
              onClick={handleSsoClick}
              className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold border transition-all shrink-0 ${
                user
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-[#161b22] border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title={user ? `Signed in as ${user.email}` : 'Sign in with Google SSO'}
            >
              {user ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden md:inline font-mono text-[11px] max-w-[120px] truncate">{user.email?.split('@')[0]}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5 text-teal-400" />
                  <span className="hidden sm:inline">Google SSO</span>
                </>
              )}
            </button>

            {/* Logout Button */}
            {(user || onLogout) && (
              <button
                onClick={handleLogoutClick}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold bg-slate-800/80 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition-all shrink-0 active:scale-95"
                title="Log out of session"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden lg:inline">Logout</span>
              </button>
            )}

            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={onResetData}
                title="Reset to sample data"
                className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-200 transition-colors rounded-lg hover:bg-[#161b22] border border-transparent hover:border-slate-800"
              >
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 h-4" />
              </button>

              <button
                onClick={onOpenDeleteModal}
                title="Delete data"
                className="p-1.5 sm:p-2 text-rose-500/60 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto no-scrollbar py-2 border-t border-slate-800/80">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-slate-500'}>{tab.icon}</span>
                <span>
                  <span className="sm:hidden">{tab.shortLabel || tab.label}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
