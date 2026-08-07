import React, { useState, useEffect } from 'react';
import { ViewTab, DisplayCurrency } from '../types';
import { LayoutDashboard, Receipt, Wallet, Target, Repeat, TrendingUp, Sparkles, Upload, PlusCircle, RefreshCw, Trash2, Sliders, BarChart3, UserCheck, LogIn } from 'lucide-react';
import { getSupabaseClient, signInWithGoogle } from '../lib/supabase';

interface NavbarProps {
  currentTab: ViewTab;
  setTab: (tab: ViewTab) => void;
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (curr: DisplayCurrency) => void;
  usdArsRate: number;
  setUsdArsRate: (rate: number) => void;
  onOpenAddModal: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetData: () => void;
  onOpenDeleteModal: () => void;
}

export function Navbar({
  currentTab,
  setTab,
  displayCurrency,
  setDisplayCurrency,
  usdArsRate,
  setUsdArsRate,
  onOpenAddModal,
  onFileUpload,
  onResetData,
  onOpenDeleteModal,
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
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl overflow-hidden border border-slate-700 shadow-lg">
              <img 
                src="/finlev_logo.jpg" 
                alt="Finlev Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="hidden xs:block">
              <h1 className="text-base sm:text-xl font-bold text-slate-100 tracking-tight leading-none">Finlev</h1>
              <p className="hidden sm:block text-[10px] text-slate-400 mt-1">Multi-Currency Intelligence</p>
            </div>
          </div>

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

            <div className="flex bg-[#161b22] p-0.5 sm:p-1 rounded-lg border border-slate-800 shrink-0">
              <button
                onClick={() => setDisplayCurrency('ARS')}
                className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all ${
                  displayCurrency === 'ARS'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                ARS
              </button>
              <button
                onClick={() => setDisplayCurrency('USD')}
                className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all ${
                  displayCurrency === 'USD'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                USD
              </button>
            </div>

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
