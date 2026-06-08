import { useState, useEffect, useRef, useCallback } from 'react';
import { Parser, Language, Query } from 'web-tree-sitter';

/**
 * Custom hook to initialize web-tree-sitter and manage parser lifecycle.
 * Handles async WASM loading and language switching.
 */
export function useTreeSitter(languageId = 'dart') {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const parserRef = useRef(null);
  const languageRef = useRef(null);
  const treeRef = useRef(null);
  const [tree, setTree] = useState(null);
  const [languageState, setLanguageState] = useState(null);

  // Initialize Parser + Language
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setIsReady(false);
        setError(null);

        // Initialize the WASM runtime (only needs to be called once)
        await Parser.init({
          locateFile(scriptName) {
            return `/${scriptName}`;
          },
        });

        const parser = new Parser();

        // Map language IDs to WASM file paths
        const wasmMap = {
          dart: '/tree-sitter-dart.wasm',
          yaml: '/tree-sitter-yaml.wasm',
        };

        const wasmPath = wasmMap[languageId];
        if (!wasmPath) {
          throw new Error(`Unsupported language: ${languageId}`);
        }

        // Load the language using the static Language.load method (v0.25.x API)
        const language = await Language.load(wasmPath);
        parser.setLanguage(language);

        if (!cancelled) {
          parserRef.current = parser;
          languageRef.current = language;
          setLanguageState(language);
          setIsReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Tree-sitter initialization failed:', err);
          setError(err.message || 'Failed to initialize parser');
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [languageId]);

  // Parse source code into a tree
  const parse = useCallback((sourceCode) => {
    if (!parserRef.current || !sourceCode) {
      treeRef.current = null;
      setTree(null);
      return null;
    }

    try {
      let activeTree = parserRef.current.parse(sourceCode);
      let isWrapped = false;

      // Check if raw code has errors and wrapping could fix it (only for Dart)
      if (languageId === 'dart' && activeTree.rootNode.hasError) {
        let wrappedCode = sourceCode.trim();
        if (!wrappedCode.endsWith(';')) {
          wrappedCode += ';';
        }
        const candidate = `void _wrapper() {\n${wrappedCode}\n}`;
        const wrappedTree = parserRef.current.parse(candidate);
        
        // If the wrapped version parses successfully without errors, adopt it!
        if (!wrappedTree.rootNode.hasError) {
          activeTree.delete();
          activeTree = wrappedTree;
          isWrapped = true;
        } else {
          wrappedTree.delete();
        }
      }

      activeTree.isWrapped = isWrapped;
      activeTree.rowOffset = isWrapped ? 1 : 0;

      treeRef.current = activeTree;
      setTree(activeTree);
      return activeTree;
    } catch (err) {
      console.error('Parse error:', err);
      return null;
    }
  }, [languageId]);

  // Run a tree-sitter query and return captures
  const runQuery = useCallback((queryString) => {
    if (!languageRef.current || !treeRef.current || !queryString?.trim()) {
      return { captures: [], error: null };
    }

    try {
      // Use standard Query constructor (v0.25.x API)
      const query = new Query(languageRef.current, queryString);
      const captures = query.captures(treeRef.current.rootNode);
      return { captures, error: null };
    } catch (err) {
      return { captures: [], error: err.message || 'Invalid query' };
    }
  }, []);

  return {
    isReady,
    error,
    tree,
    parse,
    runQuery,
    language: languageState,
  };
}

