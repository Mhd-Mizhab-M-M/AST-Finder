import { memo, useState, useEffect, useRef } from 'react';

/**
 * Debounced query input for tree-sitter S-expression queries.
 * Shows inline validation errors for malformed queries.
 */
function QueryInput({ onQueryChange, queryError }) {
  const [value, setValue] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setValue(newValue);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onQueryChange(newValue);
    }, 150);
  };

  const hasError = queryError && value.trim().length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label row */}
      <div className="flex items-center justify-between px-1">
        <label
          htmlFor="query-input"
          className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Query
        </label>
        {hasError && (
          <span className="text-[10px] text-accent-rose font-medium animate-pulse">
            ● Error
          </span>
        )}
      </div>

      {/* Input area */}
      <div className="relative">
        <textarea
          id="query-input"
          value={value}
          onChange={handleChange}
          placeholder='(identifier) @name'
          rows={3}
          spellCheck={false}
          className={`
            w-full resize-none
            bg-surface-800 text-text-primary font-mono text-sm
            border rounded-lg
            px-3 py-2
            placeholder:text-text-muted
            focus-ring-glow
            transition-all duration-200
            ${hasError
              ? 'border-accent-rose/50 shadow-[0_0_12px_rgba(244,63,94,0.1)]'
              : 'border-border hover:border-surface-400'
            }
          `}
        />
      </div>

      {/* Error message */}
      {hasError && (
        <p className="text-[11px] text-accent-rose/80 font-mono px-1 leading-tight">
          {queryError}
        </p>
      )}
    </div>
  );
}

export default memo(QueryInput);
