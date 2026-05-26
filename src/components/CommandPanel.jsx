import { memo, useState, useCallback } from 'react';

/**
 * Command Panel — A retro-modern Command Prompt console displaying S-expression queries
 * and real-time captured tree.rootNode.toString() of Tree-sitter.
 */
function CommandPanel({ generatedQuery, selectedLine, selectedNode, rootNodeString }) {
  const [activeTab, setActiveTab] = useState('query'); // 'query' | 'tree'
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [copiedTree, setCopiedTree] = useState(false);

  const handleCopyQuery = useCallback(async () => {
    if (!generatedQuery) return;
    try {
      await navigator.clipboard.writeText(generatedQuery);
      setCopiedQuery(true);
      setTimeout(() => setCopiedQuery(false), 1500);
    } catch {
      // Fallback
    }
  }, [generatedQuery]);

  const handleCopyTree = useCallback(async () => {
    if (!rootNodeString) return;
    try {
      await navigator.clipboard.writeText(rootNodeString);
      setCopiedTree(true);
      setTimeout(() => setCopiedTree(false), 1500);
    } catch {
      // Fallback
    }
  }, [rootNodeString]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shadow-md">
      {/* Title Bar & Tab Controls */}
      <div className="flex items-center justify-between px-3 bg-slate-950 border-b border-slate-800 select-none shrink-0">
        <div className="flex items-center gap-1.5 py-2">
          <span className="w-2 h-2 rounded-full bg-red-500/80" />
          <span className="w-2 h-2 rounded-full bg-yellow-500/80" />
          <span className="w-2 h-2 rounded-full bg-green-500/80" />
          <span className="ml-2 text-[9px] font-mono font-bold text-slate-400 tracking-wider">
            CONSOLE
          </span>
        </div>
        <div className="flex gap-1 h-full pt-1.5">
          <button
            onClick={() => setActiveTab('query')}
            className={`px-3 py-1 text-[9px] font-mono font-bold rounded-t-md transition-all duration-150 cursor-pointer ${
              activeTab === 'query'
                ? 'bg-slate-900 text-cyan-400 border-t-2 border-cyan-400'
                : 'bg-slate-950 text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'
            }`}
          >
            [Query.log]
          </button>
          <button
            onClick={() => setActiveTab('tree')}
            className={`px-3 py-1 text-[9px] font-mono font-bold rounded-t-md transition-all duration-150 cursor-pointer ${
              activeTab === 'tree'
                ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-400'
                : 'bg-slate-950 text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'
            }`}
          >
            [Tree.log]
          </button>
        </div>
      </div>

      {/* Terminal content */}
      <div className="flex-1 p-3 overflow-auto font-mono text-[10px] text-slate-200 leading-normal flex flex-col gap-2 select-text">
        {/* Environment line */}
        <div>
          <span className="text-slate-400">Microsoft Windows [Version 10.0.22631]</span>
          <br />
          <span className="text-slate-400">(c) Microsoft Corporation. All rights reserved.</span>
        </div>

        {activeTab === 'query' ? (
          <>
            <div className="mt-1">
              <span className="text-violet-400 font-semibold">C:\ast-finder&gt;</span>{' '}
              <span className="text-cyan-400">node query-gen.js --line {selectedLine || 'none'} --node {selectedNode?.type || 'none'}</span>
            </div>

            {generatedQuery ? (
              <div className="mt-1 flex flex-col gap-2 flex-1 min-h-0">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Query compiled successfully:</span>
                  <button
                    onClick={handleCopyQuery}
                    className="text-[9px] text-accent-cyan hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer select-none"
                  >
                    {copiedQuery ? (
                      <>
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy S-Expression
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-950 border border-slate-800 rounded-md text-cyan-400 overflow-x-auto text-[10px] leading-relaxed shadow-inner">
                  {generatedQuery}
                </pre>
                <div className="text-[8px] text-slate-500 italic mt-0.5 select-none">
                  * Matches are highlighted dynamically in the code editor.
                </div>
              </div>
            ) : (
              <div className="mt-1 text-slate-500 italic select-none">
                [System] Click or select a line in the editor to inspect AST syntax and generate an S-expression query...
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mt-1">
              <span className="text-violet-400 font-semibold">C:\ast-finder&gt;</span>{' '}
              <span className="text-emerald-400">cat tree-sitter.log --follow</span>
            </div>

            {rootNodeString ? (
              <div className="mt-1 flex flex-col gap-2 flex-1 min-h-0">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Real-time S-expression captured (tree.rootNode.toString()):</span>
                  <button
                    onClick={handleCopyTree}
                    className="text-[9px] text-accent-emerald hover:text-emerald-300 transition-colors flex items-center gap-1 cursor-pointer select-none"
                  >
                    {copiedTree ? (
                      <>
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Tree S-Expr
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-950 border border-slate-800 rounded-md text-emerald-400 overflow-x-auto text-[10px] leading-relaxed shadow-inner max-h-[160px] overflow-y-auto">
                  {rootNodeString}
                </pre>
                <div className="text-[8px] text-slate-500 italic mt-0.5 select-none">
                  * This output updates dynamically on every code modification.
                </div>
              </div>
            ) : (
              <div className="mt-1 text-slate-500 italic select-none">
                [System] Real-time tree-sitter node representation is empty. Write code in the editor to capture...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default memo(CommandPanel);

