/**
 * Decompose mode compiler — pure functions, no DOM.
 *
 * Takes a `DecomposeOutput` (layered button schema produced by the generator)
 * and emits two strings:
 *   - `svelte`: the deliverable .svelte component
 *   - `html`:   a standalone preview document for the iframe
 *
 * Both outputs are deterministic. Editing the JSON in the Layers tab and
 * recompiling does NOT call any LLM.
 */

import type { DecomposeOutput, DecomposeLayer, StateName } from './types.js';

const DEFAULT_W = 220;
const DEFAULT_H = 72;

/** Slugify a layer name for use as a CSS class — keep it simple. */
function slug(name: string): string {
  return String(name).toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'x';
}

/** Indent every line of `body` by 2 spaces (cosmetic for emitted CSS). */
function indent(body: string, n = 2): string {
  const pad = ' '.repeat(n);
  return body.split('\n').map((l) => (l.trim() ? pad + l.trim() : l)).join('\n');
}

/**
 * Compile a `DecomposeOutput` to a CSS string scoped under `.button-root`.
 * Pure: same input → same output.
 */
export function compileLayersToCss(d: DecomposeOutput): string {
  const W = d.width || DEFAULT_W;
  const H = d.height || DEFAULT_H;
  const lines: string[] = [];

  lines.push(`.button-root {`);
  lines.push(`  position: relative;`);
  lines.push(`  width: ${W}px;`);
  lines.push(`  height: ${H}px;`);
  lines.push(`  display: inline-block;`);
  lines.push(`}`);

  // Per-layer rules
  d.layers.forEach((layer, idx) => {
    const cls = slug(layer.name);
    lines.push(``);
    lines.push(`.button-root .layer-${cls} {`);
    lines.push(`  position: absolute;`);
    lines.push(`  inset: 0;`);
    lines.push(`  z-index: ${idx + 1};`);
    lines.push(`  pointer-events: none;`);
    if (layer.css && layer.css.trim()) {
      lines.push(indent(layer.css.trim(), 2));
    }
    // animations: emit `animation: name dur trigger?` only when trigger==='always'
    const alwaysAnims = (layer.animations || []).filter((a) => a.trigger === 'always');
    if (alwaysAnims.length) {
      const decl = alwaysAnims
        .map((a) => `${slug(a.name)} ${a.duration} ${a.iteration === 'infinite' ? 'infinite' : a.iteration} ease-in-out`)
        .join(', ');
      lines.push(`  animation: ${decl};`);
    }
    lines.push(`}`);

    // hover/press triggered animations: re-apply on the right state class
    for (const a of layer.animations || []) {
      if (a.trigger === 'hover') {
        lines.push(`.button-root.state-hover .layer-${cls} { animation: ${slug(a.name)} ${a.duration} ${a.iteration === 'infinite' ? 'infinite' : a.iteration} ease-in-out; }`);
      } else if (a.trigger === 'press') {
        lines.push(`.button-root.state-press .layer-${cls} { animation: ${slug(a.name)} ${a.duration} ${a.iteration === 'infinite' ? 'infinite' : a.iteration} ease-in-out; }`);
      }
    }

    // emit @keyframes once per animation
    for (const a of layer.animations || []) {
      lines.push(`@keyframes ${slug(a.name)} {`);
      lines.push(indent(a.keyframes.trim(), 2));
      lines.push(`}`);
    }
  });

  // State overrides
  for (const s of d.states) {
    if (!s.overrides) continue;
    for (const [layerName, body] of Object.entries(s.overrides)) {
      lines.push(``);
      lines.push(`.button-root.state-${s.name} .layer-${slug(layerName)} {`);
      lines.push(indent(String(body).trim(), 2));
      lines.push(`}`);
    }
  }

  // isolate-layer helper: when [data-isolate="X"] is set, hide every layer except .layer-X
  lines.push(``);
  for (const layer of d.layers) {
    const cls = slug(layer.name);
    lines.push(`.button-root[data-isolate]:not([data-isolate="${cls}"]) > .layer-${cls} { display: none; }`);
  }

  return lines.join('\n');
}

/** Compile the markup of a single layer (svg/text/empty). */
function compileLayerInner(layer: DecomposeLayer): string {
  if (layer.svg && layer.svg.trim()) return layer.svg.trim();
  if (layer.text != null) return escapeHtml(String(layer.text));
  return '';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c
  ));
}

/** Compile the layered <div> markup. */
export function compileLayersToMarkup(d: DecomposeOutput, state: StateName = 'idle', isolate: string | null = null): string {
  const isoAttr = isolate ? ` data-isolate="${slug(isolate)}"` : '';
  const inner = d.layers
    .map((layer) => `  <div class="layer-${slug(layer.name)}">${compileLayerInner(layer)}</div>`)
    .join('\n');
  return `<div class="button-root state-${state}"${isoAttr}>\n${inner}\n</div>`;
}

export interface CompiledDecompose {
  svelte: string;
  html: string;
  css: string;
}

/**
 * Top-level: compile a `DecomposeOutput` to a Svelte component + standalone HTML preview.
 *
 * The HTML preview centers the button in a neutral background and includes a
 * tiny JS shim that cycles `idle → hover → press → idle` on click so the
 * iframe screenshot can capture an actual rendered button.
 */
export function compileLayersToSvelte(
  d: DecomposeOutput,
  opts: { state?: StateName; isolate?: string | null } = {}
): CompiledDecompose {
  const css = compileLayersToCss(d);
  const state = opts.state || 'idle';
  const isolate = opts.isolate || null;
  const markup = compileLayersToMarkup(d, state, isolate);

  // Note: the closing script/style tags are split to avoid premature termination
  // when this module is bundled into an HTML <script> tag (caught by tools/check.mjs).
  const closeScript = '<\/script>';
  const closeStyle = '<\/style>';
  const svelte =
    `<script>\n  export let state = '${state}';\n` + closeScript + `\n\n` +
    markup.replace(`state-${state}`, `state-{state}`) +
    `\n\n<style>\n${css}\n` + closeStyle + `\n`;

  const html =
    `<!doctype html><html><head><meta charset="utf-8">\n` +
    `<style>\n` +
    `  html,body { margin:0; padding:0; height:100%; display:flex; align-items:center; justify-content:center; background:#0a0a0a; font-family: ui-sans-serif, system-ui, sans-serif; }\n` +
    css +
    `\n</style></head><body>\n` +
    markup +
    `\n</body></html>\n`;

  return { svelte, html, css };
}
