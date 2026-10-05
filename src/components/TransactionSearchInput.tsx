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
 * Mobile-resilient search input for TransactionsTab.
 * Uses an uncontrolled input with a ref and debounce so that the browser's
 * native keyboard/IME manages text composition without React interrupting
 * or resetting the caret position on mobile devices.
 */
export function TransactionSearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  clearTitle = 'Clear',
  className = 'w-full sm:w-64 md:w-72',
}: TransactionSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasText, setHasText] = useState<boolean>(Boolean(value));
  const debounceTimerRef = useRef<any>(null);

  // Sync when parent resets or updates value externally (e.g., reset filters)
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== (value || '')) {
      inputRef.current.value = value || '';
      setHasText(Boolean(value));
    }
  }, [value]);

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const nextVal = (e.target as HTMLInputElement).value;
    setHasText(Boolean(nextVal));

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onChange(nextVal);
    }, 200);
  };

  const handleClear = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
    setHasText(false);
    onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (inputRef.current) {
        onChange(inputRef.current.value);
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        dir="ltr"
        defaultValue={value || ''}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        className="w-full pl-9 pr-8 py-2 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-500 text-left"
      />
      {hasText ? (
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
