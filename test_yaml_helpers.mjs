import { Parser, Language, Query } from 'web-tree-sitter';
import fs from 'fs';
import path from 'path';
import {
  generateQueryForNode,
  generateStructuredQuery,
  findNodeAtPosition,
  findNodeSpanningRange
} from './src/utils/astHelpers.js';

async function main() {
  await Parser.init();
  const parser = new Parser();

  const wasmPath = path.resolve('./public/tree-sitter-yaml.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);

  const language = await Language.load(new Uint8Array(wasmBuffer));
  parser.setLanguage(language);

  const code = `name: my_app
description: A new Flutter project.
version: 1.0.0+1

environment:
  sdk: ">=3.0.0 <4.0.0"

dev_dependencies:
  flutter_launcher_icons: "^0.13.1"

# Add flutter_icons config here following proper indentation structure
flutter_launcher_icons:
  android: "launcher_icon"
  ios: true
  image_path: "assets/logo.png"`;

  const tree = parser.parse(code);
  const root = tree.rootNode;

  // We want to test the query for:
  // 1. version: 1.0.0+1 (at row 2, cols 0 to 16)
  // 2. flutter_launcher_icons: (at row 11, col 0)
  // 3. image_path: "assets/logo.png" (at row 14, col 2 to 31)

  const targets = [
    {
      name: 'version: 1.0.0+1',
      row: 2,
      startCol: 0,
      endCol: 16
    },
    {
      name: 'flutter_launcher_icons:',
      row: 11,
      startCol: 0,
      endCol: 22
    },
    {
      name: 'image_path: "assets/logo.png"',
      row: 14,
      startCol: 2,
      endCol: 31
    }
  ];

  for (const t of targets) {
    console.log(`\n================== Target: ${t.name} ==================`);
    
    // Find node spanning the range
    const node = findNodeSpanningRange(root, t.row, t.startCol, t.row, t.endCol);
    if (!node) {
      console.log('Node not found spanning range!');
      continue;
    }
    console.log(`Found node: ${node.type} (${node.startPosition.row}:${node.startPosition.column} - ${node.endPosition.row}:${node.endPosition.column})`);

    // Test 1: Single Node Query
    const singleQuery = generateQueryForNode(node);
    console.log(`\n--- Single Query: ---`);
    console.log(singleQuery);
    try {
      const q = new Query(language, singleQuery);
      const matches = q.captures(root);
      console.log(`Compilation success! Matches: ${matches.length}`);
      q.delete();
    } catch (err) {
      console.log(`Compilation error: ${err.message}`);
    }

    // Test 2: Structured Query
    const structuredQuery = generateStructuredQuery(node);
    console.log(`\n--- Structured Query: ---`);
    console.log(structuredQuery);
    try {
      const q = new Query(language, structuredQuery);
      const matches = q.captures(root);
      console.log(`Compilation success! Matches: ${matches.length}`);
      q.delete();
    } catch (err) {
      console.log(`Compilation error: ${err.message}`);
    }
  }

  tree.delete();
}

main().catch(console.error);
