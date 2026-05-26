import { Parser, Language, Query } from 'web-tree-sitter';
import fs from 'fs';
import path from 'path';

async function main() {
  await Parser.init();
  const parser = new Parser();

  const wasmPath = path.resolve('./public/tree-sitter-dart.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);

  const language = await Language.load(new Uint8Array(wasmBuffer));
  parser.setLanguage(language);

  // The Dart code to test — wrapped in a function for valid parsing
  const code = `void _() {
Container(
  width: 100,
  height: 100,
  color: Colors.grey[200],
  // Add your Image.network here
  child: Image.network(
    'https://placekitten.com/200/200',
    fit: BoxFit.cover,
  ),
);
}`;

  console.log('Parsing code...');
  const tree = parser.parse(code);

  if (tree.rootNode.hasError) {
    console.log('Syntax errors found in the code!');
  } else {
    console.log('Syntax is valid.');
    console.log('AST Structure:\n', tree.rootNode.toString());
  }


  const q1 = `(named_argument
  (identifier) @var_identifier
  (selector
    (unconditional_assignable_selector
      (identifier) @var_identifier_1))
  (selector
    (argument_part
      (arguments
        (argument
          (string_literal) @var_string_literal))))
  (#eq? @var_identifier "Image")
  (#eq? @var_identifier_1 "network")
  (#eq? @var_string_literal "'https://placekitten.com/200/200'")
)`;

  const tests = [
    { name: "q1", queryStr: q1 },
  ];

  for (const t of tests) {
    console.log(`\nTesting: ${t.name}...`);
    try {
      const q = new Query(language, t.queryStr);
      const matches = q.matches(tree.rootNode);
      console.log(`Matches found: ${matches.length}`);
      if (matches.length > 0) {
        console.log(`✅ Passed!`);
      } else {
        console.log(`❌ Failed!`);
      }
      q.delete();
    } catch (err) {
      console.error(`Error executing query: ${err.message}`);
    }
  }

  tree.delete();
}

main().catch(console.error);
