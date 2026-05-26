import { memo } from 'react';
import ASTTreeView from './ASTTreeView';
import CommandPanel from './CommandPanel';

/**
 * Right Pane — Contains the AST tree view (top 50%) and retro Command Prompt (bottom 50%).
 */
function RightPane({ treeData, searchMatchIds, onNodeClick, generatedQuery, selectedLine, selectedNode, rootNodeString }) {
  return (
    <div className="flex flex-col h-full min-w-0 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-slate-50/80 backdrop-blur z-10 shrink-0">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <svg className="w-4 h-4 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          AST Explorer
        </h2>
        {treeData && (
          <span className="text-[10px] font-mono text-text-muted bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            Active
          </span>
        )}
      </div>

      {/* Main split content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Top Half: Tree View */}
        <div className="h-1/2 flex flex-col min-h-0 border-b border-border overflow-hidden">
          <ASTTreeView
            treeData={treeData}
            searchMatchIds={searchMatchIds}
            onNodeClick={onNodeClick}
          />
        </div>

        {/* Bottom Half: Command Prompt */}
        <div className="h-1/2 flex flex-col min-h-0 p-3 bg-slate-50/50 overflow-hidden">
          <CommandPanel
            generatedQuery={generatedQuery}
            selectedLine={selectedLine}
            selectedNode={selectedNode}
            rootNodeString={rootNodeString}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(RightPane);

