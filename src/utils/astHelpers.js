/**
 * Converts a tree-sitter node into a serializable tree structure
 * for rendering in the AST tree view.
 */
export function nodeToTree(node, depth = 0, isWrapped = false) {
  if (!node) return null;

  // If this is the root node of a wrapped tree, let's extract the actual user expression
  if (depth === 0 && isWrapped) {
    let functionDecl = null;
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === 'function_declaration') {
        functionDecl = node.child(i);
        break;
      }
    }

    if (functionDecl) {
      let functionBody = null;
      for (let i = 0; i < functionDecl.childCount; i++) {
        if (functionDecl.child(i).type === 'function_body') {
          functionBody = functionDecl.child(i);
          break;
        }
      }

      if (functionBody) {
        // The children inside functionBody are '{', expressions/statements, and '}'
        const children = [];
        for (let i = 0; i < functionBody.childCount; i++) {
          const childNode = functionBody.child(i);
          if (childNode.type !== '{' && childNode.type !== '}' && childNode.type !== ';') {
            const childTree = nodeToTree(childNode, 0, true); // recurse as virtual root
            if (childTree) children.push(childTree);
          }
        }
        
        // If there's only one major child statement, make it the virtual root!
        if (children.length === 1) {
          return children[0];
        }
        
        // Otherwise, return a clean virtual program root containing these children
        return {
          id: `virtual-program-root`,
          type: 'program',
          text: node.text,
          fullText: node.text,
          isNamed: true,
          startRow: 0,
          startCol: 0,
          endRow: node.endPosition.row - 2,
          endCol: node.endPosition.column,
          childCount: children.length,
          children,
          depth: 0,
        };
      }
    }
  }

  // Adjust row if wrapped
  const rowOffset = isWrapped ? 1 : 0;

  const children = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = nodeToTree(node.child(i), depth + 1, isWrapped);
    if (child) children.push(child);
  }

  return {
    id: `${node.type}-${node.startPosition.row - rowOffset}:${node.startPosition.column}-${node.endPosition.row - rowOffset}:${node.endPosition.column}-${node.id}`,
    type: node.type,
    text: node.text?.length <= 60 ? node.text : node.text?.slice(0, 57) + '...',
    fullText: node.text,
    isNamed: node.isNamed,
    startRow: node.startPosition.row - rowOffset,
    startCol: node.startPosition.column,
    endRow: node.endPosition.row - rowOffset,
    endCol: node.endPosition.column,
    childCount: node.childCount,
    children,
    depth,
  };
}

/**
 * Walk the AST and find all nodes whose text matches the search term.
 * Returns matching nodes with their paths.
 */
export function findNodesByText(rootTreeNode, searchTerm) {
  if (!rootTreeNode || !searchTerm) return [];

  const results = [];
  const lowerSearch = searchTerm.toLowerCase();

  function walk(node) {
    if (!node) return;

    // Check if this node's text matches exactly (for leaf nodes)
    // or if the node type is an identifier/literal that matches
    if (node.isNamed && node.childCount === 0) {
      if (node.text && node.text.toLowerCase().includes(lowerSearch)) {
        results.push({
          type: node.type,
          text: node.text,
          startRow: node.startPosition.row,
          startCol: node.startPosition.column,
          endRow: node.endPosition.row,
          endCol: node.endPosition.column,
          id: `${node.type}-${node.startPosition.row}:${node.startPosition.column}-${node.endPosition.row}:${node.endPosition.column}`,
        });
      }
    }

    for (let i = 0; i < node.childCount; i++) {
      walk(node.child(i));
    }
  }

  walk(rootTreeNode);
  return results;
}

/**
 * Generate a tree-sitter S-expression query for matching nodes.
 * Groups nodes by type and creates a query with text predicates.
 */
export function generateQueryForMatches(matches) {
  if (!matches || matches.length === 0) return '';

  // Group matches by node type
  const byType = {};
  for (const m of matches) {
    if (!byType[m.type]) byType[m.type] = new Set();
    byType[m.type].add(m.text);
  }

  // Generate query patterns
  const patterns = [];
  for (const [type, texts] of Object.entries(byType)) {
    for (const text of texts) {
      patterns.push(`((${type}) @match (#eq? @match "${text.replace(/"/g, '\\"')}"))`);
    }
  }

  return patterns.join('\n');
}

