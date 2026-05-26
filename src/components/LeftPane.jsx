import { memo, forwardRef } from 'react';
import LanguageSelector from './LanguageSelector';
import CodeEditor from './CodeEditor';
import QueryInput from './QueryInput';

/**
 * Left Pane — Contains the language selector toolbar, code editor, and query input.
 */
const LeftPane = forwardRef(function LeftPane({
  code,
  language,
  onCodeChange,
  onLanguageChange,
  onQueryChange,
  onCursorChange,
  onSelectionRangeChange,
  onAltClick,
  onNormalClick,
  altClickedRanges = [],
  queryError,
}, editorRef) {
  return (
    <div className="flex flex-col h-full min-w-0 bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-slate-50/80 backdrop-blur z-10 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <svg className="w-4 h-4 text-accent-violet" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Source Code
          </h2>
        </div>
        <LanguageSelector
          selectedLanguage={language}
          onLanguageChange={onLanguageChange}
        />
      </div>

      {/* Code Editor */}
      <div className="flex-1 min-h-0 p-3 flex flex-col overflow-hidden">
        <CodeEditor
          ref={editorRef}
          code={code}
          language={language}
          onChange={onCodeChange}
          onCursorChange={onCursorChange}
          onSelectionRangeChange={onSelectionRangeChange}
          onAltClick={onAltClick}
          onNormalClick={onNormalClick}
          altClickedRanges={altClickedRanges}
        />
      </div>

      {/* Query Input */}
      <div className="px-4 pb-4 shrink-0">
        <QueryInput
          onQueryChange={onQueryChange}
          queryError={queryError}
        />
      </div>
    </div>
  );
});

export default memo(LeftPane);


