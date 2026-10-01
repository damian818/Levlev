import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
 * by isolating local keystrokes from heavy table re-renders, explicitly
 * tracking and restoring caret positions, and debouncing parent state updates.
 */
export function TransactionSearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  clearTitle = 'Clear',
}: TransactionSearchInputProps) {
  const [localValue, setLocalValue] = useState<string>(value || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);
  const isComposingRef = useRef<boolean>(false);

  // Synchronize when the external value changes (e.g. from activeFilter, clear filters, etc.)
  useEffect(() => {
    if (value !== localValue && !isComposingRef.current) {
      setLocalValue(value || '');
      cursorRef.current = (value || '').length;
    }
  }, [value]);

  // Force caret preservation to prevent mobile keyboards from snapping selection to position 0
  useLayoutEffect(() => {
    if (
      inputRef.current &&
      document.activeElement === inputRef.current &&
      cursorRef.current !== null &&
      !isComposingRef.current
    ) {
      const pos = Math.min(cursorRef.current, localValue.length);
      try {
        inputRef.current.setSelectionRange(pos, pos);
      } catch {
        // Fallback for non-text input types
      }
    }
  }, [localValue]);

  // Debounce notification to parent to keep typing at 60fps on mobile without triggering heavy table re-renders
  useEffect(() => {
    if (localValue === value) return;

    const timer = setTimeout(() => {
      onChange(localValue);
    }, 180);

    return () => clearTimeout(timer);
  }, [localValue, onChange, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    cursorRef.current = e.target.selectionStart;
    setLocalValue(nextVal);
  };

  const handleClear = () => {
    setLocalValue('');
    cursorRef.current = 0;
    onChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onChange(localValue);
    }
  };

  return (
    <div className="relative w-full md:w-64">
      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        inputMode="search"
        dir="ltr"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          cursorRef.current = (e.target as HTMLInputElement).selectionStart;
          setLocalValue((e.target as HTMLInputElement).value);
        }}
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
