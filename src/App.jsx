import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTreeSitter } from './hooks/useTreeSitter';
import {
  nodeToTree,
  findNodeAtPosition,
  generateQueryForNode,
  findNodeSpanningRange,
  generateStructuredQuery,
  findLCA,
  generateLCAQuery,
  formatSExpression
} from './utils/astHelpers';
import LeftPane from './components/LeftPane';
import RightPane from './components/RightPane';

const TEMPLATES = {
  dart: `// AST Finder Dart Demo
void main() {
  var app = ASTFinder(
    name: 'AST Finder',
    version: '1.0.0',
  );
  app.start();
}

class ASTFinder {
  final String name;
  final String version;

  ASTFinder({required this.name, required this.version});

  void start() {
    print('Starting $name v$version');
  }
}`,
  yaml: `# AST Finder YAML Demo
app:
  name: "AST Finder"
  version: "1.0.0"
  features:
    - name: "Tree-Sitter Parsing"
      enabled: true
      supported_languages:
        - dart
        - yaml
    - name: "Interactive AST Tree"
      enabled: true
  database:
    host: "localhost"
    port: 5432
    options:
      ssl: true
      timeout: 5000`
};

function App() {
  // State
  const [code, setCode] = useState(TEMPLATES.dart);
  const [language, setLanguage] = useState('dart');
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [queryString, setQueryString] = useState('');
  const [dividerPos, setDividerPos] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);

  // Dual-mode Query Generator selections
  const [altClickedNodes, setAltClickedNodes] = useState([]);
  const [selectionRange, setSelectionRange] = useState(null);

  // Refs
  const editorRef = useRef(null);
  const containerRef = useRef(null);

  // Tree-sitter hook
  const { isReady, error: tsError, tree, parse, runQuery } = useTreeSitter(language);

  // Parse code when it changes or parser becomes ready
  useEffect(() => {
    if (isReady && code) {
      parse(code);
    }
  }, [isReady, code, parse]);

  // Convert tree to renderable data
  const treeData = useMemo(() => {
    if (!tree?.rootNode) return null;
    return nodeToTree(tree.rootNode, 0, tree.isWrapped);
  }, [tree]);

  // Capture tree.rootNode.toString() in real-time and pretty-print it
  const rootNodeString = useMemo(() => {
    if (!tree?.rootNode) return '';
    try {
      return formatSExpression(tree.rootNode.toString());
    } catch (e) {
      console.error('Error formatting S-expression:', e);
      return tree.rootNode.toString();
    }
  }, [tree]);

  // Listen to cursor position changes to update selected node and generate query
  const handleCursorChange = useCallback((lineNumber, column) => {
    setSelectedLine(lineNumber);
    setSelectedColumn(column);
  }, []);

  // Intercept selection range changes (Mode 1)
  const handleSelectionRangeChange = useCallback((range) => {
    setSelectionRange(range);
  }, []);

  // Intercept Alt + Clicks (Mode 2)
  const handleAltClick = useCallback((row, col) => {
    if (!tree?.rootNode) return;

    const offset = tree.isWrapped ? 1 : 0;
    const clickedNode = findNodeAtPosition(tree.rootNode, row + offset, col);
    if (!clickedNode) return;

    setAltClickedNodes((prev) => {
      const exists = prev.some((n) => n.id === clickedNode.id);
      if (exists) {
        return prev.filter((n) => n.id !== clickedNode.id);
      } else {
        return [...prev, clickedNode];
      }
    });
  }, [tree]);

  // Intercept Normal Click (resets Alt selection)
  const handleNormalClick = useCallback(() => {
    setAltClickedNodes([]);
  }, []);

  // Compute Alt-clicked coordinates for editor decoration drawing
  const altClickedRanges = useMemo(() => {
    const offset = tree?.isWrapped ? 1 : 0;
    return altClickedNodes.map((node) => ({
      startRow: node.startPosition.row - offset,
      startCol: node.startPosition.column,
      endRow: node.endPosition.row - offset,
      endCol: node.endPosition.column,
    }));
  }, [altClickedNodes, tree]);

  // Derive selectedNode, generatedQuery, and selectedLineDisplay from selections and tree structure
  const { selectedNode, generatedQuery, selectedLineDisplay } = useMemo(() => {
    if (!tree?.rootNode) {
      return { selectedNode: null, generatedQuery: '', selectedLineDisplay: null };
    }

    const offset = tree.isWrapped ? 1 : 0;

    // PRIORITY 1: Mode 2 — Alt-Clicked Scattered Nodes
    if (altClickedNodes.length > 0) {
      const lca = findLCA(altClickedNodes);
      if (lca) {
        const query = generateLCAQuery(lca, altClickedNodes);
        const linesStr = altClickedNodes
          .map(n => n.startPosition.row - offset + 1)
          .sort((a, b) => a - b)
          .join(', ');
        return {
          selectedNode: lca,
          generatedQuery: query,
          selectedLineDisplay: `Alt-Click [Lines: ${linesStr}]`,
        };
      }
      return { selectedNode: null, generatedQuery: '', selectedLineDisplay: null };
    }

    // PRIORITY 2: Mode 1 — Drag-and-Select Range
    if (selectionRange) {
      const { startRow, startCol, endRow, endCol } = selectionRange;
      const spanningNode = findNodeSpanningRange(tree.rootNode, startRow + offset, startCol, endRow + offset, endCol);
      if (spanningNode) {
        const query = generateStructuredQuery(spanningNode);
        const lineDisp = startRow === endRow
          ? String(startRow + 1)
          : `${startRow + 1}-${endRow + 1}`;
        return {
          selectedNode: spanningNode,
          generatedQuery: query,
          selectedLineDisplay: lineDisp,
        };
      }
      return { selectedNode: null, generatedQuery: '', selectedLineDisplay: null };
    }

    // PRIORITY 3: Fallback — Single Cursor Position
    if (selectedLine !== null && selectedColumn !== null) {
      let parsedLine = selectedLine;
      if (typeof selectedLine === 'string') {
        const match = selectedLine.match(/\d+/);
        parsedLine = match ? parseInt(match[0], 10) : 1;
      }

      const searchRow = (parsedLine - 1) + offset;
      const node = findNodeAtPosition(tree.rootNode, searchRow, selectedColumn - 1);
      if (node) {
        const query = generateQueryForNode(node);
        return {
          selectedNode: node,
          generatedQuery: query,
          selectedLineDisplay: selectedLine,
        };
      }
    }

    return { selectedNode: null, generatedQuery: '', selectedLineDisplay: selectedLine };
  }, [tree, altClickedNodes, selectionRange, selectedLine, selectedColumn]);

  // Derive manual query captures and errors synchronously during render
  const { queryCaptures, queryError } = useMemo(() => {
    if (!tree || !queryString.trim()) {
      return { queryCaptures: [], queryError: null };
    }
    const { captures, error } = runQuery(queryString);
    return {
      queryCaptures: captures || [],
      queryError: error || null,
    };
  }, [queryString, runQuery, tree]);

  // Synchronize manual query captures as highlights in the Monaco Editor
  useEffect(() => {
    if (!queryError && queryCaptures.length > 0) {
      const offset = tree?.isWrapped ? 1 : 0;
      const ranges = queryCaptures.map((c) => ({
        startRow: c.node.startPosition.row - offset,
        startCol: c.node.startPosition.column,
        endRow: c.node.endPosition.row - offset,
        endCol: c.node.endPosition.column,
      }));
      editorRef.current?.applyDecorations(ranges);
    } else {
      editorRef.current?.clearDecorations();
    }
  }, [queryCaptures, queryError, tree]);

  // Highlight tree view items that match the S-expression query
  const searchMatchIds = useMemo(() => {
    if (!queryCaptures || queryCaptures.length === 0) return new Set();
    const offset = tree?.isWrapped ? 1 : 0;
    return new Set(queryCaptures.map(c =>
      `${c.node.type}-${c.node.startPosition.row - offset}:${c.node.startPosition.column}-${c.node.endPosition.row - offset}:${c.node.endPosition.column}-${c.node.id}`
    ));
  }, [queryCaptures, tree]);

  // Callbacks
  const handleCodeChange = useCallback((value) => {
    setCode(value || '');
  }, []);

  const handleLanguageChange = useCallback((newLang) => {
    setLanguage(newLang);
    const prevTemplate = TEMPLATES[language];
    const nextTemplate = TEMPLATES[newLang];
    if (!code.trim() || code.trim() === (prevTemplate ? prevTemplate.trim() : '')) {
      setCode(nextTemplate);
    }
  }, [code, language]);

  const handleQueryChange = useCallback((value) => {
    setQueryString(value);
  }, []);


  const handleNodeClick = useCallback((node) => {
    editorRef.current?.revealRange(node.startRow, node.startCol, node.endRow, node.endCol);
  }, []);

  // Divider drag handlers
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newPos = ((e.clientX - rect.left) / rect.width) * 100;
      setDividerPos(Math.max(25, Math.min(75, newPos)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-slate-50/90 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-accent-violet to-accent-cyan shadow-md shadow-accent-violet/10">
            <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-text-primary tracking-tight">
              AST Finder
            </h1>
            <p className="text-[10px] text-text-muted font-medium -mt-0.5">
              Tree-Sitter AST Explorer
            </p>
          </div>
        </div>

        {/* Multi-selection tips */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-accent-violet/5 border border-accent-violet/10 text-xs text-text-secondary">
          <svg className="w-3.5 h-3.5 text-accent-violet shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Tip: Use <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-accent-violet bg-accent-violet/10 rounded border border-accent-violet/20 font-mono">Alt</kbd> + <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-accent-violet bg-accent-violet/10 rounded border border-accent-violet/20 font-mono">Click</kbd> to select multiple elements
          </span>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3">
          {tsError && (
            <span className="text-[11px] font-medium text-accent-rose flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-rose animate-pulse" />
              Parser Error
            </span>
          )}
          {!isReady && !tsError && (
            <span className="text-[11px] font-medium text-accent-amber flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-pulse" />
              Initializing...
            </span>
          )}
          {isReady && (
            <span className="text-[11px] font-medium text-accent-emerald flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald" />
              Ready
            </span>
          )}
        </div>
      </header>

      {/* Gradient accent line */}
      <div className="gradient-accent h-[2px]" />

      {/* Main Content — Split Pane */}
      <div
        ref={containerRef}
        className="flex-1 flex min-h-0 relative"
        style={{ cursor: isDragging ? 'col-resize' : undefined }}
      >
        {/* Left Pane */}
        <div
          className="h-full min-w-0 border-r border-border"
          style={{ width: `${dividerPos}%` }}
        >
          <LeftPane
            ref={editorRef}
            code={code}
            language={language}
            onCodeChange={handleCodeChange}
            onLanguageChange={handleLanguageChange}
            onCursorChange={handleCursorChange}
            onSelectionRangeChange={handleSelectionRangeChange}
            onAltClick={handleAltClick}
            onNormalClick={handleNormalClick}
            altClickedRanges={altClickedRanges}
            onQueryChange={handleQueryChange}
            queryError={queryError}
          />
        </div>

        {/* Draggable Divider */}
        <div
          className={`
            w-1 cursor-col-resize flex-shrink-0 relative z-10
            transition-colors duration-150
            ${isDragging ? 'bg-accent-violet' : 'bg-border hover:bg-accent-violet/50'}
          `}
          onMouseDown={handleMouseDown}
        >
          {/* Handle dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-8 flex items-center justify-center">
            <div className="flex flex-col gap-1">
              <span className="w-1 h-1 rounded-full bg-text-muted" />
              <span className="w-1 h-1 rounded-full bg-text-muted" />
              <span className="w-1 h-1 rounded-full bg-text-muted" />
            </div>
          </div>
        </div>

        {/* Right Pane */}
        <div
          className="h-full min-w-0"
          style={{ width: `${100 - dividerPos}%` }}
        >
          <RightPane
            treeData={treeData}
            searchMatchIds={searchMatchIds}
            onNodeClick={handleNodeClick}
            generatedQuery={generatedQuery}
            selectedLine={selectedLineDisplay}
            selectedNode={selectedNode}
            rootNodeString={rootNodeString}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
