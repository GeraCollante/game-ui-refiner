#!/usr/bin/env node
/**
 * Plain-Node test runner — no jest, no vitest, no mocha.
 *
 * Tests the pure parser functions from src/parser.ts (compiled to js/parser.js).
 * Run with: `node tests/run.mjs` or `npm test`.
 *
 * Exit code: 0 = all green, 1 = at least one failure.
 */

import {
  stripFences,
  dedentCommon,
  extractAllFences,
  parseDualOutput,
  parseSvelteParts,
  extractJson,
  clamp01_10,
  parseDecomposeJson,
} from '../js/parser.js';
import { compileLayersToSvelte, compileLayersToCss } from '../js/decompose.js';

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e });
    process.stdout.write(`  ✗ ${name}\n    ${e.message}\n`);
  }
}

function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg}\n      expected: ${e}\n      actual:   ${a}`);
  }
}
function truthy(v, msg = '') {
  if (!v) throw new Error(msg || `expected truthy, got ${JSON.stringify(v)}`);
}
function falsy(v, msg = '') {
  if (v) throw new Error(msg || `expected falsy, got ${JSON.stringify(v)}`);
}

// =====================================================================
console.log('\n[stripFences]');
// =====================================================================

test('strips ```html fence', () => {
  eq(stripFences('```html\n<div></div>\n```'), '<div></div>');
});
test('strips ```svelte fence', () => {
  eq(stripFences('```svelte\n<script></script>\n```'), '<script></script>');
});
test('strips bare fence', () => {
  eq(stripFences('```\nfoo\n```'), 'foo');
});
test('returns trimmed text when no fence', () => {
  eq(stripFences('  hello  '), 'hello');
});

// =====================================================================
console.log('\n[dedentCommon]');
// =====================================================================

test('strips 4 spaces of common indent', () => {
  const input = '    line1\n    line2\n    line3';
  eq(dedentCommon(input), 'line1\nline2\nline3');
});
test('preserves relative indent', () => {
  const input = '    foo\n      bar\n    baz';
  eq(dedentCommon(input), 'foo\n  bar\nbaz');
});
test('no-op when no leading whitespace', () => {
  eq(dedentCommon('foo\nbar'), 'foo\nbar');
});
test('ignores empty lines for indent calculation', () => {
  const input = '    foo\n\n    bar';
  eq(dedentCommon(input), 'foo\n\nbar');
});

// =====================================================================
console.log('\n[extractAllFences]');
// =====================================================================

test('extracts single labeled fence', () => {
  const fences = extractAllFences('```svelte\n<div/>\n```');
  eq(fences.length, 1);
  eq(fences[0].lang, 'svelte');
  eq(fences[0].body, '<div/>');
});
test('extracts multiple fences', () => {
  const fences = extractAllFences('```svelte\nA\n```\n\n```html\nB\n```');
  eq(fences.length, 2);
  eq(fences[0].lang, 'svelte');
  eq(fences[1].lang, 'html');
});
test('handles indented fences in markdown lists', () => {
  const input = `7. **Writing the Svelte Code:**

    \`\`\`svelte
    <div class="x">y</div>
    <style>.x { color: red; }</style>
    \`\`\``;
  const fences = extractAllFences(input);
  eq(fences.length, 1);
  eq(fences[0].lang, 'svelte');
  truthy(fences[0].body.includes('<div class="x">y</div>'));
  // Verify dedent was applied
  falsy(fences[0].body.startsWith('    '));
});
test('extracts fence without language tag', () => {
  const fences = extractAllFences('```\nfoo\n```');
  eq(fences.length, 1);
  eq(fences[0].lang, '');
  eq(fences[0].body, 'foo');
});
test('returns empty array for no fences', () => {
  eq(extractAllFences('plain text'), []);
});

// =====================================================================
console.log('\n[parseDualOutput]');
// =====================================================================

test('parses clean svelte + html dual output', () => {
  const input = '```svelte\n<div>x</div>\n<style>div{color:red}</style>\n```\n```html\n<!doctype html><html><body><div>x</div></body></html>\n```';
  const r = parseDualOutput(input);
  truthy(r.svelte);
  truthy(r.html);
  truthy(r.svelte.includes('<div>x</div>'));
  truthy(r.html.includes('<!doctype html>'));
});

test('survives prose preamble before fences', () => {
  const input = `Looking at the image, I see a button. Let me think about it.

Step 1: Identify the colors.
Step 2: Build the markup.

\`\`\`svelte
<button>OK</button>
<style>button { padding: 8px; }</style>
\`\`\`

\`\`\`html
<!doctype html><html><body><button>OK</button></body></html>
\`\`\``;
  const r = parseDualOutput(input);
  truthy(r.svelte, 'svelte should be extracted');
  truthy(r.html, 'html should be extracted');
  truthy(r.svelte.includes('<button>OK</button>'));
});

