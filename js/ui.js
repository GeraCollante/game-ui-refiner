/**
 * UI layer: DOM helpers, tabs, panes, chart, history, ticker, save, log,
 * dropdowns, prompt panel, etc. Everything that touches the DOM beyond
 * the screenshot/render helpers in api.ts.
 */
import { currentProvider, getModels, OPTIONS_BY_PROVIDER, PRESETS_BY_PROVIDER, PRESET_LABELS, DIM_COLORS, } from './config.js';
import { state, MAX_LOG_ENTRIES, MAX_HISTORY_THUMBS } from './state.js';
import { parseSvelteParts, clamp01_10 } from './parser.js';
// =====================================================================
// Generic DOM helpers
// =====================================================================
export const $ = (id) => document.getElementById(id);
export function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
export function setStatus(msg) {
    $('status').textContent = msg;
}
export function setLoading(on, text = 'querying...') {
    $('loadingText').textContent = text;
    $('loadingOverlay').classList.toggle('hidden', !on);
}
// =====================================================================
// Time formatting + meters + ticker
// =====================================================================
export function fmtElapsed(seconds) {
    if (seconds < 60)
        return `${seconds.toFixed(1)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${String(s).padStart(2, '0')}s`;
}
export function updateMeters() {
    $('costTotal').textContent = `$${state.totalCost.toFixed(4)}`;
    if (state.runStartTime == null) {
        $('timeTotal').textContent = fmtElapsed(state.totalTime);
    }
}
export function startTicker() {
    state.runStartTime = performance.now();
    if (state.tickerInterval)
        clearInterval(state.tickerInterval);
    const tick = () => {
        if (state.runStartTime == null)
            return;
        const elapsed = (performance.now() - state.runStartTime) / 1000;
        $('timeTotal').textContent = fmtElapsed(elapsed) + ' ⏱';
    };
    tick();
    state.tickerInterval = setInterval(tick, 200);
}
export function stopTicker() {
    if (state.tickerInterval) {
        clearInterval(state.tickerInterval);
        state.tickerInterval = null;
    }
    if (state.runStartTime != null) {
        const finalElapsed = (performance.now() - state.runStartTime) / 1000;
        state.runStartTime = null;
        $('timeTotal').textContent = fmtElapsed(finalElapsed);
    }
}
// =====================================================================
// Logging
// =====================================================================
const LOG_COLORS = {
    info: 'text-neutral-400',
    call: 'text-blue-400',
    ok: 'text-green-400',
    err: 'text-red-400',
    warn: 'text-yellow-400',
};
export function log(level, msg, details = {}) {
    const entry = { ts: new Date().toISOString().slice(11, 23), level, msg, ...details };
    state.logs.push(entry);
    if (state.logs.length > MAX_LOG_ENTRIES) {
        state.logs.splice(0, state.logs.length - MAX_LOG_ENTRIES);
    }
    const div = document.createElement('div');
    div.className = (LOG_COLORS[level] || 'text-neutral-400') + ' leading-tight';
    let line = `<span class="text-neutral-600">${entry.ts}</span> [${level.toUpperCase()}] ${escapeHtml(msg)}`;
    if (details.model)
        line += ` <span class="text-neutral-500">(${details.model})</span>`;
    if (details.dt != null)
        line += ` <span class="text-neutral-500">${details.dt.toFixed(2)}s</span>`;
    if (details.cost != null)
        line += ` <span class="text-amber-400">$${details.cost.toFixed(5)}</span>`;
    if (details.tokens)
        line += ` <span class="text-neutral-500">${details.tokens.in}→${details.tokens.out}tk</span>`;
    div.innerHTML = line;
    const pane = $('paneLogs');
    pane.appendChild(div);
    while (pane.childNodes.length > MAX_LOG_ENTRIES)
        pane.removeChild(pane.firstChild);
    pane.scrollTop = pane.scrollHeight;
}
// =====================================================================
// Tabs
// =====================================================================
export function setTab(name) {
    state.activeTab = name;
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        const el = btn;
        const active = el.dataset.tab === name;
        el.classList.toggle('text-amber-400', active);
        el.classList.toggle('bg-neutral-800/60', active);
        el.classList.toggle('text-neutral-400', !active);
    });
    document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.add('hidden'));
    $('pane' + name.charAt(0).toUpperCase() + name.slice(1)).classList.remove('hidden');
    $('copyBtn').classList.toggle('hidden', !['svelte', 'css', 'js', 'html', 'prompts'].includes(name));
    $('downloadLogs').classList.toggle('hidden', name !== 'logs');
    if (name === 'prompts' && state.promptsDirty) {
        refreshPromptsPane(true);
    }
}
// =====================================================================
// Code panes (Svelte / CSS / JS / HTML)
// =====================================================================
export function updateCodePanes(svelte, html) {
    const parts = parseSvelteParts(svelte);
    state.currentCss = parts.style;
    state.currentJs = parts.script;
    $('paneSvelte').textContent = svelte || '— vacío —';
    $('paneHtml').textContent = html || '— vacío —';
    $('paneCss').textContent = state.currentCss || '— sin <style> en el svelte —';
    $('paneJs').textContent = state.currentJs || '— sin <script> en el svelte —';
}
// =====================================================================
// Prompts pane (lazy DOM rebuild — only when activeTab === 'prompts')
// =====================================================================
function buildMessagesDom(messages, container) {
    if (!messages) {
        const e = document.createElement('div');
        e.className = 'text-neutral-600';
        e.textContent = '— vacío —';
        container.appendChild(e);
        return;
    }
    for (const msg of messages) {
        const head = document.createElement('div');
        head.className = 'text-amber-500 mt-2 mb-1';
        head.textContent = `── role: ${msg.role} ──`;
        container.appendChild(head);
        const parts = Array.isArray(msg.content)
            ? msg.content
            : [{ type: 'text', text: msg.content || '' }];
        for (const part of parts) {
            if (part.type === 'text') {
                const t = document.createElement('div');
                t.className = 'whitespace-pre-wrap text-neutral-300';
                t.textContent = part.text;
                container.appendChild(t);
            }
            else if (part.type === 'image_url') {
                const url = part.image_url?.url || '';
                const mime = (url.match(/data:([^;]+)/) || [])[1] || '?';
                const sizeKb = ((url.length * 0.75) / 1024).toFixed(1);
                const wrap = document.createElement('div');
                wrap.className = 'my-1 inline-block align-top mr-2';
                const label = document.createElement('div');
                label.className = 'text-blue-400 text-[9px]';
                label.textContent = `[IMAGE ${mime} ~${sizeKb}KB] (click para abrir en tab nuevo)`;
                const img = document.createElement('img');
                img.src = url;
                img.className = 'max-h-32 max-w-xs border border-neutral-800 rounded mt-1 cursor-pointer';
                img.title = 'click para abrir en tab nuevo';
                img.addEventListener('click', () => window.open(url, '_blank'));
                wrap.appendChild(label);
                wrap.appendChild(img);
                container.appendChild(wrap);
            }
        }
    }
}
function buildSection(title, color, messages, rawResponse) {
    const sec = document.createElement('div');
    sec.className = 'mb-4 pb-3 border-b border-neutral-800';
    const h = document.createElement('div');
    h.className = `text-xs font-bold ${color} mb-2`;
    h.textContent = title;
    sec.appendChild(h);
    const promptHead = document.createElement('div');
    promptHead.className = 'text-neutral-500 mb-1';
    promptHead.textContent = '▼ INPUT (system + user)';
    sec.appendChild(promptHead);
    const promptBody = document.createElement('div');
    promptBody.className = 'pl-2 border-l-2 border-neutral-800';
    buildMessagesDom(messages, promptBody);
    sec.appendChild(promptBody);
    const respHead = document.createElement('div');
    respHead.className = 'text-neutral-500 mt-3 mb-1';
    respHead.textContent = '▼ OUTPUT (raw response)';
    sec.appendChild(respHead);
    const respBody = document.createElement('pre');
    respBody.className = 'pl-2 border-l-2 border-green-900 text-green-300 whitespace-pre-wrap text-[10px]';
    respBody.textContent = rawResponse || '— sin respuesta todavía —';
    sec.appendChild(respBody);
    return sec;
}
export function refreshPromptsPane(force = false) {
    // Lazy: only build the DOM (which contains heavy <img> base64 elements)
    // when the user is actually viewing the Prompts tab, OR when forced.
    if (!force && state.activeTab !== 'prompts') {
        state.promptsDirty = true;
        return;
    }
    state.promptsDirty = false;
    const pane = $('panePrompts');
    pane.innerHTML = '';
    if (!state.lastPrompts.generator && !state.lastPrompts.critic) {
        pane.textContent = '— sin prompts todavía —';
        return;
    }
    if (state.lastPrompts.generator || state.lastResponses.generator) {
        pane.appendChild(buildSection('████████ GENERATOR ████████', 'text-purple-400', state.lastPrompts.generator, state.lastResponses.generator));
    }
    if (state.lastPrompts.critic || state.lastResponses.critic) {
        pane.appendChild(buildSection('████████ CRITIC ████████', 'text-cyan-400', state.lastPrompts.critic, state.lastResponses.critic));
    }
}
// =====================================================================
// Score chart (inline SVG)
// =====================================================================
export function drawChart() {
    const svg = $('scoreChart');
    svg.innerHTML = '';
    const n = state.scoreHistory.length;
    $('chartHint').textContent = n ? `${n} epoch${n > 1 ? 's' : ''}` : '';
    if (n === 0) {
        svg.insertAdjacentHTML('beforeend', `<text x="160" y="90" fill="#525252" font-size="11" text-anchor="middle">esperando datos...</text>`);
        return;
    }
    const W = 320, H = 180;
    const PAD_L = 22, PAD_R = 60, PAD_T = 8, PAD_B = 22;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;
    const stepX = n > 1 ? plotW / (n - 1) : 0;
    const yFor = (v) => PAD_T + plotH - (v / 10) * plotH;
    const xFor = (i) => PAD_L + (n > 1 ? i * stepX : plotW / 2);
    // Y axis grid + labels
    for (let g = 0; g <= 10; g += 2) {
        const y = yFor(g);
        svg.insertAdjacentHTML('beforeend', `<line x1="${PAD_L}" y1="${y}" x2="${PAD_L + plotW}" y2="${y}" stroke="#262626" stroke-width="0.5" />`);
        svg.insertAdjacentHTML('beforeend', `<text x="${PAD_L - 4}" y="${y + 3}" fill="#737373" font-size="9" text-anchor="end" font-family="monospace">${g}</text>`);
    }
    // X axis baseline + labels
    svg.insertAdjacentHTML('beforeend', `<line x1="${PAD_L}" y1="${PAD_T + plotH}" x2="${PAD_L + plotW}" y2="${PAD_T + plotH}" stroke="#404040" stroke-width="0.8" />`);
    for (let i = 0; i < n; i++) {
        svg.insertAdjacentHTML('beforeend', `<text x="${xFor(i)}" y="${H - 8}" fill="#737373" font-size="9" text-anchor="middle" font-family="monospace">e${i + 1}</text>`);
    }
    // Plot each dimension
    let legendIdx = 0;
    for (const [dim, info] of Object.entries(DIM_COLORS)) {
        const color = info.c;
        const segs = [];
        let cur = [];
        let lastValid = null;
        state.scoreHistory.forEach((s, i) => {
            const v = clamp01_10(s.scores?.[dim]);
            if (v == null) {
                if (cur.length) {
                    segs.push(cur);
                    cur = [];
                }
                return;
            }
            lastValid = v;
            cur.push(`${xFor(i)},${yFor(v)}`);
        });
        if (cur.length)
            segs.push(cur);
        for (const seg of segs) {
            if (seg.length >= 2) {
                svg.insertAdjacentHTML('beforeend', `<polyline points="${seg.join(' ')}" fill="none" stroke="${color}" stroke-width="1.8" />`);
            }
        }
        state.scoreHistory.forEach((s, i) => {
            const v = clamp01_10(s.scores?.[dim]);
            if (v == null)
                return;
            svg.insertAdjacentHTML('beforeend', `<circle cx="${xFor(i)}" cy="${yFor(v)}" r="2.5" fill="${color}"><title>${dim} epoch ${i + 1}: ${v.toFixed(1)}</title></circle>`);
        });
        const legendY = PAD_T + 4 + legendIdx * 12;
        const valTxt = lastValid == null ? '—' : lastValid.toFixed(1);
        svg.insertAdjacentHTML('beforeend', `<rect x="${PAD_L + plotW + 6}" y="${legendY}" width="6" height="6" fill="${color}" />`);
        svg.insertAdjacentHTML('beforeend', `<text x="${PAD_L + plotW + 16}" y="${legendY + 6}" fill="#a3a3a3" font-size="9" font-family="monospace">${info.short} <tspan fill="${color}" font-weight="bold">${valTxt}</tspan></text>`);
        legendIdx++;
    }
    // Overall line (white dashed)
    const overallSeg = state.scoreHistory
        .map((s, i) => {
        const v = clamp01_10(s.overall);
        return v == null ? null : `${xFor(i)},${yFor(v)}`;
    })
        .filter(Boolean);
    if (overallSeg.length >= 2) {
        svg.insertAdjacentHTML('beforeend', `<polyline points="${overallSeg.join(' ')}" fill="none" stroke="#fafafa" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.7" />`);
    }
    if (overallSeg.length >= 1) {
        const lastOverall = clamp01_10(state.scoreHistory[state.scoreHistory.length - 1].overall);
        if (lastOverall != null) {
            const legendY = PAD_T + 4 + legendIdx * 12;
            svg.insertAdjacentHTML('beforeend', `<line x1="${PAD_L + plotW + 6}" y1="${legendY + 3}" x2="${PAD_L + plotW + 12}" y2="${legendY + 3}" stroke="#fafafa" stroke-width="1.5" stroke-dasharray="2,1" />`);
            svg.insertAdjacentHTML('beforeend', `<text x="${PAD_L + plotW + 16}" y="${legendY + 6}" fill="#a3a3a3" font-size="9" font-family="monospace">overall <tspan fill="#fafafa" font-weight="bold">${lastOverall.toFixed(1)}</tspan></text>`);
        }
    }
}
// =====================================================================
// History strip
// =====================================================================
export function addHistoryThumb(epoch, dataUrl, html, svelte, critique) {
    const card = document.createElement('div');
    const label = typeof epoch === 'number' ? `e${epoch}` : String(epoch);
    const isHuman = String(epoch).startsWith('👤');
    card.className = `flex-shrink-0 w-28 bg-neutral-950 border ${isHuman ? 'border-purple-700' : 'border-neutral-800'} rounded overflow-hidden cursor-pointer hover:border-amber-500 transition`;
    const overall = critique?.overall != null ? Number(critique.overall).toFixed(1) : '—';
    card.innerHTML = `
    <div class="text-[9px] text-neutral-500 px-1.5 py-0.5 border-b border-neutral-800 flex justify-between">
      <span class="${isHuman ? 'text-purple-300' : ''}">${label}</span>
      <span class="text-amber-400">${(html.length / 1024).toFixed(1)}kb</span>
      <span class="text-blue-400">⭐${overall}</span>
    </div>
    <div class="h-16 bg-white flex items-center justify-center overflow-hidden">
      ${dataUrl ? `<img src="${dataUrl}" class="max-w-full max-h-full" />` : '<span class="text-neutral-400 text-[10px]">no preview</span>'}
    </div>
  `;
    card.addEventListener('click', () => {
        state.currentCode = html;
        state.currentSvelte = svelte;
        document.getElementById('preview').srcdoc = html;
        updateCodePanes(svelte, html);
        if (critique) {
            $('paneCritique').textContent = JSON.stringify(critique, null, 2);
            $('critiqueOverall').textContent = critique.overall != null ? `overall: ${critique.overall}` : '';
        }
    });
    const historyEl = $('history');
    historyEl.appendChild(card);
    while (historyEl.childNodes.length > MAX_HISTORY_THUMBS)
        historyEl.removeChild(historyEl.firstChild);
    historyEl.scrollLeft = historyEl.scrollWidth;
}
// =====================================================================
// Dropdowns and presets
// =====================================================================
export function populateDropdown(selectId, options) {
    const sel = $(selectId);
    sel.innerHTML = '';
    const models = getModels();
    for (const id of options) {
        const m = models[id];
        if (!m)
            continue;
        const opt = document.createElement('option');
        opt.value = id;
        const priceLabel = m.out === 0 ? 'free' : `$${m.out}/M out`;
        opt.textContent = `${m.label} (${priceLabel})`;
        sel.appendChild(opt);
    }
}
export function populatePresetDropdown() {
    const sel = $('preset');
    sel.innerHTML = '';
    const presets = PRESETS_BY_PROVIDER[currentProvider()];
    for (const key of Object.keys(presets)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = PRESET_LABELS[key] || key;
        sel.appendChild(opt);
    }
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = '🔧 Custom';
    sel.appendChild(customOpt);
}
export function refreshProviderUI() {
    const p = currentProvider();
    $('googleKey').classList.toggle('hidden', p !== 'google');
    $('apiKey').classList.toggle('hidden', p !== 'openrouter');
    const opts = OPTIONS_BY_PROVIDER[p];
    populateDropdown('criticModel', opts.critic);
    populateDropdown('genModel', opts.gen);
    populatePresetDropdown();
    const presetKey = `preset_${p}`;
    $('preset').value = localStorage.getItem(presetKey) || 'smart';
    applyPreset($('preset').value);
}
export function applyPreset(name) {
    if (name === 'custom')
        return;
    const p = PRESETS_BY_PROVIDER[currentProvider()][name];
    if (!p)
        return;
    $('criticModel').value = p.critic;
    $('genModel').value = p.gen;
    localStorage.setItem(`preset_${currentProvider()}`, name);
}
// =====================================================================
// Reset (called by main loop on Start)
// =====================================================================
export function resetMeters() {
    state.totalCost = 0;
    state.totalTime = 0;
    state.scoreHistory = [];
    state.logs = [];
    state.currentCss = '';
    state.currentJs = '';
    state.humanEpochCount = 0;
    state.lastPrompts = { generator: null, critic: null };
    state.lastResponses = { generator: '', critic: '' };
    updateMeters();
    drawChart();
    $('paneCritique').textContent = 'esperando primer epoch...';
    $('paneSvelte').textContent = '— sin código todavía —';
    $('paneCss').textContent = '— sin CSS todavía —';
    $('paneJs').textContent = '— sin JS todavía —';
    $('paneHtml').textContent = '— sin código todavía —';
    $('panePrompts').textContent = '— sin prompts todavía —';
    $('paneLogs').innerHTML = '';
    $('critiqueOverall').textContent = '';
}
// =====================================================================
// Save to disk via /save endpoint of serve.py
// =====================================================================
export function makeSessionId() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const rand = Math.random().toString(36).slice(2, 6);
    return `${stamp}_${rand}`;
}
export async function saveToServer(filename, body) {
    if (!state.currentSession)
        return null;
    if (!$('saveToggle').checked)
        return null;
    try {
        const res = await fetch('/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session: state.currentSession, filename, ...body }),
        });
        const j = await res.json();
        if (!j.ok) {
            log('warn', `save fail: ${j.error}`, {});
            return null;
        }
        return j.path;
    }
    catch (e) {
        log('warn', `save fail (server unreachable?): ${e.message}`, {});
        return null;
    }
}
export async function saveImage(filename, dataUrl) {
    if (!dataUrl)
        return null;
    const m = dataUrl.match(/^data:[^;]+;base64,(.*)$/);
    if (!m)
        return null;
    return saveToServer(filename, { data_base64: m[1] });
}
export async function saveText(filename, text) {
    return saveToServer(filename, { text: text || '' });
}
export function startSession() {
    state.currentSession = makeSessionId();
    $('sessionPath').textContent = `runs/${state.currentSession}/`;
    $('sessionPath').title = `runs/${state.currentSession}/`;
    $('sessionPanel').classList.remove('hidden');
    log('info', `📁 nueva sesión: runs/${state.currentSession}/`);
}
