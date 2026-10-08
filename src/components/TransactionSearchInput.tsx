import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface TransactionSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearTitle?: string;
  className?: string;
}

/**
 * Responsive search input for TransactionsTab.
 * Uses controlled state synchronized with external prop updates to ensure
 * smooth native typing without caret jumps or character reversals.
 */
export function TransactionSearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  clearTitle = 'Clear',
  className = 'w-full sm:w-64 md:w-72',
}: TransactionSearchInputProps) {
  const [internalValue, setInternalValue] = useState<string>(value || '');
  const lastPropValueRef = useRef<string>(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from props only when the value prop changes from an outside event (e.g. filter reset)
  useEffect(() => {
    if (value !== lastPropValueRef.current) {
      lastPropValueRef.current = value || '';
      setInternalValue(value || '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setInternalValue(nextVal);
    lastPropValueRef.current = nextVal;
    onChange(nextVal);
  };

  const handleClear = () => {
    setInternalValue('');
    lastPropValueRef.current = '';
    onChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        dir="ltr"
        value={internalValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        className="w-full pl-9 pr-8 py-2 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-500 text-left"
      />
      {internalValue ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
          title={clearTitle}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
}