/**
 * Flatten a tree node structure into a flat array of IDs for search matching.
 */
export function flattenTreeIds(treeNode) {
  if (!treeNode) return [];
  const ids = [treeNode.id];
  for (const child of (treeNode.children || [])) {
    ids.push(...flattenTreeIds(child));
  }
  return ids;
}

/**
 * Traverses the AST root node down to find the deepest/smallest named node spanning that row and column range.
 */
export function findNodeAtPosition(node, row, column) {
  if (!node) return null;

  let bestNode = null;

  function walkStrict(currentNode) {
    if (!currentNode) return;
    const start = currentNode.startPosition;
    const end = currentNode.endPosition;

    // Check if within bounds
    let within = false;
    if (row > start.row && row < end.row) {
      within = true;
    } else if (row === start.row && row === end.row) {
      within = column >= start.column && column <= end.column;
    } else if (row === start.row) {
      within = column >= start.column;
    } else if (row === end.row) {
      within = column <= end.column;
    }

    if (!within) return;

    if (currentNode.isNamed) {
      bestNode = currentNode;
    }

    for (let i = 0; i < currentNode.childCount; i++) {
      walkStrict(currentNode.child(i));
    }
  }

  walkStrict(node);

  // If we found a named node, and it's not the root program node, return it!
  if (bestNode && bestNode.parent !== null) {
    return bestNode;
  }

  // Fallback: search for the deepest named node on the row, ignoring column
  let fallbackNode = null;
  let maxDepth = -1;

  function walkRowOnly(currentNode, depth = 0) {
    if (!currentNode) return;
    const start = currentNode.startPosition;
    const end = currentNode.endPosition;

    // Check if the node intersects the row
    if (row >= start.row && row <= end.row) {
      if (currentNode.isNamed && depth > maxDepth) {
        maxDepth = depth;
        fallbackNode = currentNode;
      }
      for (let i = 0; i < currentNode.childCount; i++) {
        walkRowOnly(currentNode.child(i), depth + 1);
      }
    }
  }

  walkRowOnly(node);
  return fallbackNode || bestNode;
}

/**
 * Generate a tree-sitter S-expression query for a specific node.
 */
export function generateQueryForNode(node) {
  if (!node) return '';

  const type = node.type;
  const text = node.text || '';

  // For leaf nodes / identifiers / literals, generate a query matching the exact text
  if (node.childCount === 0 && text) {
    const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `((${type}) @match\n  (#eq? @match "${escapedText}"))`;
  }

  // For container nodes, let's generate a query matching its type
  return `(${type})`;
}

/**
 * Find the deepest named node that completely contains the coordinate selection range.
 */
export function findNodeSpanningRange(node, startRow, startCol, endRow, endCol) {
  if (!node) return null;

  let bestNode = null;

  const posGte = (p1, r2, c2) => p1.row > r2 || (p1.row === r2 && p1.column >= c2);
  const posLte = (p1, r2, c2) => p1.row < r2 || (p1.row === r2 && p1.column <= c2);

  function walk(currentNode) {
    if (!currentNode) return;
    const start = currentNode.startPosition;
    const end = currentNode.endPosition;

    // Check if the node completely spans the selection range
    const spans = posLte(start, startRow, startCol) && posGte(end, endRow, endCol);
    if (!spans) return;

    if (currentNode.isNamed) {
      bestNode = currentNode;
    }

    for (let i = 0; i < currentNode.childCount; i++) {
      walk(currentNode.child(i));
    }
  }

  walk(node);
  return bestNode;
}

/**
 * Generate structured S-expression query showing named child structures with exact text matching for leaf nodes.
 */
