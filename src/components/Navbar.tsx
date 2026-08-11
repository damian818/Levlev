import React, { useState, useEffect } from 'react';
import { ViewTab, DisplayCurrency } from '../types';
import { 
  LayoutDashboard, 
  Receipt, 
  Wallet, 
  Target, 
  Repeat, 
  TrendingUp, 
  Sparkles, 
  Upload, 
  PlusCircle, 
  Trash2, 
  Sliders, 
  BarChart3, 
  UserCheck, 
  LogIn, 
  LogOut, 
  Eye, 
  EyeOff, 
  Users, 
  Menu, 
  X,
  Plus
} from 'lucide-react';
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
  isWorkspaceShared?: boolean;
  workspaceMembersCount?: number;
  onOpenShareWorkspaceModal?: () => void;
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
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
  isWorkspaceShared = false,
  workspaceMembersCount = 0,
  onOpenShareWorkspaceModal,
  onOpenAddModal,
  onOpenImportModal,
  onOpenDeleteModal,
  onLogout,
}: NavbarProps) {
  const [user, setUser] = useState<any>(null);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);

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
        
        {/* MAIN TOP BAR */}
        <div className="flex justify-between items-center h-16 sm:h-20 gap-2">
          
          {/* Left: Brand Logo */}
          <button onClick={() => setTab('overview')} className="text-left focus:outline-none cursor-pointer group shrink-0">
            <LevLevLogo badgeText="GLOBAL" size="md" />
          </button>

          {/* Right Controls Container */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            
            {/* PROMINENT HIGH-PRIORITY "ADD TRANSACTION" BUTTON (Always visible on mobile & desktop) */}
            <button
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/50 border border-emerald-400/30 transition-all transform active:scale-95 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-100 stroke-[3]" />
              <span className="inline font-extrabold tracking-tight">
                <span className="sm:hidden">+ New</span>
                <span className="hidden sm:inline">+ New Transaction</span>
              </span>
            </button>

            {/* Currency Pill Dropdown */}
            <div className="flex bg-[#161b22] p-1 rounded-xl border border-slate-800 shrink-0 items-center">
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
                className="bg-[#0f131a] text-slate-200 text-xs font-bold px-2 py-1 rounded-lg border border-slate-700 focus:outline-none cursor-pointer hover:border-slate-600 transition-colors"
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

            {/* DESKTOP QUICK ACTIONS ROW */}
            <div className="hidden lg:flex items-center space-x-2">
              
              {/* Rate input */}
              <div className="flex items-center space-x-2 bg-[#161b22] p-1 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 px-2 font-medium">Rate:</span>
                <input
                  type="number"
                  value={usdArsRate}
                  onChange={(e) => setUsdArsRate(parseFloat(e.target.value) || 1000)}
                  className="w-20 px-2 py-1 bg-[#0f131a] border border-slate-700 rounded-lg font-semibold text-slate-200 focus:outline-none"
                />
              </div>

              {/* Privacy Mode */}
              <button
                onClick={onTogglePrivacyMode}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 active:scale-95 ${
                  privacyMode
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-xs shadow-amber-950/50'
                    : 'bg-[#161b22] border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={privacyMode ? 'Privacy Mode Active (Figures Masked)' : 'Enable Privacy Mode'}
              >
                {privacyMode ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>Private</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Privacy</span>
                  </>
                )}
              </button>

              {/* Share Household */}
              <button
                onClick={onOpenShareWorkspaceModal}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 active:scale-95 ${
                  isWorkspaceShared
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-xs shadow-purple-950/50'
                    : 'bg-[#161b22] border-slate-700 text-purple-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Share Workspace with family or partner"
              >
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <span>
                  {isWorkspaceShared ? `Household (${workspaceMembersCount})` : 'Share Household'}
                </span>
              </button>

              {/* Import CSV */}
              <button
                onClick={onOpenImportModal}
                className="cursor-pointer inline-flex items-center px-3 py-2 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 bg-[#161b22] hover:bg-slate-800 transition-colors shrink-0"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                <span>Import</span>
              </button>

              {/* Google SSO Login */}
              <button
                onClick={handleSsoClick}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 ${
                  user
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-[#161b22] border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title={user ? `Signed in as ${user.email}` : 'Sign in with Google SSO'}
              >
                {user ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-[11px] max-w-[100px] truncate">{user.email?.split('@')[0]}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5 text-teal-400" />
                    <span>Google SSO</span>
                  </>
                )}
              </button>

              {/* Logout */}
              {(user || onLogout) && (
                <button
                  onClick={handleLogoutClick}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition-all shrink-0 active:scale-95"
                  title="Log out"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Logout</span>
                </button>
              )}

              {/* Delete Data */}
              <button
                onClick={onOpenDeleteModal}
                title="Delete data"
                className="p-2 text-rose-500/60 hover:text-rose-400 transition-colors rounded-xl hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* MOBILE / SMALL TABLET TOOLS MENU TOGGLE BUTTON */}
            <button
              onClick={() => setMobileToolsOpen(prev => !prev)}
              className={`lg:hidden p-2.5 rounded-xl border transition-all ${
                mobileToolsOpen
                  ? 'bg-slate-800 text-white border-slate-600'
                  : 'bg-[#161b22] text-slate-300 border-slate-800 hover:text-white'
              }`}
              title="More Options & Settings"
            >
              {mobileToolsOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* EXPANDABLE MOBILE QUICK TOOLS TRAY */}
        {mobileToolsOpen && (
          <div className="lg:hidden p-3.5 bg-[#121722] border-t border-b border-slate-800 rounded-2xl mb-2 space-y-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 border-b border-slate-800 pb-2">
              <span>Quick Options & Preferences</span>
              <span className="text-[10px] text-slate-500 font-mono">LevLev Tools</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              
              {/* Rate setting */}
              <div className="col-span-2 flex items-center justify-between bg-[#0a0c10] p-2 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-medium">USD/ARS FX Rate:</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">$</span>
                  <input
                    type="number"
                    value={usdArsRate}
                    onChange={(e) => setUsdArsRate(parseFloat(e.target.value) || 1000)}
                    className="w-20 px-2 py-1 bg-[#161b22] border border-slate-700 rounded-lg font-semibold text-slate-200 text-right focus:outline-none"
                  />
                </div>
              </div>

              {/* Privacy Mode Toggle */}
              <button
                onClick={() => {
                  if (onTogglePrivacyMode) onTogglePrivacyMode();
                }}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl font-bold border transition-all ${
                  privacyMode
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-[#161b22] border-slate-800 text-slate-300'
                }`}
              >
                {privacyMode ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                <span>{privacyMode ? 'Private Mode' : 'Privacy Off'}</span>
              </button>

              {/* Share Household */}
              <button
                onClick={() => {
                  if (onOpenShareWorkspaceModal) onOpenShareWorkspaceModal();
                  setMobileToolsOpen(false);
                }}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl font-bold border transition-all ${
                  isWorkspaceShared
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-[#161b22] border-slate-800 text-purple-300'
                }`}
              >
                <Users className="w-4 h-4 text-purple-400" />
                <span>{isWorkspaceShared ? `Household (${workspaceMembersCount})` : 'Share House'}</span>
              </button>

              {/* Import CSV */}
              <button
                onClick={() => {
                  onOpenImportModal();
                  setMobileToolsOpen(false);
                }}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl font-bold bg-[#161b22] border border-slate-800 text-slate-300 hover:text-white"
              >
                <Upload className="w-4 h-4 text-slate-400" />
                <span>Import CSV</span>
              </button>

              {/* Google SSO Login / Account */}
              <button
                onClick={() => {
                  handleSsoClick();
                  setMobileToolsOpen(false);
                }}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl font-bold border transition-all ${
                  user
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-[#161b22] border-slate-800 text-slate-300'
                }`}
              >
                {user ? <UserCheck className="w-4 h-4 text-emerald-400" /> : <LogIn className="w-4 h-4 text-teal-400" />}
                <span className="truncate">{user ? user.email?.split('@')[0] : 'Google SSO'}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              {user || onLogout ? (
                <button
                  onClick={() => {
                    handleLogoutClick();
                    setMobileToolsOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              ) : <div />}

              <button
                onClick={() => {
                  onOpenDeleteModal();
                  setMobileToolsOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-rose-400/80 hover:text-rose-400 border border-slate-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset / Delete Data</span>
              </button>
            </div>
          </div>
        )}

        {/* NAVIGATION TABS (TOUCH-OPTIMIZED HORIZONTAL SCROLL) */}
        <nav className="flex space-x-1.5 overflow-x-auto no-scrollbar py-2.5 border-t border-slate-800/80">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`flex items-center space-x-1.5 sm:space-x-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer min-h-[42px] shrink-0 active:scale-95 ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-slate-400'}>{tab.icon}</span>
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
