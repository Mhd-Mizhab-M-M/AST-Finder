import { memo, useRef, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';

const DEFAULT_OPTIONS = {
  fontSize: 14,
  fontFamily: "'JetBrains Mono', monospace",
  fontLigatures: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  lineNumbers: 'on',
  renderLineHighlight: 'line',
  lineDecorationsWidth: 8,
  padding: { top: 12, bottom: 12 },
  automaticLayout: true,
  bracketPairColorization: { enabled: true },
  guides: { bracketPairs: true },
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  roundedSelection: true,
  overviewRulerBorder: false,
  scrollbar: {
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
  },
};

/**
 * Monaco Editor wrapper that exposes decoration management via ref.
 */
const CodeEditor = forwardRef(function CodeEditor({
  code,
  language,
  onChange,
  onCursorChange,
  onSelectionRangeChange,
  onAltClick,
  onNormalClick,
  altClickedRanges = [],
}, ref) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const altDecorationsRef = useRef([]);

  // Store callbacks in ref to avoid stale closures in Monaco event listeners
  const callbacksRef = useRef({});
  callbacksRef.current = {
    onCursorChange,
    onSelectionRangeChange,
    onAltClick,
    onNormalClick,
  };

  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define the custom light theme
    monaco.editor.defineTheme('ast-finder-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7c3aed', fontStyle: 'bold' },
        { token: 'string', foreground: '059669' },
        { token: 'number', foreground: 'd97706' },
        { token: 'type', foreground: '0891b2' },
        { token: 'function', foreground: '2563eb' },
        { token: 'variable', foreground: '0f172a' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#0f172a',
        'editor.lineHighlightBackground': '#f8fafc',
        'editor.selectionBackground': '#ddd6fe',
        'editorLineNumber.foreground': '#cbd5e1',
        'editorLineNumber.activeForeground': '#7c3aed',
        'editor.inactiveSelectionBackground': '#f1f5f9',
        'editorCursor.foreground': '#7c3aed',
        'editorGutter.background': '#ffffff',
        'editorWidget.background': '#ffffff',
        'editorWidget.border': '#e2e8f0',
      },
    });

    monaco.editor.setTheme('ast-finder-light');

    // Subscribe to cursor position change events
    editor.onDidChangeCursorPosition((e) => {
      if (callbacksRef.current.onCursorChange) {
        callbacksRef.current.onCursorChange(e.position.lineNumber, e.position.column);
      }
    });

    // Subscribe to cursor selection change events (Mode 1: Drag-and-Select)
    editor.onDidChangeCursorSelection((e) => {
      if (callbacksRef.current.onSelectionRangeChange) {
        const selection = e.selection;
        if (selection && !selection.isEmpty()) {
          callbacksRef.current.onSelectionRangeChange({
            startRow: selection.startLineNumber - 1,
            startCol: selection.startColumn - 1,
            endRow: selection.endLineNumber - 1,
            endCol: selection.endColumn - 1,
          });
        } else {
          callbacksRef.current.onSelectionRangeChange(null);
        }
      }
    });

    // Subscribe to mouse down events (Mode 2: Alt + Click)
    editor.onMouseDown((e) => {
      const browserEvent = e.event.browserEvent;
      const isAlt = browserEvent?.altKey || e.event.altKey;

      if (isAlt) {
        // Prevent Monaco default multi-cursor alt-click behavior
        e.event.preventDefault();
        e.event.stopPropagation();

        const pos = e.target.position;
        if (pos && callbacksRef.current.onAltClick) {
          callbacksRef.current.onAltClick(pos.lineNumber - 1, pos.column - 1);
        }
      } else {
        // Normal click triggers clear selection
        if (callbacksRef.current.onNormalClick) {
          callbacksRef.current.onNormalClick();
        }
      }
    });
  }, []);

  // Sync Alt-Clicked decorations dynamically
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    if (!altClickedRanges || altClickedRanges.length === 0) {
      altDecorationsRef.current = editor.deltaDecorations(altDecorationsRef.current, []);
      return;
    }

    const newDecorations = altClickedRanges.map(r => ({
      range: new monaco.Range(
        r.startRow + 1,
        r.startCol + 1,
        r.endRow + 1,
        r.endCol + 1
      ),
      options: {
        inlineClassName: 'ast-alt-clicked-token',
        overviewRuler: {
          color: '#14b8a680',
          position: monaco.editor.OverviewRulerLane.Center,
        },
      },
    }));

    altDecorationsRef.current = editor.deltaDecorations(
      altDecorationsRef.current,
      newDecorations
    );
  }, [altClickedRanges]);

  // Expose applyDecorations to parent
  useImperativeHandle(ref, () => ({
    applyDecorations(ranges) {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco) return;

      const newDecorations = ranges.map((r, i) => ({
        range: new monaco.Range(
          r.startRow + 1,   // Monaco is 1-indexed
          r.startCol + 1,
          r.endRow + 1,
          r.endCol + 1
        ),
        options: {
          inlineClassName: i % 2 === 0 ? 'ast-highlight-match' : 'ast-highlight-match-alt',
          overviewRuler: {
            color: i % 2 === 0 ? '#8b5cf680' : '#06b6d480',
            position: monaco.editor.OverviewRulerLane.Center,
          },
        },
      }));

      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current,
        newDecorations
      );
    },
    clearDecorations() {
      const editor = editorRef.current;
      if (!editor) return;
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    },
    revealRange(startRow, startCol, endRow, endCol) {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco) return;
      const range = new monaco.Range(startRow + 1, startCol + 1, endRow + 1, endCol + 1);
      editor.revealRangeInCenter(range);
      editor.setSelection(range);
    },
  }), []);

  return (
    <div className="h-full w-full flex flex-col rounded-lg overflow-hidden border border-border glow-violet">
      <Editor
        height="100%"
        language={language}
        value={code}
        onChange={onChange}
        onMount={handleMount}
        options={DEFAULT_OPTIONS}
        loading={
          <div className="flex items-center justify-center h-full bg-surface-800">
            <div className="text-text-muted text-sm pulse-loading">Loading editor...</div>
          </div>
        }
      />
    </div>
  );
});

export default memo(CodeEditor);
