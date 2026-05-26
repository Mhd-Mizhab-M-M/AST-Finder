import { memo, useState, useCallback, useMemo } from 'react';

/**
 * Traverses the AST tree structure recursively and builds a flat list of nodes
 * with computed directory tree prefixes and connector symbols.
 */
function flattenTreeWithConnectors(node, prefix = '', isLast = true, depth = 0) {
  if (!node) return [];

  let connector = '';
  if (depth > 0) {
    connector = isLast ? '└── ' : '├── ';
  }

  const currentItem = {
    id: node.id,
    type: node.type,
    text: node.text,
    fullText: node.fullText,
    isNamed: node.isNamed,
    startRow: node.startRow,
    startCol: node.startCol,
    endRow: node.endRow,
    endCol: node.endCol,
    depth,
    prefix,
    connector,
    childrenCount: node.children ? node.children.length : 0,
  };

  const results = [currentItem];

  if (node.children && node.children.length > 0) {
    const childrenCount = node.children.length;
    const nextPrefix = depth > 0 ? (prefix + (isLast ? '    ' : '│   ')) : '';
    
    node.children.forEach((child, index) => {
      const isChildLast = index === childrenCount - 1;
      results.push(...flattenTreeWithConnectors(child, nextPrefix, isChildLast, depth + 1));
    });
  }

  return results;
}

/**
 * AST Tree View — renders the full AST pre-flattened in a highly readable,
 * terminal directory-style pretty layout without expand/collapse clutter.
 */
function ASTTreeView({ treeData, searchMatchIds, onNodeClick }) {
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);

  const flatNodes = useMemo(() => {
    return flattenTreeWithConnectors(treeData);
  }, [treeData]);

  const handleNodeClick = useCallback((node) => {
    setHighlightedNodeId(node.id);
    onNodeClick?.(node);
  }, [onNodeClick]);

  if (!treeData) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm bg-white">
        <div className="text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <p className="text-slate-500 font-medium">Type some code to see the AST</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* Diagnostics Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-slate-50/50 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">AST Tree Hierarchy</span>
          <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded font-mono font-medium">
            {flatNodes.length} nodes
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          Root: {treeData.type}
        </span>
      </div>

      {/* Pretty Tree List */}
      <div className="flex-1 overflow-auto p-3 font-mono leading-relaxed select-text">
        {flatNodes.map((item) => {
          const isHighlighted = highlightedNodeId === item.id;
          const isSearchMatch = searchMatchIds?.has(item.id);
          const isErrorNode = item.type === 'ERROR';

          return (
            <div
              key={item.id}
              onClick={() => handleNodeClick(item)}
              className={`
                group flex items-center py-0.5 px-2.5 rounded text-[11px] font-mono cursor-pointer transition-all duration-100 select-none
                hover:bg-slate-50
                ${isHighlighted ? 'bg-violet-50 text-slate-900 border-l-2 border-accent-violet pl-2 font-medium shadow-sm' : ''}
                ${isSearchMatch && !isHighlighted ? 'bg-cyan-50/70 border-l-2 border-accent-cyan pl-2' : ''}
                ${isErrorNode && !isHighlighted && !isSearchMatch ? 'bg-red-50/30 hover:bg-red-50' : ''}
              `}
            >
              {/* Connector prefix */}
              <span className="text-slate-300/80 select-none whitespace-pre tracking-normal">
                {item.prefix}{item.connector}
              </span>

              {/* Node Type */}
              <span className={`font-semibold mr-2 ${
                isErrorNode
                  ? 'text-red-600 bg-red-100/50 border border-red-200/60 px-1.5 py-0.5 rounded font-bold pulse-error-badge'
                  : item.isNamed
                    ? 'text-violet-600'
                    : 'text-slate-400'
              }`}>
                {item.type}
              </span>

              {/* Text content if it is a leaf node */}
              {item.childrenCount === 0 && item.text && (
                <span className={`${isErrorNode ? 'text-red-500 font-bold' : 'text-emerald-600 font-semibold'} truncate max-w-[280px]`} title={item.fullText}>
                  "{item.text}"
                </span>
              )}

              {/* Position coordinates */}
              <span className="ml-auto text-[9px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity select-none pl-2">
                [{item.startRow + 1}:{item.startCol + 1} - {item.endRow + 1}:{item.endCol + 1}]
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(ASTTreeView);