test('survives indented fences in markdown numbered list', () => {
  const input = `7.  **Writing the Svelte Code:**

    \`\`\`svelte
    <div class="bg">test</div>
    <style>.bg { padding: 12px; }</style>
    \`\`\`

8.  **HTML preview:**

    \`\`\`html
    <!doctype html><html><body><div class="bg">test</div></body></html>
    \`\`\``;
  const r = parseDualOutput(input);
  truthy(r.svelte);
  truthy(r.html);
  truthy(r.svelte.includes('<div class="bg">'));
  truthy(r.html.includes('<!doctype html>'));
});

test('synthesizes html from svelte when only svelte present', () => {
  const r = parseDualOutput('```svelte\n<div>x</div>\n<style>div { color: red; }</style>\n```');
  truthy(r.svelte);
  truthy(r.html, 'html should be synthesized');
  truthy(r.html.includes('<!doctype html>'));
  truthy(r.html.includes('div { color: red; }'));
  truthy(r.parserNotes.some((n) => n.includes('synthesized from svelte')));
});

test('synthesizes svelte from html when only html present', () => {
  const r = parseDualOutput('```html\n<!doctype html><html><body><div>x</div><style>div{color:red}</style></body></html>\n```');
  truthy(r.svelte, 'svelte should be synthesized');
  truthy(r.html);
  truthy(r.parserNotes.some((n) => n.includes('synthesized from html')));
});

test('detects unlabeled fence by content (html)', () => {
  const input = '```\n<!doctype html><html><body>x</body></html>\n```';
  const r = parseDualOutput(input);
  truthy(r.html);
  truthy(r.html.includes('<!doctype html>'));
});

test('detects unlabeled fence by content (svelte)', () => {
  const input = '```\n<script>let x = 1</script><div>x</div><style>div{}</style>\n```';
  const r = parseDualOutput(input);
  truthy(r.svelte);
});

test('falls back to raw text when no fences', () => {
  const r = parseDualOutput('<!doctype html><html><body>x</body></html>');
  truthy(r.html);
});

test('returns failure note for empty input', () => {
  const r = parseDualOutput('');
  eq(r.svelte, null);
  eq(r.html, null);
  truthy(r.parserNotes.includes('empty input'));
});

test('returns failure note for prose-only input', () => {
  const r = parseDualOutput('Just some words about UI design.');
  truthy(r.parserNotes.some((n) => n.startsWith('FAIL') || n.includes('synthesized')));
});

test('flags truncation when svelte does not end in </style>/</script>/</div>', () => {
  const input = '```svelte\n<div>incomplete<button>OK\n```';
  const r = parseDualOutput(input);
  truthy(r.parserNotes.some((n) => n.includes('truncado')));
});

// =====================================================================
console.log('\n[parseSvelteParts]');
// =====================================================================

test('extracts script, template, style', () => {
  const src = '<script>let x = 1</script>\n<div>hello</div>\n<style>div { color: red; }</style>';
  const parts = parseSvelteParts(src);
  eq(parts.script, 'let x = 1');
  truthy(parts.template.includes('<div>hello</div>'));
  eq(parts.style, 'div { color: red; }');
});

test('handles missing script', () => {
  const src = '<div>hello</div><style>div{}</style>';
  const parts = parseSvelteParts(src);
  eq(parts.script, '');
  truthy(parts.template.includes('<div>'));
});

test('handles missing style', () => {
  const src = '<script>let x</script><div>hi</div>';
  const parts = parseSvelteParts(src);
  eq(parts.style, '');
  eq(parts.script, 'let x');
});

test('handles null input', () => {
  eq(parseSvelteParts(null), { script: '', template: '', style: '' });
});

// =====================================================================
console.log('\n[extractJson]');
// =====================================================================

test('parses clean JSON object', () => {
  eq(extractJson('{"a":1}'), { a: 1 });
});
test('parses fenced JSON', () => {
  eq(extractJson('```json\n{"a":2}\n```'), { a: 2 });
});
test('parses JSON embedded in prose', () => {
  eq(extractJson('Here is the result: {"score": 7} thanks!'), { score: 7 });
});
test('returns null on garbage', () => {
  eq(extractJson('not json at all'), null);
});

// =====================================================================
console.log('\n[clamp01_10]');
// =====================================================================

test('passes through valid range', () => {
  eq(clamp01_10(5), 5);
  eq(clamp01_10(0), 0);
  eq(clamp01_10(10), 10);
});
test('clamps high', () => {
  eq(clamp01_10(15), 10);
  eq(clamp01_10(100), 10);
});
test('clamps low', () => {
  eq(clamp01_10(-5), 0);
});
test('returns null for null/undefined', () => {
  eq(clamp01_10(null), null);
  eq(clamp01_10(undefined), null);
});
test('returns null for NaN', () => {
  eq(clamp01_10(NaN), null);
});
test('parses numeric strings', () => {
  eq(clamp01_10('7'), 7);
});

