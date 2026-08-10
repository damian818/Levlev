import React, { useState } from 'react';
import { LayoutDashboard, LineChart, CreditCard, Sparkles } from 'lucide-react';

interface PreviewTab {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  image: string;
  features: string[];
}

export const AppPreview: React.FC = () => {
  const tabs: PreviewTab[] = [
    {
      id: 'dashboard',
      title: 'Net Worth & Multi-Currency',
      subtitle: 'Real-time overview of ARS and USD balances converted at live Dólar MEP rates.',
      icon: <LayoutDashboard className="w-4 h-4" />,
      image: '/assets/images/dashboard_preview_1786150416027.jpg',
      features: [
        'Instant ARS/USD toggle',
        'Bank, Deel, DollarApp & cash sync',
        'Privacy mode for discreet balances',
      ],
    },
    {
      id: 'analytics',
      title: 'Inflation & IPC Purchasing Power',
      subtitle: 'Evaluate nominal income against INDEC IPC inflation to protect real wealth.',
      icon: <LineChart className="w-4 h-4" />,
      image: '/assets/images/analytics_preview_1786150432307.jpg',
      features: [
        'Historical INDEC IPC charts',
        'ARS purchasing power loss tracker',
        'Category trend breakdown',
      ],
    },
    {
      id: 'accounts',
      title: 'Accounts, Cards & Cuotas',
      subtitle: 'Manage credit card closing dates, installment payments (cuotas), and shared budgets.',
      icon: <CreditCard className="w-4 h-4" />,
      image: '/assets/images/accounts_preview_1786150446819.jpg',
      features: [
        'Installment statement dates',
        'Account-level custom balances',
        'Shared workspace members',
      ],
    },
  ];

  const [activeTabId, setActiveTabId] = useState<string>('dashboard');
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  return (
    <section className="py-12 px-4 max-w-6xl mx-auto w-full">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive Preview</span>
        </div>
        <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Explore the LevLev Platform
        </h3>
        <p className="text-slate-400 text-sm sm:text-base mt-2 max-w-xl mx-auto">
          Designed specifically for multi-currency financial reality with inflation adjustment and cuotas management.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/30 scale-[1.02]'
                  : 'bg-[#11151f] text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {tab.icon}
              <span>{tab.title}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Preview Card */}
      <div className="bg-[#11151f]/80 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-sm">
        <div className="mb-4 text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-lg sm:text-xl font-bold text-slate-100">{activeTab.title}</h4>
            <p className="text-slate-400 text-xs sm:text-sm">{activeTab.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {activeTab.features.map((feature, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px] font-medium"
              >
                ✓ {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Featured Image */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950 group shadow-inner">
          <img
            src={activeTab.image}
            alt={activeTab.title}
            className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.01]"
          />
          <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
        </div>
      </div>
    </section>
  );
};
