import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Plus,
  Grid,
  Globe
} from 'lucide-react';
import { getSupabaseClient, signInWithGoogle, signOutFromSupabase } from '../lib/supabase';
import { LevLevLogo } from './LevLevLogo';

// Helper for mobile tactile haptic feedback
const triggerHaptic = (pattern: number | number[] = 12) => {
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignore if unsupported
    }
  }
};

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
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

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
    triggerHaptic(10);
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
    triggerHaptic(15);
    try {
      await signOutFromSupabase();
    } catch (e) {
      console.warn('Logout error:', e);
    }
    if (onLogout) {
      onLogout();
    }
  };

  const currentLang = (i18n.language || 'en').substring(0, 2);
  const changeAndPersistLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    try {
      localStorage.setItem('finance_app_language', lang);
      localStorage.setItem('i18nextLng', lang);
    } catch (e) {}
  };
  const toggleLanguage = () => {
    const nextLang = currentLang === 'es' ? 'en' : 'es';
    changeAndPersistLanguage(nextLang);
  };

  const tabs: { id: ViewTab; label: string; shortLabel?: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t('nav.overview'), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'reports', label: t('nav.reports'), icon: <BarChart3 className="w-4 h-4 text-emerald-400" /> },
    { id: 'transactions', label: t('nav.transactions'), shortLabel: t('nav.transactions_short'), icon: <Receipt className="w-4 h-4" /> },
    { id: 'accounts', label: t('nav.accounts'), icon: <Wallet className="w-4 h-4" /> },
    { id: 'budgets', label: t('nav.budgets'), icon: <Target className="w-4 h-4" /> },
    { id: 'recurring', label: t('nav.recurring'), shortLabel: t('nav.recurring_short'), icon: <Repeat className="w-4 h-4" /> },
    { id: 'inflation', label: t('nav.inflation'), shortLabel: t('nav.inflation_short'), icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'ai-advisor', label: t('nav.ai_advisor'), icon: <Sparkles className="w-4 h-4 text-amber-500" /> },
    { id: 'settings', label: t('nav.settings'), icon: <Sliders className="w-4 h-4 text-slate-400" /> },
  ];

  return (
    <>
      <header className="bg-[#0f131a] border-b border-slate-800/80 sticky top-0 z-30 shadow-md backdrop-blur-md bg-opacity-95 max-w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 max-w-full">
          
          {/* MAIN TOP BAR */}
          <div className="flex justify-between items-center h-16 sm:h-20 gap-2">
            
            {/* Left: Brand Logo */}
            <button 
              onClick={() => {
                triggerHaptic(10);
                setTab('overview');
              }} 
              className="text-left focus:outline-none cursor-pointer group shrink-0 min-h-[44px] flex items-center"
            >
              <LevLevLogo badgeText="GLOBAL" size="md" hideSubtitleOnMobile={true} />
            </button>

            {/* Right Controls Container */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              
              {/* Language Switcher Segmented Control - Desktop Only */}
              <div className="hidden lg:flex items-center bg-[#161b22] p-1 rounded-xl border border-slate-700/80 shrink-0 min-h-[44px]">
                <Globe className="w-3.5 h-3.5 text-emerald-400 ml-2 mr-1" />
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    changeAndPersistLanguage('en');
                  }}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    currentLang === 'en'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Switch to English"
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    changeAndPersistLanguage('es');
                  }}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    currentLang === 'es'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Cambiar a Español"
                >
                  ES
                </button>
              </div>

              {/* DESKTOP "ADD TRANSACTION" BUTTON */}
              <button
                onClick={() => {
                  triggerHaptic([15, 30, 20]);
                  onOpenAddModal();
                }}
                className="hidden lg:inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/50 border border-emerald-400/30 transition-all transform active:scale-95 shrink-0 cursor-pointer min-h-[44px]"
              >
                <Plus className="w-4.5 h-4.5 text-emerald-100 stroke-[3]" />
                <span className="font-extrabold tracking-tight">{t('nav.new_transaction')}</span>
              </button>

              {/* Currency Selector Pill - Desktop Only */}
              <div className="hidden sm:flex bg-[#161b22] p-1 rounded-xl border border-slate-800 shrink-0 items-center min-h-[44px]">
                <select
                  value={displayCurrency}
                  onChange={(e) => {
                    triggerHaptic(10);
                    setDisplayCurrency(e.target.value as DisplayCurrency);
                  }}
                  className="bg-[#0f131a] text-slate-200 text-xs font-bold px-2.5 py-2 rounded-lg border border-slate-700 focus:outline-none cursor-pointer hover:border-slate-600 transition-colors min-h-[36px]"
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
                <div className="flex items-center space-x-2 bg-[#161b22] p-1 rounded-xl border border-slate-800 text-xs min-h-[44px]">
                  <span className="text-slate-400 px-2 font-medium">{t('nav.rate')}</span>
                  <input
                    type="number"
                    value={usdArsRate}
                    onChange={(e) => setUsdArsRate(parseFloat(e.target.value) || 1000)}
                    className="w-20 px-2 py-1.5 bg-[#0f131a] border border-slate-700 rounded-lg font-semibold text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Privacy Mode */}
                <button
                  onClick={() => {
                    triggerHaptic(10);
                    if (onTogglePrivacyMode) onTogglePrivacyMode();
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all shrink-0 active:scale-95 min-h-[44px] min-w-[44px] ${
                    privacyMode
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-xs shadow-amber-950/50'
                      : 'bg-[#161b22] border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title={privacyMode ? 'Privacy Mode Active (Figures Masked)' : 'Enable Privacy Mode'}
                >
                  {privacyMode ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      <span>{t('nav.private')}</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t('nav.privacy')}</span>
                    </>
                  )}
                </button>

                {/* Share Household */}
                <button
                  onClick={() => {
                    triggerHaptic(10);
                    if (onOpenShareWorkspaceModal) onOpenShareWorkspaceModal();
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all shrink-0 active:scale-95 min-h-[44px] min-w-[44px] ${
                    isWorkspaceShared
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-xs shadow-purple-950/50'
                      : 'bg-[#161b22] border-slate-700 text-purple-300 hover:text-white hover:bg-slate-800'
                  }`}
                  title="Share Workspace with family or partner"
                >
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <span>
                    {isWorkspaceShared ? `Household (${workspaceMembersCount})` : t('nav.share_household')}
                  </span>
                </button>

                {/* Import CSV */}
                <button
                  onClick={() => {
                    triggerHaptic(10);
                    onOpenImportModal();
                  }}
                  className="cursor-pointer inline-flex items-center justify-center px-3.5 py-2.5 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 bg-[#161b22] hover:bg-slate-800 transition-colors shrink-0 min-h-[44px] min-w-[44px]"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  <span>Import</span>
                </button>

                {/* Google SSO Login */}
                <button
                  onClick={handleSsoClick}
                  className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all shrink-0 min-h-[44px] min-w-[44px] ${
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
                    className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition-all shrink-0 active:scale-95 min-h-[44px] min-w-[44px]"
                    title="Log out"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Logout</span>
                  </button>
                )}

                {/* Delete Data */}
                <button
                  onClick={() => {
                    triggerHaptic(15);
                    onOpenDeleteModal();
                  }}
                  title="Delete data"
                  className="p-2.5 text-rose-500/60 hover:text-rose-400 transition-colors rounded-xl hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* MOBILE TOOLS MENU TOGGLE BUTTON */}
              <button
                onClick={() => {
                  triggerHaptic(12);
                  setMobileToolsOpen(prev => !prev);
                }}
                className={`lg:hidden p-2.5 rounded-xl border transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${
                  mobileToolsOpen
                    ? 'bg-slate-800 text-white border-slate-600'
                    : 'bg-[#161b22] text-slate-300 border-slate-800 hover:text-white'
                }`}
                title="More Options & Settings"
              >
                {mobileToolsOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                
                {/* Rate setting */}
                <div className="col-span-2 flex items-center justify-between bg-[#0a0c10] px-3 py-2 rounded-xl border border-slate-800 min-h-[44px]">
                  <span className="text-slate-400 font-medium">USD/ARS FX Rate:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">$</span>
                    <input
                      type="number"
                      value={usdArsRate}
                      onChange={(e) => setUsdArsRate(parseFloat(e.target.value) || 1000)}
                      className="w-24 px-2 py-1.5 bg-[#161b22] border border-slate-700 rounded-lg font-semibold text-slate-200 text-right focus:outline-none"
                    />
                  </div>
                </div>

                {/* Display Currency Selection (Mobile) */}
                <div className="col-span-2 flex items-center justify-between bg-[#0a0c10] px-3 py-2 rounded-xl border border-slate-800 min-h-[44px]">
                  <span className="text-slate-400 font-medium">Display Currency:</span>
                  <select
                    value={displayCurrency}
                    onChange={(e) => {
                      triggerHaptic(10);
                      setDisplayCurrency(e.target.value as DisplayCurrency);
                    }}
                    className="bg-[#161b22] text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none cursor-pointer"
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

                {/* Privacy Mode Toggle */}
                <button
                  onClick={() => {
                    triggerHaptic(10);
                    if (onTogglePrivacyMode) onTogglePrivacyMode();
                  }}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl font-bold border transition-all min-h-[44px] ${
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
                    triggerHaptic(10);
                    if (onOpenShareWorkspaceModal) onOpenShareWorkspaceModal();
                    setMobileToolsOpen(false);
                  }}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl font-bold border transition-all min-h-[44px] ${
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
                    triggerHaptic(10);
                    onOpenImportModal();
                    setMobileToolsOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl font-bold bg-[#161b22] border border-slate-800 text-slate-300 hover:text-white min-h-[44px]"
                >
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>Import CSV</span>
                </button>

                {/* Language Switcher Segmented Control (Mobile) */}
                <div className="flex items-center justify-between bg-[#161b22] px-3 py-2 rounded-xl border border-slate-800 min-h-[44px]">
                  <span className="text-slate-400 font-medium text-xs flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Language / Idioma:</span>
                  </span>
                  <div className="flex items-center bg-[#0d1117] p-1 rounded-lg border border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        changeAndPersistLanguage('en');
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                        currentLang === 'en'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        changeAndPersistLanguage('es');
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                        currentLang === 'es'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ES
                    </button>
                  </div>
                </div>

                {/* Google SSO Login / Account */}
                <button
                  onClick={() => {
                    triggerHaptic(10);
                    handleSsoClick();
                    setMobileToolsOpen(false);
                  }}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl font-bold border transition-all min-h-[44px] ${
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
                      triggerHaptic(15);
                      handleLogoutClick();
                      setMobileToolsOpen(false);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 min-h-[44px]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                ) : <div />}

                <button
                  onClick={() => {
                    triggerHaptic(15);
                    onOpenDeleteModal();
                    setMobileToolsOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-rose-400/80 hover:text-rose-400 border border-slate-700 min-h-[44px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset / Delete Data</span>
                </button>
              </div>
            </div>
          )}

          {/* DESKTOP NAVIGATION TABS */}
          <nav className="hidden lg:flex space-x-1.5 overflow-x-auto no-scrollbar py-2.5 border-t border-slate-800/80">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    triggerHaptic(10);
                    setTab(tab.id);
                  }}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer min-h-[44px] min-w-[44px] shrink-0 active:scale-95 ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-slate-400'}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* MOBILE BOTTOM-DOCKED NAVIGATION BAR */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c0e14]/95 backdrop-blur-xl border-t border-slate-800/90 shadow-2xl px-2 py-1.5 pb-safe flex items-center justify-around max-w-full overflow-x-hidden">
        
        {/* 1. Overview */}
        <button
          onClick={() => {
            triggerHaptic(12);
            setTab('overview');
            setMoreMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[56px] px-2 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
            currentTab === 'overview'
              ? 'text-emerald-400 font-extrabold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 ${currentTab === 'overview' ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight font-semibold">Overview</span>
        </button>

        {/* 2. Transactions */}
        <button
          onClick={() => {
            triggerHaptic(12);
            setTab('transactions');
            setMoreMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[56px] px-2 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
            currentTab === 'transactions'
              ? 'text-emerald-400 font-extrabold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className={`w-5 h-5 ${currentTab === 'transactions' ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight font-semibold">Txs</span>
        </button>

        {/* 3. CENTER PROMINENT FLOATING "+ NEW TRANSACTION" ACTION BUTTON WITH DISTINCT HAPTIC FEEDBACK */}
        <button
          onClick={() => {
            triggerHaptic([15, 30, 20]);
            onOpenAddModal();
            setMoreMenuOpen(false);
          }}
          className="-translate-y-4 flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-400 text-white shadow-xl shadow-emerald-500/30 border-4 border-[#0a0b0d] hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer min-h-[56px] min-w-[56px]"
          title="Create New Transaction"
        >
          <Plus className="w-6 h-6 stroke-[3] text-white" />
        </button>

        {/* 4. Accounts */}
        <button
          onClick={() => {
            triggerHaptic(12);
            setTab('accounts');
            setMoreMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[56px] px-2 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
            currentTab === 'accounts'
              ? 'text-emerald-400 font-extrabold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wallet className={`w-5 h-5 ${currentTab === 'accounts' ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight font-semibold">Accounts</span>
        </button>

        {/* 5. More Tabs Menu Drawer Trigger */}
        <button
          onClick={() => {
            triggerHaptic(12);
            setMoreMenuOpen(prev => !prev);
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[56px] px-2 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
            moreMenuOpen || !['overview', 'transactions', 'accounts'].includes(currentTab)
              ? 'text-emerald-400 font-extrabold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Grid className={`w-5 h-5 ${moreMenuOpen || !['overview', 'transactions', 'accounts'].includes(currentTab) ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight font-semibold">More</span>
        </button>
      </nav>

      {/* MOBILE ALL TABS DRAWER / SHEET */}
      {moreMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 max-w-full overflow-x-hidden">
          <div 
            className="fixed inset-0" 
            onClick={() => {
              triggerHaptic(10);
              setMoreMenuOpen(false);
            }} 
          />
          <div className="relative z-10 bg-[#121620] border-t border-slate-800 rounded-t-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 duration-200 max-h-[80vh] overflow-y-auto max-w-full">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Grid className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-white text-base">All Views & Modules</h3>
              </div>
              <button 
                onClick={() => {
                  triggerHaptic(10);
                  setMoreMenuOpen(false);
                }}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {tabs.map((tab) => {
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      triggerHaptic(12);
                      setTab(tab.id);
                      setMoreMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border text-xs font-bold transition-all min-h-[52px] cursor-pointer text-left ${
                      isActive
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-950/40'
                        : 'bg-[#181d28] border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                      {tab.icon}
                    </div>
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
