import { Parser, Language, Query } from 'web-tree-sitter';
import fs from 'fs';
import path from 'path';

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

  const queries = [
    {
      name: 'Query for "1.0.0+1" (string_scalar)',
      queryStr: '((string_scalar) @match (#eq? @match "1.0.0+1"))'
    },
    {
      name: 'Query for "flutter_launcher_icons:" (block_mapping_pair key)',
      queryStr: '((string_scalar) @match (#eq? @match "flutter_launcher_icons"))'
    },
    {
      name: 'Query for "image_path: "assets/logo.png""',
      queryStr: '((double_quote_scalar) @match (#eq? @match "\\"assets/logo.png\\""))'
    }
  ];

  for (const qObj of queries) {
    console.log(`\nCompiling: ${qObj.name}...`);
    try {
      const q = new Query(language, qObj.queryStr);
      const matches = q.captures(tree.rootNode);
      console.log(`Success! Matches found: ${matches.length}`);
      for (const m of matches) {
        console.log(`  Match text: "${m.node.text}" at ${m.node.startPosition.row}:${m.node.startPosition.column}`);
      }
      q.delete();
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
  }

  tree.delete();
}

main().catch(console.error);
