import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface TransactionSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearTitle?: string;
}

/**
 * Mobile-resilient search input for TransactionsTab.
 * Prevents mobile virtual keyboard IME cursor jumping and reversed typing
 * by isolating local keystrokes, avoiding programmatic selection tampering
 * during typing, and cleanly debouncing updates to the parent component.
 */
export function TransactionSearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  clearTitle = 'Clear',
}: TransactionSearchInputProps) {
  const [localValue, setLocalValue] = useState<string>(value || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastEmittedValueRef = useRef<string>(value || '');

  // Synchronize ONLY when parent changes value externally (e.g., reset filters, active tag clicked)
  useEffect(() => {
    // If the incoming value differs from what we last emitted to the parent, update local state
    if (value !== lastEmittedValueRef.current) {
      setLocalValue(value || '');
      lastEmittedValueRef.current = value || '';
    }
  }, [value]);

  // Debounce notification to parent to keep typing at 60fps on mobile without heavy parent re-renders
  useEffect(() => {
    if (localValue === lastEmittedValueRef.current) return;

    const timer = setTimeout(() => {
      lastEmittedValueRef.current = localValue;
      onChange(localValue);
    }, 200);

    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleClear = () => {
    setLocalValue('');
    lastEmittedValueRef.current = '';
    onChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      lastEmittedValueRef.current = localValue;
      onChange(localValue);
    }
  };

  return (
    <div className="relative w-full md:w-64">
      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        className="w-full pl-9 pr-8 py-2 bg-[#0f131a] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-500 text-left"
      />
      {localValue ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800 transition-colors"
          title={clearTitle}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
}
