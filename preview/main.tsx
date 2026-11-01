import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './preview.css';
import '../src/i18n';
import i18n from 'i18next';
import { RecurringDeviationModal } from '../src/components/AlertDetailModals';
import type { RecurringDeviationAlert } from '../src/utils/financeUtils';

const a = (o: Partial<RecurringDeviationAlert>): RecurringDeviationAlert => ({
  id: Math.random().toString(36).slice(2), title: 'Item', cleanTitle: 'Item', category: 'Category',
  account: 'Bank', currency: 'USD', latestAmount: 100, priorAvgAmount: 80, deviationPercent: 25,
  threshold: 15, type: 'EXPENSE', latestDate: '2026-11-03', diff: 20, isTriggered: true,
  direction: 'UP', severity: 'ATTENTION', isPartialMonth: false, ...o,
});

// SYNTHETIC fixture data only - no real financial data.
const ALERTS: RecurringDeviationAlert[] = [
  a({ title: 'Comisión bancaria', cleanTitle: 'Comisión bancaria', category: 'Facturas y tarifas', account: 'Bank USD', latestAmount: 34.52, priorAvgAmount: 5, deviationPercent: 590, diff: 29.52 }),
  a({ title: 'Supermercado Sol', cleanTitle: 'Supermercado Sol', category: 'Alimentos y Bebidas', account: 'Visa Banco', currency: 'ARS', latestAmount: 310, priorAvgAmount: 144, deviationPercent: 115, diff: 166 }),
  a({ title: 'Supermercado Sol', cleanTitle: 'supermercado sol', category: 'Alimentos y Bebidas', account: 'Efectivo', currency: 'ARS', latestAmount: 95, priorAvgAmount: 60, deviationPercent: 58, diff: 35 }),
  a({ title: 'Peaje Norte', cleanTitle: 'Peaje Norte', category: 'Transporte', account: 'Master Banco', currency: 'ARS', latestAmount: 12.1, priorAvgAmount: 10.2, deviationPercent: 19, diff: 1.9, severity: 'WATCH' }),
  a({ title: 'Streaming Nube', cleanTitle: 'Streaming Nube', category: 'Entretenimiento', account: 'Visa Banco', latestAmount: 0.5, priorAvgAmount: 6.5, deviationPercent: 92, diff: -6, direction: 'DOWN', severity: 'PENDING', isPartialMonth: true }),
  a({ title: 'Café Molido', cleanTitle: 'Café Molido', category: 'Restaurant', account: 'Efectivo', latestAmount: 2.2, priorAvgAmount: 12.3, deviationPercent: 82, diff: -10.1, direction: 'DOWN', severity: 'PENDING', isPartialMonth: true }),
  a({ title: 'Intereses plazo fijo', cleanTitle: 'Intereses plazo fijo', category: 'Inversiones', type: 'INCOME', account: 'Bank USD', latestAmount: 875, priorAvgAmount: 369, deviationPercent: 137, diff: 506, direction: 'UP', severity: 'INFO' }),
  a({ title: 'Restaurante Puerto', cleanTitle: 'Restaurante Puerto', category: 'Restaurant', account: 'Visa Banco', currency: 'ARS', latestAmount: 10.6, priorAvgAmount: 131.5, deviationPercent: 92, diff: -120.9, direction: 'DOWN', severity: 'INFO' }),
];

function App() {
  const [open, setOpen] = useState(true);
  const [lang, setLang] = useState(() => {
    const l = location.hash.replace('#', '') === 'es' ? 'es' : 'en';
    i18n.changeLanguage(l);
    return l;
  });
  const change = (l: string) => { i18n.changeLanguage(l); setLang(l); };
  return (
    <div className="min-h-screen bg-[#0a0b0d] p-6 text-slate-200">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-bold uppercase tracking-wider">Preview with synthetic data</span>
          <button onClick={() => change('en')} className={`px-3 py-1 rounded ${lang === 'en' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800'}`}>EN</button>
          <button onClick={() => change('es')} className={`px-3 py-1 rounded ${lang === 'es' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800'}`}>ES</button>
          <button onClick={() => setOpen(true)} className="px-3 py-1 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold">Reopen modal</button>
        </div>
        <RecurringDeviationModal
          isOpen={open}
          onClose={() => setOpen(false)}
          alerts={ALERTS}
          displayCurrency="USD"
          onNavigateTab={() => {}}
          onNavigateToTransactions={() => {}}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
