import { memo } from 'react';

const LANGUAGES = [
  { id: 'dart', label: 'Dart', icon: '🎯' },
];

/**
 * Language selector dropdown with styled appearance.
 */
function LanguageSelector({ selectedLanguage, onLanguageChange }) {
  return (
    <div className="relative">
      <select
        id="language-selector"
        value={selectedLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="
          appearance-none cursor-pointer
          bg-surface-700 text-text-primary
          border border-border rounded-lg
          px-3 py-1.5 pr-8
          text-sm font-medium font-mono
          hover:bg-surface-600 hover:border-surface-400
          focus-ring-glow
          transition-all duration-200
        "
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.id} value={lang.id}>
            {lang.icon} {lang.label}
          </option>
        ))}
      </select>
      {/* Custom dropdown chevron */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

export default memo(LanguageSelector);