// =====================================================================
console.log('\n[parseDecomposeJson]');
// =====================================================================

const SAMPLE_DECOMPOSE = JSON.stringify({
  width: 200,
  height: 60,
  layers: [
    { name: 'base', role: 'plate', css: 'background:#444;' },
    { name: 'glow', role: 'fx', css: 'opacity:.5;', animations: [
      { name: 'pulse', trigger: 'always', keyframes: '0%{opacity:.4}50%{opacity:1}', duration: '1.2s', iteration: 'infinite' }
    ]},
  ],
  states: [{ name: 'idle' }, { name: 'hover', overrides: { glow: 'opacity:1;' } }],
});

test('parses raw JSON', () => {
  const r = parseDecomposeJson(SAMPLE_DECOMPOSE);
  if (!r.data) throw new Error('expected data, got null. notes=' + r.parserNotes.join('|'));
  eq(r.data.layers.length, 2);
  eq(r.data.states.length, 2);
});

test('parses JSON inside ```json fence', () => {
  const wrapped = '```json\n' + SAMPLE_DECOMPOSE + '\n```';
  const r = parseDecomposeJson(wrapped);
  if (!r.data) throw new Error('expected data');
  eq(r.data.layers[0].name, 'base');
});

test('parses JSON with leading prose', () => {
  const wrapped = "Here is the decomposition:\n\n```json\n" + SAMPLE_DECOMPOSE + "\n```\n";
  const r = parseDecomposeJson(wrapped);
  if (!r.data) throw new Error('expected data');
  eq(r.data.layers.length, 2);
});

test('returns null on broken JSON', () => {
  const r = parseDecomposeJson('not json at all');
  eq(r.data, null);
});

test('rejects when layers array is missing', () => {
  const r = parseDecomposeJson('{"foo":1}');
  eq(r.data, null);
});

test('synthesizes default state if missing', () => {
  const r = parseDecomposeJson('{"layers":[{"name":"a","role":"plate","css":""}]}');
  if (!r.data) throw new Error('expected data');
  eq(r.data.states.length, 1);
  eq(r.data.states[0].name, 'idle');
});

test('drops invalid layers but keeps valid ones', () => {
  const r = parseDecomposeJson('{"layers":[{"name":"a","role":"plate"},{"role":"fx"},{"name":"b","role":"frame"}]}');
  if (!r.data) throw new Error('expected data');
  eq(r.data.layers.length, 2);
  eq(r.data.layers.map(l => l.name), ['a', 'b']);
});

// =====================================================================
console.log('\n[compileLayersToSvelte]');
// =====================================================================

test('emits svelte + html + css', () => {
  const r = parseDecomposeJson(SAMPLE_DECOMPOSE);
  const compiled = compileLayersToSvelte(r.data);
  if (!compiled.svelte.includes('<style>')) throw new Error('svelte missing <style>');
  if (!compiled.html.includes('<!doctype html>')) throw new Error('html missing doctype');
  if (!compiled.css.includes('.layer-base')) throw new Error('css missing .layer-base');
  if (!compiled.css.includes('.layer-glow')) throw new Error('css missing .layer-glow');
});

test('emits @keyframes for animations', () => {
  const r = parseDecomposeJson(SAMPLE_DECOMPOSE);
  const css = compileLayersToCss(r.data);
  if (!css.includes('@keyframes pulse')) throw new Error('missing @keyframes pulse');
  if (!css.includes('animation: pulse')) throw new Error('missing animation declaration');
});

test('emits state override rules', () => {
  const r = parseDecomposeJson(SAMPLE_DECOMPOSE);
  const css = compileLayersToCss(r.data);
  if (!css.includes('.state-hover .layer-glow')) throw new Error('missing hover override');
});

test('emits isolate rules per layer', () => {
  const r = parseDecomposeJson(SAMPLE_DECOMPOSE);
  const css = compileLayersToCss(r.data);
  if (!css.includes('[data-isolate]:not([data-isolate="base"])')) throw new Error('missing isolate rule');
});

test('compiled markup uses state class', () => {
  const r = parseDecomposeJson(SAMPLE_DECOMPOSE);
  const compiled = compileLayersToSvelte(r.data, { state: 'press' });
  if (!compiled.html.includes('class="button-root state-press"')) throw new Error('html missing state-press');
});

test('isolate option emits data-isolate attribute', () => {
  const r = parseDecomposeJson(SAMPLE_DECOMPOSE);
  const compiled = compileLayersToSvelte(r.data, { isolate: 'glow' });
  if (!compiled.html.includes('data-isolate="glow"')) throw new Error('missing data-isolate attr');
});

// =====================================================================
// Final report
// =====================================================================
console.log();
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  ✗ ${f.name}`);
    console.log(`    ${f.error.message}`);
  }
  process.exit(1);
}
console.log('✓ all tests green');
process.exit(0);
