import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator, Delete, Check, X, Percent, Users, Tag, PlusCircle } from 'lucide-react';
import { evaluateMathExpression, isMathExpression } from '../utils/calculatorUtils';

interface AmountCalculatorProps {
  value: string;
  onChange: (val: string) => void;
  currencySymbol?: string;
  onApply: (evaluatedNum: number) => void;
  onClose: () => void;
}

export const AmountCalculator: React.FC<AmountCalculatorProps> = ({
  value,
  onChange,
  currencySymbol = '$',
  onApply,
  onClose,
}) => {
  const { t } = useTranslation();

  const evalResult = evaluateMathExpression(value);
  const hasExpression = isMathExpression(value);
  const currentNum = evalResult.isValid && evalResult.result !== null ? evalResult.result : null;

  const handleKeyPress = (char: string) => {
    if (char === 'C') {
      onChange('');
    } else if (char === 'BACKSPACE') {
      onChange(value.slice(0, -1));
    } else if (char === '=') {
      if (evalResult.isValid && evalResult.result !== null) {
        onChange(evalResult.formatted);
      }
    } else {
      onChange(value + char);
    }
  };

  // Quick action: split bill
  const handleSplit = (divisor: number) => {
    if (!value.trim()) return;
    if (hasExpression && evalResult.isValid && evalResult.result !== null) {
      onChange(`(${evalResult.formatted}) / ${divisor}`);
    } else {
      onChange(`${value} / ${divisor}`);
    }
  };

  // Quick action: discount percentage
  const handleDiscount = (percent: number) => {
    if (!value.trim()) return;
    if (hasExpression && evalResult.isValid && evalResult.result !== null) {
      onChange(`(${evalResult.formatted}) - ${percent}%`);
    } else {
      onChange(`${value} - ${percent}%`);
    }
  };

  // Quick action: tip or tax percentage
  const handleSurcharge = (percent: number) => {
    if (!value.trim()) return;
    if (hasExpression && evalResult.isValid && evalResult.result !== null) {
      onChange(`(${evalResult.formatted}) + ${percent}%`);
    } else {
      onChange(`${value} + ${percent}%`);
    }
  };

  const handleApplyClick = () => {
    if (evalResult.isValid && evalResult.result !== null) {
      onApply(evalResult.result);
    }
    onClose();
  };

  return (
    <div className="bg-[#0f131a] border border-slate-700/80 rounded-2xl p-3 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
      {/* Top Header with live preview */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <Calculator className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('add_tx.calculator')}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Screen Display */}
      <div className="bg-[#080a0f] border border-slate-800/80 rounded-xl p-2.5 space-y-1">
        <div className="text-[11px] font-mono text-slate-400 truncate h-4 text-right">
          {value || '0'}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
            {t('add_tx.calc_result')}
          </span>
          <span className={`text-base font-mono font-bold ${
            evalResult.isValid ? 'text-emerald-400' : 'text-slate-500'
          }`}>
            {currencySymbol} {evalResult.isValid && currentNum !== null ? currentNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </span>
        </div>
      </div>

      {/* Quick Actions / Helpers */}
      <div className="space-y-2">
        {/* Split Presets */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <Users className="w-3 h-3 text-sky-400 shrink-0" />
          <span className="shrink-0">{t('add_tx.calc_split')}:</span>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {[2, 3, 4, 5].map(n => (
              <button
                key={`split-${n}`}
                type="button"
                onClick={() => handleSplit(n)}
                className="px-1.5 py-0.5 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-800/40 hover:border-sky-600/60 text-sky-300 font-mono font-semibold rounded text-[10px] transition-colors"
              >
                ÷{n}
              </button>
            ))}
          </div>
        </div>

        {/* Discount Presets */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <Tag className="w-3 h-3 text-rose-400 shrink-0" />
          <span className="shrink-0">{t('add_tx.calc_discount')}:</span>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {[10, 15, 20, 25, 50].map(pct => (
              <button
                key={`disc-${pct}`}
                type="button"
                onClick={() => handleDiscount(pct)}
                className="px-1.5 py-0.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 hover:border-rose-600/60 text-rose-300 font-mono font-semibold rounded text-[10px] transition-colors"
              >
                -{pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Tip / Surcharge Presets */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <PlusCircle className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="shrink-0">{t('add_tx.calc_tip')}:</span>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {[10, 15, 21].map(pct => (
              <button
                key={`tip-${pct}`}
                type="button"
                onClick={() => handleSurcharge(pct)}
                className="px-1.5 py-0.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/40 hover:border-emerald-600/60 text-emerald-300 font-mono font-semibold rounded text-[10px] transition-colors"
              >
                +{pct}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Keypad Grid */}
      <div className="grid grid-cols-4 gap-1.5 pt-1">
        {/* Row 1 */}
        <button
          type="button"
          onClick={() => handleKeyPress('C')}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-rose-300 font-bold rounded-xl text-xs transition-colors"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('(')}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
        >
          (
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress(')')}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
        >
          )
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('BACKSPACE')}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center transition-colors"
        >
          <Delete className="w-3.5 h-3.5" />
        </button>

        {/* Row 2 */}
        <button
          type="button"
          onClick={() => handleKeyPress('7')}
          className="p-2 bg-slate-800/40 hover:bg-slate-800 text-slate-100 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('8')}
          className="p-2 bg-slate-800/40 hover:bg-slate-800 text-slate-100 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('9')}
          className="p-2 bg-slate-800/40 hover:bg-slate-800 text-slate-100 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          9
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('/')}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-amber-400 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          ÷
        </button>

        {/* Row 3 */}
        <button
          type="button"
          onClick={() => handleKeyPress('4')}
          className="p-2 bg-slate-800/40 hover:bg-slate-800 text-slate-100 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('5')}
          className="p-2 bg-slate-800/40 hover:bg-slate-800 text-slate-100 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('6')}
          className="p-2 bg-slate-800/40 hover:bg-slate-800 text-slate-100 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          6
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('*')}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-amber-400 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          ×
        </button>

        {/* Row 4 */}
        <button
          type="button"
          onClick={() => handleKeyPress('1')}
          className="p-2 bg-slate-800/40 hover:bg-slate-800 text-slate-100 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('2')}
          className="p-2 bg-slate-800/40 hover:bg-slate-800 text-slate-100 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('3')}
          className="p-2 bg-slate-800/40 hover:bg-slate-800 text-slate-100 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          3
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('-')}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-amber-400 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          -
        </button>

        {/* Row 5 */}
        <button
          type="button"
          onClick={() => handleKeyPress('0')}
          className="p-2 bg-slate-800/40 hover:bg-slate-800 text-slate-100 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('.')}
          className="p-2 bg-slate-800/40 hover:bg-slate-800 text-slate-100 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          .
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('%')}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-amber-400 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          %
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('+')}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-amber-400 font-mono font-bold rounded-xl text-sm transition-colors"
        >
          +
        </button>
      </div>

      {/* Row 6: Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => handleKeyPress('=')}
          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-mono font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
        >
          <span>=</span>
          <span className="text-[10px] text-slate-400 font-normal">Calculate</span>
        </button>
        <button
          type="button"
          onClick={handleApplyClick}
          disabled={!evalResult.isValid || evalResult.result === null}
          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{t('add_tx.calc_apply')}</span>
        </button>
      </div>
    </div>
  );
};
