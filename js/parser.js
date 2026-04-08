/**
 * Pure parsing functions — no DOM, no state, no globals.
 *
 * These are the most testable parts of the codebase. They handle the messy
 * job of extracting structured content (Svelte components, HTML previews,
 * critique JSON) from raw LLM responses that may include reasoning preamble,
 * indented markdown fences, missing language tags, and truncation.
 */
/**
 * Strip a single markdown code fence from `text`.
 * Returns the inner content if a fence is found, else the original trimmed text.
 */
export function stripFences(text) {
    let t = text.trim();
    const m = t.match(/```(?:html|json|svelte)?\s*\n?([\s\S]*?)```/);
    if (m)
        t = m[1].trim();
    return t;
}
/**
 * Strip the leading whitespace common to every non-empty line.
 * Handles models that emit fenced blocks inside indented markdown lists.
 */
export function dedentCommon(text) {
    const lines = text.split('\n');
    let minIndent = Infinity;
    for (const line of lines) {
        if (!line.trim())
            continue;
        const m = line.match(/^[ \t]*/);
        if (m)
            minIndent = Math.min(minIndent, m[0].length);
    }
    if (minIndent === 0 || minIndent === Infinity)
        return text;
    return lines.map((l) => l.slice(minIndent)).join('\n');
}
/**
 * Find ALL fenced code blocks in `text` with their language label (if any).
 * Tolerates indented fences (any leading whitespace on the opening fence).
 */
export function extractAllFences(text) {
    const out = [];
    const re = /(^|\n)[ \t]*```([a-zA-Z0-9_+-]*)[ \t]*\n([\s\S]*?)\n[ \t]*```/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        out.push({ lang: (m[2] || '').toLowerCase(), body: dedentCommon(m[3]) });
    }
    return out;
}
/**
 * Strip leading prose lines (markdown headers, list items, "Step 1:" style)
 * until we hit something that looks like code.
 */