export function generateStructuredQuery(node) {
  if (!node) return '';

  const type = node.type === 'ERROR' ? '_' : node.type;
  const text = node.text || '';

  // For leaf nodes, match exact text
  if (node.childCount === 0 && text) {
    const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `((${type}) @match\n  (#eq? @match "${escapedText}"))`;
  }

  // Pre-generate unique capture names for all leaf named nodes in the subtree
  const captureNames = {};
  const leafNodes = [];
  const usedNames = new Set();

  function collectLeafNamedNodes(curr, parentField = null) {
    if (!curr) return;

    if (curr.isNamed && curr.childCount === 0) {
      leafNodes.push({ node: curr, fieldName: parentField });
      return;
    }

    for (let i = 0; i < curr.childCount; i++) {
      collectLeafNamedNodes(curr.child(i), curr.fieldNameForChild(i));
    }
  }

  // Collect leaf named nodes recursively starting from immediate children
  for (let i = 0; i < node.childCount; i++) {
    collectLeafNamedNodes(node.child(i), node.fieldNameForChild(i));
  }

  // Assign unique capture names (e.g. @var_name or @var_identifier)
  leafNodes.forEach(({ node: leaf, fieldName }) => {
    const cleanType = leaf.type.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const baseName = fieldName ? `var_${fieldName}` : `var_${cleanType}`;
    let name = baseName;
    let counter = 1;
    while (usedNames.has(name)) {
      name = `${baseName}_${counter}`;
      counter++;
    }
    usedNames.add(name);
    captureNames[leaf.id] = `@${name}`;
  });

  // Recursive query structure builder
  function buildQuery(currentNode, indentDepth = 1) {
    const spacing = '  '.repeat(indentDepth);
    const nodeType = currentNode.type === 'ERROR' ? '_' : currentNode.type;

    if (captureNames[currentNode.id]) {
      return `(${nodeType}) ${captureNames[currentNode.id]}`;
    }

    if (currentNode.childCount === 0) {
      return `(${nodeType})`;
    }

    const childStrings = [];
    for (let i = 0; i < currentNode.childCount; i++) {
      const child = currentNode.child(i);
      if (child.isNamed || child.type === 'ERROR') {
        const fieldName = currentNode.fieldNameForChild(i);
        const childStr = buildQuery(child, indentDepth + 1);
        if (fieldName) {
          childStrings.push(`${spacing}${fieldName}: ${childStr}`);
        } else {
          childStrings.push(`${spacing}${childStr}`);
        }
      }
    }

    if (childStrings.length === 0) {
      return `(${nodeType})`;
    }

    return `(${nodeType}\n${childStrings.join('\n')}\n${'  '.repeat(indentDepth - 1)})`;
  }

  const mainQuery = buildQuery(node, 1);

  // Generate #eq? predicates
  const predicates = [];
  leafNodes.forEach(({ node: leaf }) => {
    const capture = captureNames[leaf.id];
    const leafText = leaf.text || '';
    const escapedText = leafText.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    predicates.push(`(#eq? ${capture} "${escapedText}")`);
  });

  const predicateString = predicates.map(p => `  ${p}`).join('\n');

  if (predicates.length > 0) {
    if (mainQuery.endsWith(')')) {
      return `${mainQuery.slice(0, -1)}\n${predicateString}\n)`;
    } else {
      return `(${mainQuery})\n${predicates.join('\n')}`;
    }
  }

  return mainQuery;
}

/**
 * Find the Lowest Common Ancestor (LCA) node for a list of tree-sitter nodes.
 */
export function findLCA(nodes) {
  if (!nodes || nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];

  const getAncestors = (node) => {
    const path = [];
    let curr = node;
    while (curr) {
      path.push(curr);
      curr = curr.parent;
    }
    return path;
  };

  const firstPath = getAncestors(nodes[0]);

  const otherAncestorSets = nodes.slice(1).map(node => {
    const set = new Set();
    let curr = node;
    while (curr) {
      set.add(curr.id);
      curr = curr.parent;
    }
    return set;
  });

  for (const ancestor of firstPath) {
    const isCommon = otherAncestorSets.every(set => set.has(ancestor.id));
    if (isCommon) {
      return ancestor;
    }
  }

  return null;
}

