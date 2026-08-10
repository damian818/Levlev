import React, { useState } from 'react';
import {
  Wallet,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Lock,
  DollarSign,
  ChevronDown,
  HelpCircle,
  Zap,
  Globe,
  Users,
  CheckCircle2,
  PieChart,
  Calculator,
  RefreshCw
} from 'lucide-react';
import { LevLevIcon, LevLevLogo } from './LevLevLogo';
import { AppPreview } from './AppPreview';

interface LandingPageProps {
  onSignInWithGoogle: () => void;
  onEnterGuestMode: () => void;
  authError?: string | null;
  usdArsRate?: number;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignInWithGoogle,
  onEnterGuestMode,
  authError,
  usdArsRate = 1521,
}) => {
  // Simulator State for interactive FX / Inflation preview widget
  const [simUsdAmount, setSimUsdAmount] = useState<number>(1000);
  const [simArsRate, setSimArsRate] = useState<number>(usdArsRate);
  const [simInflationRate, setSimInflationRate] = useState<number>(4.2); // Monthly %

  // Calculator estimates:
  const simTotalArs = simUsdAmount * simArsRate;
  const yearlyInflationCompounded = Math.pow(1 + simInflationRate / 100, 12) - 1;
  const lostPurchasingPowerArs = simTotalArs * (yearlyInflationCompounded / (1 + yearlyInflationCompounded));

  // FAQ Accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does LevLev calculate my net worth across ARS and USD?',
      a: 'LevLev automatically converts all accounts (bank balances, credit cards, Deel, DollarApp, cash) into your preferred display currency (ARS or USD) using live Dólar MEP exchange rates. You can also override custom conversion rates at any time.',
    },
    {
      q: 'Is my financial data safe and private?',
      a: 'Yes, 100%. LevLev runs client-side inside your browser with optional encrypted Supabase cloud backup. We never sell, track, or share your financial records with third parties.',
    },
    {
      q: 'How does credit card cuotas (installments) tracking work?',
      a: 'LevLev lets you log installment purchases (e.g. 12 cuotas fijas). It automatically calculates monthly closing dates, remaining installments, and evaluates the real cost after inflation.',
    },
    {
      q: 'Do I need a credit card or bank credentials to use LevLev?',
      a: 'No! LevLev does not connect directly to open-banking APIs or request bank passwords. You maintain total control by importing CSV statements or manually adding transactions with one click.',
    },
    {
      q: 'What is Guest / Demo Mode?',
      a: 'Guest Mode allows you to instantly explore all features, sample transactions, charts, and AI advisors with pre-filled mock data—without signing in or creating an account.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-slate-100 flex flex-col justify-between selection:bg-rose-500 selection:text-white font-sans relative overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-rose-500/5 blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-2/3 right-0 w-[500px] h-[500px] bg-emerald-500/5 blur-3xl pointer-events-none -z-10" />

      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-[#0f131a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <LevLevLogo badgeText="INTELLIGENCE" size="md" />

          <div className="flex items-center gap-3">
            <button
              onClick={onEnterGuestMode}
              className="px-3.5 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl transition-all border border-slate-700/80 flex items-center gap-1.5 active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Explore Demo</span>
            </button>

            <button
              onClick={onSignInWithGoogle}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 active:scale-95"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero & Content Section */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 flex flex-col items-center">
        {/* Top Announcement Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/90 border border-slate-700/80 text-rose-300 text-xs font-semibold mb-6 shadow-inner animate-pulse">
          <LevLevIcon className="w-4 h-4 shrink-0" variant="white" />
          <span>Multi-Currency ARS/USD &amp; Inflation Intelligence Engine</span>
        </div>

        {/* Hero Headline */}
        <h1 className="text-3xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight max-w-4xl text-center leading-[1.12] mb-6">
          Master your net worth with{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-rose-400 bg-clip-text text-transparent">
            clarity, precision &amp; heart
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="text-slate-400 text-sm sm:text-xl max-w-2xl text-center mb-10 leading-relaxed font-normal">
          Track multi-currency accounts in ARS &amp; USD, monitor live Dólar MEP rates, evaluate real INDEC inflation purchasing power, and manage cuotas effortlessly.
        </p>

        {/* CTA Action Cluster */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mb-6">
          <button
            onClick={onSignInWithGoogle}
            className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-900/40 transition-all active:scale-95 flex items-center justify-center gap-2.5 text-base sm:text-lg w-full group"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
            </svg>
            <span>Sign in with Google</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={onEnterGuestMode}
            className="px-6 py-4 bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl border border-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2 text-base sm:text-lg w-full sm:w-auto shrink-0"
          >
            <Zap className="w-5 h-5 text-amber-400" />
            <span>Try Live Demo</span>
          </button>
        </div>

        {/* Auth Error Notification */}
        {authError && (
          <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs max-w-md text-left w-full">
            <strong className="block font-semibold mb-0.5">Authentication Note:</strong>
            {authError}
          </div>
        )}

        {/* Security & Live Rate Pill */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 mb-16">
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Client-side Privacy Encrypted</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
            <span>Dólar MEP Rate: <strong className="text-slate-200">${usdArsRate.toLocaleString()} ARS</strong></span>
          </div>
        </div>

        {/* Interactive FX & Inflation Simulator */}
        <section className="w-full max-w-4xl bg-gradient-to-b from-[#11151f] to-[#0d1018] border border-slate-800 rounded-3xl p-6 sm:p-8 mb-20 shadow-2xl relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800/80">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold mb-2">
                <Calculator className="w-3.5 h-3.5" />
                <span>Interactive Yield &amp; Inflation Simulator</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                See How Inflation Affects Your ARS vs USD Holdings
              </h3>
            </div>
            <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              Live Interactive Widget
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Input Controls */}
            <div className="md:col-span-2 space-y-5">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
                  <label htmlFor="sim-usd-amount">USD Balance or Salary ($USD):</label>
                  <span className="text-emerald-400 font-bold">${simUsdAmount.toLocaleString()} USD</span>
                </div>
                <input
                  id="sim-usd-amount"
                  aria-label="USD Balance or Salary ($USD)"
                  type="range"
                  min="100"
                  max="10000"
                  step="100"
                  value={simUsdAmount}
                  onChange={(e) => setSimUsdAmount(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
                  <label htmlFor="sim-mep-rate">Dólar MEP Rate ($ARS / USD):</label>
                  <span className="text-teal-400 font-bold">${simArsRate.toLocaleString()} ARS</span>
                </div>
                <input
                  id="sim-mep-rate"
                  aria-label="Dólar MEP Rate ($ARS / USD)"
                  type="range"
                  min="800"
                  max="2500"
                  step="10"
                  value={simArsRate}
                  onChange={(e) => setSimArsRate(Number(e.target.value))}
                  className="w-full accent-teal-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
                  <label htmlFor="sim-monthly-ipc">Estimated Monthly IPC Inflation (%):</label>
                  <span className="text-rose-400 font-bold">{simInflationRate.toFixed(1)}% / month</span>
                </div>
                <input
                  id="sim-monthly-ipc"
                  aria-label="Estimated Monthly IPC Inflation (%)"
                  type="range"
                  min="1.0"
                  max="15.0"
                  step="0.1"
                  value={simInflationRate}
                  onChange={(e) => setSimInflationRate(Number(e.target.value))}
                  className="w-full accent-rose-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Live Calculation Result Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1">
                  12-Month Real Loss If Kept in Uninvested ARS:
                </span>
                <p className="text-2xl sm:text-3xl font-extrabold text-rose-400 mb-2">
                  -${Math.round(lostPurchasingPowerArs).toLocaleString()} ARS
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Equivalent to losing ~<strong>${Math.round(lostPurchasingPowerArs / simArsRate).toLocaleString()} USD</strong> in real purchasing power over 1 year.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 mt-4">
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  LevLev tracks inflation-adjusted wealth
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Screenshots Showcase */}
        <AppPreview />

        {/* Feature Grid (6 Detailed Feature Cards) */}
        <section className="w-full my-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Built for Modern Argentine &amp; International Finances
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-3 max-w-2xl mx-auto">
              Everything you need to navigate dual currencies, volatile FX markets, inflation, and complex credit card statements in one elegant dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {/* Card 1 */}
            <div className="bg-[#11151f] border border-slate-800/90 rounded-3xl p-6 hover:border-emerald-500/40 transition-all group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
                <Wallet className="w-6 h-6" />
              </div>
              <h3 className="text-slate-100 font-bold text-lg mb-2">Dual Currency ARS &amp; USD</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Automatically convert balances across Mercado Pago, Deel, DollarApp, Payoneer, local banks, and cash holding at live Dólar MEP rates.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-[#11151f] border border-slate-800/90 rounded-3xl p-6 hover:border-rose-500/40 transition-all group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-5 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-slate-100 font-bold text-lg mb-2">INDEC IPC Inflation Engine</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Evaluate your nominal net worth against official monthly INDEC IPC inflation to measure actual purchasing power growth or decay.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-[#11151f] border border-slate-800/90 rounded-3xl p-6 hover:border-teal-500/40 transition-all group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-5 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-slate-100 font-bold text-lg mb-2">Cuotas &amp; Closing Dates</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Organize credit card statement closing dates, interest-free installment plans (cuotas), and upcoming bill due dates with precision.
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-[#11151f] border border-slate-800/90 rounded-3xl p-6 hover:border-amber-500/40 transition-all group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-slate-100 font-bold text-lg mb-2">AI Financial Advisor</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Powered by Gemini API, LevLev analyzes monthly spending spikes, highlights recurring leaks, and gives tailormade financial insights.
              </p>
            </div>

            {/* Card 5 */}
            <div className="bg-[#11151f] border border-slate-800/90 rounded-3xl p-6 hover:border-purple-500/40 transition-all group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-5 group-hover:scale-110 transition-transform">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-slate-100 font-bold text-lg mb-2">Client-Side Privacy</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Your data is stored locally in your browser with optional encrypted cloud backup. Toggle Privacy Mode anytime to blur figures on screen.
              </p>
            </div>

            {/* Card 6 */}
            <div className="bg-[#11151f] border border-slate-800/90 rounded-3xl p-6 hover:border-blue-500/40 transition-all group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-5 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-slate-100 font-bold text-lg mb-2">Shared Workspaces</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Share full workspaces or individual accounts with family members or business partners while keeping your private accounts separate.
              </p>
            </div>
          </div>
        </section>

        {/* Security & Trust Banner */}
        <section className="w-full max-w-4xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-slate-800/90 rounded-3xl p-8 my-12 text-center relative overflow-hidden">
          <div className="max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
              Your Financial Privacy is Non-Negotiable
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              LevLev never asks for bank account passwords, credit card numbers, or SSNs. You maintain full ownership of your data with one-click JSON backup and CSV export.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> No Bank Password Requirements
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> One-Click JSON Backup &amp; Restore
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Zero Data Selling
              </span>
            </div>
          </div>
        </section>

        {/* Interactive FAQ Section */}
        <section className="w-full max-w-3xl my-16">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-300 text-xs font-semibold mb-3">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Got Questions?</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#11151f] border border-slate-800/90 rounded-2xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between text-slate-100 font-semibold text-sm sm:text-base hover:text-emerald-400 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isOpen ? 'rotate-180 text-emerald-400' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4 text-slate-400 text-xs sm:text-sm leading-relaxed border-t border-slate-800/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="w-full max-w-4xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-3xl p-8 sm:p-12 text-center shadow-2xl my-12 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-black text-white mb-4">
              Start Managing Your Multi-Currency Net Worth Today
            </h2>
            <p className="text-emerald-100 text-sm sm:text-base mb-8 opacity-90">
              Join thousands who track ARS &amp; USD balances with inflation clarity. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={onSignInWithGoogle}
                className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-100 text-slate-950 font-extrabold rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-base"
              >
                <span>Sign in with Google</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onEnterGuestMode}
                className="w-full sm:w-auto px-6 py-4 bg-emerald-950/60 hover:bg-emerald-950 text-white font-bold rounded-2xl border border-emerald-400/40 transition-all active:scale-95 flex items-center justify-center gap-2 text-base"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Instant Demo Mode</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-8 bg-[#0f131a]/80 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <LevLevIcon className="w-5 h-5" variant="white" />
            <span className="font-bold text-slate-300">LevLev</span>
            <span>— Personal Finance with Heart</span>
          </div>
          <p className="text-[11px] text-slate-600">
            Multi-currency intelligence engine for ARS &amp; USD • Real-time Dólar MEP &amp; IPC Inflation
          </p>
        </div>
      </footer>
    </div>
  );
};