function stripLeadingProse(s) {
    if (!s)
        return s;
    const lines = s.split('\n');
    let i = 0;
    while (i < lines.length) {
        const l = lines[i].trim();
        if (!l) {
            i++;
            continue;
        }
        if (/^(#|\d+\.|\*|-|>|`)/.test(l)) {
            i++;
            continue;
        }
        if (/^[A-Za-z][^<\n]{0,80}:$/.test(l)) {
            i++;
            continue;
        }
        break;
    }
    return lines.slice(i).join('\n').trim();
}
/**
 * Parse the generator's dual output (Svelte component + HTML preview).
 *
 * Three strategies in cascade:
 *   1. Explicit ```svelte and ```html fences anywhere in the text
 *   2. Unlabeled fences disambiguated by content sniffing
 *   3. No fences at all — try the raw text
 *
 * If only one of the pair is found, the other is synthesized from it.
 */
export function parseDualOutput(text) {
    if (!text)
        return { svelte: null, html: null, parserNotes: ['empty input'] };
    const notes = [];
    // Strategy 1: explicit fenced blocks
    const fences = extractAllFences(text);
    let svelte = null;
    let html = null;
    for (const f of fences) {
        if (!svelte && (f.lang === 'svelte' || f.lang === 'svlt'))
            svelte = f.body.trim();
        if (!html && (f.lang === 'html' || f.lang === 'htm'))
            html = f.body.trim();
    }
    if (svelte || html) {
        notes.push(`fenced: svelte=${!!svelte} html=${!!html} (total fences: ${fences.length})`);
    }
    // Strategy 2: unlabeled fences disambiguated by content
    if ((!svelte || !html) && fences.length) {
        for (const f of fences) {
            if (f.lang)
                continue;
            const body = f.body.trim();
            if (!html && /<!doctype|<html[\s>]/i.test(body)) {
                html = body;
                notes.push('html: matched unlabeled fence by <!doctype/<html>');
            }
            else if (!svelte && /<script[\s>][\s\S]*<\/script>|<style[\s>][\s\S]*<\/style>/i.test(body)) {
                svelte = body;
                notes.push('svelte: matched unlabeled fence by <script>/<style>');
            }
        }
    }
    // Strategy 3: no fences — try raw text
    if (!svelte && !html && !fences.length) {
        const trimmed = text.trim();
        if (/<!doctype|<html[\s>]/i.test(trimmed)) {
            html = trimmed;
            notes.push('html: raw text starts with <!doctype/<html>');
        }
        else if (/<script[\s>][\s\S]*<\/script>|<style[\s>][\s\S]*<\/style>|<div[\s>]/i.test(trimmed)) {
            svelte = trimmed;
            notes.push('svelte: raw text contains <script>/<style>/<div>');
        }
        else {
            notes.push('FAIL: no fences, no html, no svelte detected in raw');
        }
    }
    // Sanitize: strip leading prose noise from each captured block
    if (svelte)
        svelte = stripLeadingProse(svelte);
    if (html)
        html = stripLeadingProse(html);
    // Synthesize the missing pair from whichever side we have
    if (svelte && !html) {
        const styleMatch = svelte.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        const styleBlock = styleMatch ? styleMatch[1] : '';
        const noStyleNoScript = svelte
            .replace(/<style[^>]*>[\s\S]*?<\/style>/i, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/i, '');
        html = `<!doctype html><html><head><meta charset="utf-8"><style>${styleBlock}</style></head><body>${noStyleNoScript}</body></html>`;
        notes.push('html: synthesized from svelte');
    }
    if (html && !svelte) {
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        svelte = `${bodyMatch ? bodyMatch[1].trim() : html}\n\n<style>\n${styleMatch ? styleMatch[1].trim() : ''}\n</style>`;
        notes.push('svelte: synthesized from html');
    }
    // Truncation hints (the response was likely cut off by max_tokens)
    if (svelte && !/<\/style>\s*$|<\/script>\s*$|<\/div>\s*$/i.test(svelte.trim())) {
        notes.push('⚠️ svelte parece truncado (no termina en <\/style>/<\/script>/<\/div>)');
    }
    if (html && !/<\/html>\s*$|<\/body>\s*$/i.test(html.trim())) {
        notes.push('⚠️ html parece truncado (no termina en <\/html>/<\/body>)');
    }
    return { svelte, html, parserNotes: notes };
}
/**
 * Extract the three parts of a Svelte component file.
 * If a part is missing, returns an empty string for it.
 */
export function parseSvelteParts(src) {
    if (!src)
        return { script: '', template: '', style: '' };
    const scriptMatch = src.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const template = src
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .trim();
    return {
        script: scriptMatch ? scriptMatch[1].trim() : '',
        template,
        style: styleMatch ? styleMatch[1].trim() : '',
    };
}
/**
 * Best-effort JSON extraction. Tries direct parse, fenced parse,
 * and a fallback regex match for the first {...} block.
 */
export function extractJson(text) {
    try {
        return JSON.parse(text);
    }
    catch { /* ignore */ }
    const stripped = stripFences(text);
    try {
        return JSON.parse(stripped);
    }
    catch { /* ignore */ }
    const m = stripped.match(/\{[\s\S]*\}/);
    if (m) {
        try {
            return JSON.parse(m[0]);
        }
        catch { /* ignore */ }
    }
    return null;
}
/**
 * Parse a decompose-mode generator response into a validated `DecomposeOutput`.
 *
 * Strategies in cascade (mirror parseDualOutput):
 *   1. Direct JSON.parse on the raw text
 *   2. ```json fence
 *   3. Any unlabeled fence whose body parses
 *   4. Greedy {…} regex fallback
 *
 * Then validates the minimum shape: `layers` array, each with `name` + `role`.
 * If `states` is missing, synthesizes `[{name:'idle'}]`.
 */
export function parseDecomposeJson(text) {
    if (!text)
        return { data: null, parserNotes: ['empty input'] };
    const notes = [];
    let raw = null;
    // 1. raw
    try {
        raw = JSON.parse(text.trim());
        notes.push('decompose: raw JSON.parse OK');
    }
    catch { /* */ }
    // 2. fences
    if (!raw) {
        const fences = extractAllFences(text);
        for (const f of fences) {
            if (raw)
                break;
            if (f.lang === 'json' || !f.lang) {
                try {
                    raw = JSON.parse(f.body.trim());
                    notes.push(`decompose: parsed from ${f.lang || 'unlabeled'} fence`);
                }
                catch { /* try next */ }
            }
        }
    }
    // 3. greedy {…} fallback
    if (!raw) {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
            try {
                raw = JSON.parse(m[0]);
                notes.push('decompose: greedy {…} fallback parsed');
            }
            catch { /* */ }
        }
    }
    if (!raw || typeof raw !== 'object') {
        notes.push('FAIL: no parseable JSON found');
        return { data: null, parserNotes: notes };
    }
    if (!Array.isArray(raw.layers) || raw.layers.length === 0) {
        notes.push('FAIL: missing or empty `layers` array');
        return { data: null, parserNotes: notes };
    }
    // Validate every layer has name + role
    const layers = [];
    for (let i = 0; i < raw.layers.length; i++) {
        const l = raw.layers[i];
        if (!l || typeof l !== 'object') {
            notes.push(`⚠️ layer[${i}] not an object — skipped`);
            continue;
        }
        if (!l.name || typeof l.name !== 'string') {
            notes.push(`⚠️ layer[${i}] missing name — skipped`);
            continue;
        }
        if (!l.role || typeof l.role !== 'string') {
            notes.push(`⚠️ layer[${i}] (${l.name}) missing role — defaulting to "content"`);
            l.role = 'content';
        }
        if (typeof l.css !== 'string')
            l.css = '';
        if (l.animations && !Array.isArray(l.animations)) {
            notes.push(`⚠️ layer[${l.name}].animations not an array — dropped`);
            delete l.animations;
        }
        layers.push(l);
    }
    if (layers.length === 0) {
        notes.push('FAIL: 0 valid layers after validation');
        return { data: null, parserNotes: notes };
    }
    let states = Array.isArray(raw.states) ? raw.states.filter((s) => s && s.name) : [];
    if (states.length === 0) {
        states = [{ name: 'idle' }];
        notes.push('decompose: synthesized default state "idle"');
    }
    const data = {
        layers,
        states,
        width: typeof raw.width === 'number' ? raw.width : undefined,
        height: typeof raw.height === 'number' ? raw.height : undefined,
    };
    notes.push(`decompose: ${layers.length} layers, ${states.length} states`);
    return { data, parserNotes: notes };
}
/** Clamp a value to [0, 10] for the score chart. Returns null on null/NaN. */
export function clamp01_10(v) {
    if (v == null || typeof v !== 'number' || isNaN(v)) {
        if (typeof v === 'string') {
            const n = Number(v);
            if (!isNaN(n))
                return Math.max(0, Math.min(10, n));
        }
        return null;
    }
    return Math.max(0, Math.min(10, v));
}