/**
 * Generate a single unified query for the LCA node targeting the Alt-clicked nodes.
 */
export function generateLCAQuery(lcaNode, clickedNodes) {
  if (!lcaNode || !clickedNodes || clickedNodes.length === 0) return '';

  const captureNames = {};
  const usedNames = new Set();
  const leafPredicates = [];
  const activeNodeIds = new Set();

  // Helper to assign a unique capture name to a node
  function assignCaptureName(node) {
    if (captureNames[node.id]) return captureNames[node.id];

    const parent = node.parent;
    let fieldName = null;
    if (parent) {
      for (let i = 0; i < parent.childCount; i++) {
        if (parent.child(i).id === node.id) {
          fieldName = parent.fieldNameForChild(i);
          break;
        }
      }
    }

    const cleanType = node.type.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const baseName = fieldName ? `var_${fieldName}` : `var_${cleanType}`;
    let name = baseName;
    let counter = 1;
    while (usedNames.has(name)) {
      name = `${baseName}_${counter}`;
      counter++;
    }
    usedNames.add(name);
    captureNames[node.id] = `@${name}`;
    return `@${name}`;
  }

  // 1. Mark paths from clicked nodes up to lcaNode as active
  clickedNodes.forEach(node => {
    let curr = node;
    while (curr) {
      activeNodeIds.add(curr.id);
      if (curr.id === lcaNode.id) break;
      curr = curr.parent;
    }
  });

  // 2. Assign captures and handle container/leaf clicked nodes
  clickedNodes.forEach((node) => {
    const capture = assignCaptureName(node);

    if (node.childCount === 0) {
      // It's a leaf node, we need an #eq? predicate for its text
      leafPredicates.push({ capture, text: node.text });
    } else {
      // It's a container node, we don't do #eq? on the container itself.
      // Instead, we recursively find all named leaf descendants in its subtree,
      // assign them capture names, make their paths active, and add #eq? predicates for them.
      function collectLeafNamedNodes(curr) {
        if (!curr) return;

        if (curr.isNamed && curr.childCount === 0) {
          const leafCapture = assignCaptureName(curr);
          leafPredicates.push({ capture: leafCapture, text: curr.text });

          // Add this leaf node and its path up to 'node' to activeNodeIds
          let pathCurr = curr;
          while (pathCurr) {
            activeNodeIds.add(pathCurr.id);
            if (pathCurr.id === node.id) break;
            pathCurr = pathCurr.parent;
          }
          return;
        }

        for (let i = 0; i < curr.childCount; i++) {
          collectLeafNamedNodes(curr.child(i));
        }
      }

      collectLeafNamedNodes(node);
    }
  });

  // Recursive query builder traversing only active paths
  function buildQuery(currentNode, indentDepth = 1) {
    const spacing = '  '.repeat(indentDepth);
    const hasCapture = !!captureNames[currentNode.id];
    const nodeType = currentNode.type === 'ERROR' ? '_' : currentNode.type;

    if (hasCapture && currentNode.childCount === 0) {
      return `(${nodeType}) ${captureNames[currentNode.id]}`;
    }

    if (currentNode.childCount === 0) {
      return `(${nodeType})`;
    }

    const activeChildren = [];
    for (let i = 0; i < currentNode.childCount; i++) {
      const child = currentNode.child(i);
      if (activeNodeIds.has(child.id)) {
        activeChildren.push({
          child,
          fieldName: currentNode.fieldNameForChild(i),
        });
      }
    }

    if (activeChildren.length === 0) {
      let res = `(${nodeType})`;
      if (hasCapture) {
        res += ` ${captureNames[currentNode.id]}`;
      }
      return res;
    }

    let res = `(${nodeType}`;
    activeChildren.forEach(({ child, fieldName }) => {
      const childStr = buildQuery(child, indentDepth + 1);
      if (fieldName) {
        res += `\n${spacing}${fieldName}: ${childStr}`;
      } else {
        res += `\n${spacing}${childStr}`;
      }
    });
    res += `)`;

    if (hasCapture) {
      res += ` ${captureNames[currentNode.id]}`;
    }
    return res;
  }

  const lcaQueryString = buildQuery(lcaNode, 1);

  // Generate #eq? predicates
  const predicates = [];
  leafPredicates.forEach(({ capture, text }) => {
    const escapedText = (text || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    predicates.push(`(#eq? ${capture} "${escapedText}")`);
  });

  const predicateString = predicates.map(p => `  ${p}`).join('\n');

  if (predicates.length > 0) {
    if (captureNames[lcaNode.id]) {
      return `(${lcaQueryString}\n${predicateString}\n)`;
    } else if (lcaQueryString.endsWith(')')) {
      return `${lcaQueryString.slice(0, -1)}\n${predicateString}\n)`;
    } else {
      return `(${lcaQueryString})\n${predicates.join('\n')}`;
    }
  }

  return lcaQueryString;
}

/**
 * Parses an S-expression string into an AST structure.
 */
export function parseSExpression(sExpr) {
  let index = 0;

  function parse() {
    // Skip whitespace
    while (index < sExpr.length && /\s/.test(sExpr[index])) {
      index++;
    }

    if (index >= sExpr.length) return null;

    if (sExpr[index] === '(') {
      index++; // consume '('
      const node = { type: 'list', children: [] };

      while (index < sExpr.length) {
        // Skip whitespace
        while (index < sExpr.length && /\s/.test(sExpr[index])) {
          index++;
        }

        if (sExpr[index] === ')') {
          index++; // consume ')'
          return node;
        }

        const child = parse();
        if (child) {
          node.children.push(child);
        }
      }
      return node;
    } else {
      // It's a text token (like an identifier, field name, etc.)
      let start = index;
      while (index < sExpr.length && sExpr[index] !== '(' && sExpr[index] !== ')' && !/\s/.test(sExpr[index])) {
        index++;
      }
      return { type: 'atom', value: sExpr.slice(start, index) };
    }
  }

  return parse();
}

/**
 * Pretty prints a parsed S-expression AST structure recursively.
 */
export function stringifySExpression(node, indent = 0) {
  if (!node) return '';

  if (node.type === 'atom') {
    return node.value;
  }

  const spacing = '  '.repeat(indent);

  // Check if it has any nested lists as children.
  const hasNestedLists = node.children.some(child => child.type === 'list');

  // If it has no nested lists and is reasonably short, print inline.
  if (!hasNestedLists) {
    const inline = '(' + node.children.map(c => c.value).join(' ') + ')';
    if (inline.length < 60) {
      return inline;
    }
  }

  const firstChild = node.children[0];
  let firstLine = '(';
  let startIndex = 0;

  if (firstChild && firstChild.type === 'atom') {
    firstLine += firstChild.value;
    startIndex = 1;
  }

  const childStrings = [];
  for (let i = startIndex; i < node.children.length; i++) {
    const child = node.children[i];
    if (child.type === 'list') {
      childStrings.push(stringifySExpression(child, indent + 1));
    } else {
      // If it is a field name ending with colon, combine it with the next child to keep it readable
      const nextChild = node.children[i + 1];
      if (child.value.endsWith(':') && nextChild) {
        if (nextChild.type === 'atom') {
          childStrings.push(`${child.value} ${nextChild.value}`);
          i++; // skip next child
        } else {
          const formattedList = stringifySExpression(nextChild, indent + 1);
          childStrings.push(`${child.value} ${formattedList.trim()}`);
          i++; // skip next child
        }
      } else {
        childStrings.push(child.value);
      }
    }
  }

  if (childStrings.length === 0) {
    return firstLine + ')';
  }

  const childSpacing = '  '.repeat(indent + 1);
  return `${firstLine}\n${childSpacing}${childStrings.join('\n' + childSpacing)}\n${spacing})`;
}

/**
 * Top-level function to pretty-print a tree-sitter rootNode.toString() S-expression.
 */
export function formatSExpression(sExpr) {
  if (!sExpr) return '';
  const parsed = parseSExpression(sExpr);
  return stringifySExpression(parsed);
}



