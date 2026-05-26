import { memo, useState, useCallback } from 'react';

/**
 * A single AST tree node with expand/collapse, highlighting, and click-to-reveal.
 */
function ASTTreeNode({ node, searchMatchIds, highlightedNodeId, onNodeClick, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = node.children && node.children.length > 0;

  const isSearchMatch = searchMatchIds?.has(node.id);
  const isHighlighted = highlightedNodeId === node.id;

  const toggleExpand = useCallback((e) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    onNodeClick?.(node);
  }, [node, onNodeClick]);

  // Determine styling
  let rowClass = 'group flex items-center gap-1 py-0.5 px-2 rounded cursor-pointer transition-all duration-150 hover:bg-surface-600/50';
  if (isHighlighted) rowClass += ' tree-node-highlighted';
  if (isSearchMatch) rowClass += ' tree-node-search-match';

  return (
    <div className="tree-node-enter">
      <div
        className={rowClass}
        style={{ paddingLeft: `${node.depth * 16 + 4}px` }}
        onClick={handleClick}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
      >
        {/* Expand/Collapse chevron */}
        {hasChildren ? (
          <button
            onClick={toggleExpand}
            className="flex-shrink-0 p-0.5 rounded hover:bg-surface-500 transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-3 h-3 text-text-muted tree-chevron ${expanded ? 'tree-chevron-open' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Node type */}
        <span className={`text-xs font-mono font-semibold ${node.isNamed ? 'text-accent-violet' : 'text-text-muted'}`}>
          {node.type}
        </span>

        {/* Node text (for leaf nodes) */}
        {node.childCount === 0 && node.text && (
          <span className="text-[11px] font-mono text-accent-emerald/80 truncate max-w-[180px]" title={node.fullText}>
            "{node.text}"
          </span>
        )}

        {/* Position badge */}
        <span className="ml-auto text-[10px] font-mono text-text-muted/60 opacity-0 group-hover:opacity-100 transition-opacity">
          {node.startRow}:{node.startCol}–{node.endRow}:{node.endCol}
        </span>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div role="group">
          {node.children.map((child) => (
            <ASTTreeNode
              key={child.id}
              node={child}
              searchMatchIds={searchMatchIds}
              highlightedNodeId={highlightedNodeId}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(ASTTreeNode);
