#!/usr/bin/env node
/**
 * Static analyzer for game-ui-refiner.
 *
 * Now that the JS is split across multiple ES modules in js/ (compiled
 * from src/), this analyzer:
 *
 *   1. Validates index.html doesn't have stray inline <script> blocks
 *   2. Verifies index.html references ./js/main.js as a module
 *   3. Parses every js/*.js with acorn (syntax check)
 *   4. Detects stray "</script>" in any js file (would break browsers if
 *      ever inlined back into HTML)
 *   5. Detects direct self-recursion within each module
 *   6. Detects indirect recursion cycles within each module via Tarjan SCC
 *   7. Cross-checks DOM IDs declared in HTML vs referenced from JS via
 *      $('foo'), getElementById('foo'), document.getElementById('foo')
 *
 * Usage:
 *   node tools/check.mjs                # check ../index.html + ../js/
 *   node tools/check.mjs path/to/dir    # check that dir
 *
 * Exit code: 0 = clean, 1 = problems found
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..');

const indexPath = path.join(projectDir, 'index.html');
const jsDir = path.join(projectDir, 'js');

if (!fs.existsSync(indexPath)) {
  console.error(`✗ ${indexPath} not found`);
  process.exit(1);
}

console.log(`▶ checking ${path.relative(process.cwd(), projectDir) || '.'}`);

let problems = 0;
const fail = (msg) => { problems++; console.log(`  ✗ ${msg}`); };
const ok = (msg) => { console.log(`  ✓ ${msg}`); };

// =====================================================================
// 1. index.html structure
// =====================================================================
console.log('\n[1] index.html structure');
const html = fs.readFileSync(indexPath, 'utf8');
console.log(`  ${html.length} bytes`);

// Check that there's no inline <script>...</script> with code in it (only src= references)
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
const nonEmpty = inlineScripts.filter((m) => m[1].trim().length > 0);
if (nonEmpty.length > 0) {
  fail(`found ${nonEmpty.length} non-empty inline <script> blocks (should use src= or type=module)`);
} else {
  ok('no inline <script> code blocks');
}

// Check that ./js/main.js is referenced as a module
if (/<script[^>]*type="module"[^>]*src="\.\/js\/main\.js"/.test(html) ||
    /<script[^>]*src="\.\/js\/main\.js"[^>]*type="module"/.test(html)) {
  ok('references ./js/main.js as type=module');
} else {
  fail('index.html should load ./js/main.js with type="module"');
}

// =====================================================================
// 2. js/ directory exists and has files
// =====================================================================
console.log('\n[2] compiled js/ files');
if (!fs.existsSync(jsDir)) {
  fail(`${jsDir} does not exist — run 'npm run build' to compile from src/`);
  process.exit(1);
}

const jsFiles = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));
if (jsFiles.length === 0) {
  fail('js/ has no .js files — run npm run build');
  process.exit(1);
}
console.log(`  ${jsFiles.length} files: ${jsFiles.join(', ')}`);
ok('compiled output present');

// =====================================================================
// 3-6. Per-module checks
// =====================================================================

const allFuncs = new Map(); // qualified name → AST node
const allCalls = new Map(); // qualified name → Set of called names

for (const file of jsFiles) {
  const filePath = path.join(jsDir, file);
  const src = fs.readFileSync(filePath, 'utf8');

  console.log(`\n[3.${file}] ${src.length} bytes`);

  // Stray </script>
  if (/<\/script>/.test(src)) {
    fail(`stray "</script>" in ${file}`);
  }

  // Bracket balance
  const balanced = ['{}', '()', '[]'].every(([o, c]) => {
    const no = (src.match(new RegExp('\\' + o, 'g')) || []).length;
    const nc = (src.match(new RegExp('\\' + c, 'g')) || []).length;
    if (no !== nc) {
      fail(`${file}: ${o}${c} mismatch ${no} vs ${nc}`);
      return false;
    }
    return true;
  });

  // Acorn parse
  let ast;
  try {
    ast = acorn.parse(src, {
      ecmaVersion: 2023,
      sourceType: 'module',
      allowImportExportEverywhere: true,
    });
  } catch (e) {
    fail(`${file}: parse error: ${e.message}`);
    continue;
  }

  // Function inventory + call graph (per module)
  const funcs = new Map(); // local name → body AST
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.type === 'FunctionDeclaration' && node.id) {
      funcs.set(node.id.name, node);
    }
    if (node.type === 'VariableDeclarator' && node.init &&
        (node.init.type === 'FunctionExpression' || node.init.type === 'ArrowFunctionExpression') &&
        node.id?.type === 'Identifier') {
      funcs.set(node.id.name, node.init);
    }
    for (const k in node) {
      if (k === 'parent' || k === 'loc' || k === 'range') continue;
      walk(node[k]);
    }
  }
  walk(ast);

  // Build call graph
  const calls = new Map();
  for (const [name, fn] of funcs) {
    const out = new Set();
    function w(n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(w); return; }
      if (n.type === 'CallExpression' && n.callee?.type === 'Identifier' && funcs.has(n.callee.name)) {
        out.add(n.callee.name);
      }
      for (const k in n) {
        if (k === 'parent' || k === 'loc' || k === 'range') continue;
        w(n[k]);
      }
    }
    w(fn.body);
    calls.set(name, out);
  }

  // Direct self-recursion
  let selfCount = 0;
  for (const [name, cs] of calls) {
    if (cs.has(name)) {
      fail(`${file}: self-recursion ${name} → ${name}`);
      selfCount++;
    }
  }

  // Tarjan SCC for indirect cycles
  let cycleCount = 0;
  let idx = 0;
  const stack = [];
  const idxs = new Map();
  const lows = new Map();
  const onStack = new Set();
  function tarjan(v) {
    idxs.set(v, idx); lows.set(v, idx); idx++;
    stack.push(v); onStack.add(v);
    for (const w of (calls.get(v) || [])) {
      if (!idxs.has(w)) {
        tarjan(w);
        lows.set(v, Math.min(lows.get(v), lows.get(w)));
      } else if (onStack.has(w)) {
        lows.set(v, Math.min(lows.get(v), idxs.get(w)));
      }
    }
    if (lows.get(v) === idxs.get(v)) {
      const scc = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); scc.push(w); } while (w !== v);
      if (scc.length > 1) {
        fail(`${file}: cycle ${scc.join(' ↔ ')}`);
        cycleCount++;
      }
    }
  }
  for (const v of funcs.keys()) if (!idxs.has(v)) tarjan(v);

  if (balanced && selfCount === 0 && cycleCount === 0) {
    ok(`${funcs.size} functions, balanced, no cycles, parses cleanly`);
  }
}

// =====================================================================
// 7. DOM IDs cross-check
// =====================================================================
console.log('\n[7] DOM IDs declared vs referenced');
const declaredIds = new Set();
for (const m of html.matchAll(/\bid="([^"]+)"/g)) declaredIds.add(m[1]);

const referencedIds = new Set();
for (const file of jsFiles) {
  const src = fs.readFileSync(path.join(jsDir, file), 'utf8');
  for (const m of src.matchAll(/\$\(\s*['"]([\w-]+)['"]\s*\)/g)) referencedIds.add(m[1]);
  for (const m of src.matchAll(/getElementById\(\s*['"]([\w-]+)['"]\s*\)/g)) referencedIds.add(m[1]);
}

const missing = [...referencedIds].filter((id) => !declaredIds.has(id));
ok(`${declaredIds.size} declared, ${referencedIds.size} referenced from JS`);
if (missing.length) {
  for (const id of missing) fail(`JS references #${id} but no element declared`);
}

// =====================================================================
// 8. Source files (TypeScript)
// =====================================================================
console.log('\n[8] src/ TypeScript sources');
const srcDir = path.join(projectDir, 'src');
if (fs.existsSync(srcDir)) {
  const tsFiles = fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
  ok(`${tsFiles.length} .ts files: ${tsFiles.join(', ')}`);

  // Make sure compiled output is fresh: every .ts has a .js with newer mtime
  let stale = 0;
  for (const ts of tsFiles) {
    const js = ts.replace(/\.ts$/, '.js');
    const tsPath = path.join(srcDir, ts);
    const jsPath = path.join(jsDir, js);
    if (!fs.existsSync(jsPath)) {
      fail(`compiled output missing for ${ts} — run npm run build`);
      stale++;
      continue;
    }
    if (fs.statSync(tsPath).mtimeMs > fs.statSync(jsPath).mtimeMs + 1000) {
      fail(`${ts} is newer than ${js} — run npm run build`);
      stale++;
    }
  }
  if (stale === 0) ok('compiled output is up to date with src/');
} else {
  console.log('  (no src/ dir, skipping)');
}

// =====================================================================
// Final verdict
// =====================================================================
console.log();
if (problems === 0) {
  console.log('✓ all checks passed');
  process.exit(0);
} else {
  console.log(`✗ ${problems} problem${problems > 1 ? 's' : ''} found`);
  process.exit(1);
}
