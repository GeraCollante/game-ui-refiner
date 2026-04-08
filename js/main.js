/**
 * Entry point: main loops, event listeners, init code.
 */
import { currentProvider, getCurrentApiKey, getModelInfo, DEFAULT_DECOMPOSE_GEN_PROMPT, DEFAULT_DECOMPOSE_CRITIC_PROMPT, } from './config.js';
import { state } from './state.js';
import { extractJson, parseDecomposeJson, parseDualOutput, stripFences } from './parser.js';
import { buildCriticMessages, buildFeedbackMessages, buildInitialDecomposeMessages, buildInitialGenMessages, buildRefineDecomposeMessages, buildRefineMessages, callModel, callModelForced, renderInIframe, screenshotIframe, } from './api.js';
import { compileLayersToSvelte } from './decompose.js';
import { $, addHistoryThumb, applyPreset, drawChart, exportAllToFile, log, refreshProviderUI, refreshPromptsPane, resetMeters, saveImage, saveText, setLoading, setStatus, setTab, startSession, startTicker, stopTicker, updateCodePanes, updateLayersPane, } from './ui.js';
// =====================================================================
// Cached element refs
// =====================================================================
const startBtn = $('startBtn');
const stopBtn = $('stopBtn');
const dropzone = $('dropzone');
const fileInput = $('fileInput');
const epochBadge = $('epochBadge');
// =====================================================================
// File / paste handling
// =====================================================================
function loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const url = e.target?.result;
        state.targetDataUrl = url;
        $('targetImg').src = url;
        $('targetBig').src = url;
        $('targetPreview').classList.remove('hidden');
        const img = new Image();
        img.onload = () => {
            $('targetMeta').textContent = `${img.width}×${img.height}`;
        };
        img.src = url;
    };
    reader.readAsDataURL(file);
}
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-amber-500');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('border-amber-500'));
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-amber-500');
    const file = e.dataTransfer?.files[0];
    if (file)
        loadFile(file);
});
fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file)
        loadFile(file);
});
window.addEventListener('paste', (e) => {
    if (!e.clipboardData)
        return;
    for (const item of e.clipboardData.items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file)
                loadFile(file);
            break;
        }
    }
});
// =====================================================================
// Tab buttons + copy + download
// =====================================================================
document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab || 'critique'));
});
$('copyBtn').addEventListener('click', () => {
    const map = {
        svelte: state.currentSvelte || '',
        css: state.currentCss || '',
        js: state.currentJs || '',
        html: state.currentCode || '',
        prompts: $('panePrompts').textContent || '',
    };
    const text = map[state.activeTab] || '';
    navigator.clipboard.writeText(text).then(() => {
        $('copyBtn').textContent = '✓';
        setTimeout(() => {
            $('copyBtn').textContent = 'copy';
        }, 1000);
    });
});
$('downloadLogs').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refiner-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
});
// =====================================================================
// Provider / preset / API key persistence
// =====================================================================
$('provider').value = localStorage.getItem('provider') || 'google';
$('apiKey').value =
    (typeof window !== 'undefined' && window.OPENROUTER_API_KEY) ||
        localStorage.getItem('orKey') ||
        '';
$('googleKey').value =
    (typeof window !== 'undefined' && (window.GEMINI_API_KEY || window.GOOGLE_API_KEY)) ||
        localStorage.getItem('googleKey') ||
        '';
if (typeof window !== 'undefined' && window.GEMINI_API_KEY) {
    console.log('[refiner] Gemini API key cargada desde .env');
}
refreshProviderUI();
$('provider').addEventListener('change', (e) => {
    localStorage.setItem('provider', e.target.value);
    refreshProviderUI();
});
$('apiKey').addEventListener('change', (e) => localStorage.setItem('orKey', e.target.value));
$('googleKey').addEventListener('change', (e) => localStorage.setItem('googleKey', e.target.value));
$('preset').addEventListener('change', (e) => applyPreset(e.target.value));
$('criticModel').addEventListener('change', () => {
    $('preset').value = 'custom';
});
$('genModel').addEventListener('change', () => {
    $('preset').value = 'custom';
});
// =====================================================================
// Mode toggle (holistic vs decompose)
// =====================================================================
function applyModeUI(mode) {
    state.mode = mode;
    document.body.dataset.mode = mode;
    // Decompose-only controls
    const decomposeOnly = document.querySelectorAll('[data-mode-only="decompose"]');
    decomposeOnly.forEach((el) => el.classList.toggle('hidden', mode !== 'decompose'));
    const holisticOnly = document.querySelectorAll('[data-mode-only="holistic"]');
    holisticOnly.forEach((el) => el.classList.toggle('hidden', mode !== 'holistic'));
    drawChart();
}
const modeToggle = $('modeToggle');
if (modeToggle) {
    modeToggle.value = localStorage.getItem('mode') || 'holistic';
    applyModeUI(modeToggle.value);
    modeToggle.addEventListener('change', (e) => {
        const m = e.target.value;
        localStorage.setItem('mode', m);
        applyModeUI(m);
    });
}
// =====================================================================
// Decompose: state selector / isolate / recompile (no LLM call)
// =====================================================================
function recompileFromState(opts = {}) {
    if (!state.currentDecompose)
        return;
    const compiled = compileLayersToSvelte(state.currentDecompose, opts);
    state.currentSvelte = compiled.svelte;
    state.currentCode = compiled.html;
    updateCodePanes(state.currentSvelte, state.currentCode);
    renderInIframe(state.currentCode);
}
function refreshIsolateOptions(d) {
    const sel = $('isolateLayer');
    if (!sel)
        return;
    sel.innerHTML = '<option value="">(none)</option>';
    for (const layer of d.layers) {
        const opt = document.createElement('option');
        opt.value = layer.name;
        opt.textContent = layer.name;
        sel.appendChild(opt);
    }
}
const stateSelector = $('stateSelector');
if (stateSelector) {
    stateSelector.addEventListener('change', () => {
        const isoSel = $('isolateLayer');
        recompileFromState({
            state: stateSelector.value,
            isolate: isoSel?.value || null,
        });
    });
}
const isolateSelector = $('isolateLayer');
if (isolateSelector) {
    isolateSelector.addEventListener('change', () => {
        const stSel = $('stateSelector');
        recompileFromState({
            state: stSel?.value || 'idle',
            isolate: isolateSelector.value || null,
        });
    });
}
const recompileBtn = $('recompileLayersBtn');
if (recompileBtn) {
    recompileBtn.addEventListener('click', () => {
        const ta = $('layersJsonEditor');
        if (!ta)
            return;
        try {
            const parsed = JSON.parse(ta.value);
            if (!Array.isArray(parsed.layers))
                throw new Error('layers[] missing');
            state.currentDecompose = parsed;
            refreshIsolateOptions(parsed);
            recompileFromState();
            log('ok', `🧩 recompiled (no LLM call) · ${parsed.layers.length} layers`);
        }
        catch (e) {
            log('err', `recompile failed: ${e.message}`);
            alert('JSON inválido: ' + e.message);
        }
    });
}
// Session copy button
const cs = $('copySession');
if (cs) {
    cs.addEventListener('click', () => {
        if (!state.currentSession)
            return;
        navigator.clipboard.writeText(`runs/${state.currentSession}/`).then(() => {
            cs.textContent = '✓';
            setTimeout(() => { cs.textContent = '📋'; }, 1000);
        });
    });
}
// =====================================================================
// Main loop: runRefinement
// =====================================================================
async function runRefinement() {
    const apiKey = getCurrentApiKey();
    const criticModel = $('criticModel').value;
    const genModel = $('genModel').value;
    const epochs = parseInt($('epochs').value, 10);
    const maxTokens = parseInt($('maxTokens').value, 10);
    const mode = state.mode;
    const sysPromptGen = mode === 'decompose'
        ? ($('sysPromptDecomposeGen')?.value || DEFAULT_DECOMPOSE_GEN_PROMPT)
        : $('sysPromptGen').value;
    const sysPromptCritic = mode === 'decompose'
        ? ($('sysPromptDecomposeCritic')?.value || DEFAULT_DECOMPOSE_CRITIC_PROMPT)
        : $('sysPromptCritic').value;
    const provider = currentProvider();
    if (!apiKey) {
        alert(`Falta la API key (${provider === 'google' ? 'Google AI Studio' : 'OpenRouter'})`);
        return;
    }
    if (!state.targetDataUrl) {
        alert('Falta la imagen target');
        return;
    }
    startBtn.disabled = true;
    stopBtn.disabled = false;
    $('feedbackBtn').disabled = true;
    state.stopRequested = false;
    $('history').innerHTML = '';
    state.currentCode = null;
    state.currentSvelte = null;
    resetMeters();
    startTicker();
    startSession();
    log('info', `▶ Run start · provider=${provider} · ${epochs} epochs · critic=${getModelInfo(criticModel)?.label} · gen=${getModelInfo(genModel)?.label}`);
    // Save the target image once
    if (state.targetDataUrl) {
        const ext = state.targetDataUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png';
        await saveImage(`target.${ext}`, state.targetDataUrl);
    }
    let lastCritique = null;
    let lastEpochScreenshot = null;
    try {
        for (let i = 0; i < epochs; i++) {
            if (state.stopRequested) {
                setStatus('Detenido');
                break;
            }
            const epochNum = i + 1;
            epochBadge.textContent = `epoch ${epochNum}/${epochs}`;
            epochBadge.classList.remove('hidden');
            // ============ STEP A: GENERATE ============
            let genMessages;
            if (i === 0) {
                setLoading(true, `[${epochNum}/${epochs}] Draft inicial ${mode === 'decompose' ? '(decompose) ' : ''}(${getModelInfo(genModel)?.label})...`);
                log('info', `epoch ${epochNum}: initial draft (mode=${mode})`);
                genMessages = mode === 'decompose'
                    ? buildInitialDecomposeMessages(sysPromptGen, state.targetDataUrl)
                    : buildInitialGenMessages(sysPromptGen, state.targetDataUrl);
            }
            else {
                setLoading(true, `[${epochNum}/${epochs}] Refinando ${mode === 'decompose' ? '(decompose) ' : ''}(${getModelInfo(genModel)?.label})...`);
                log('info', `epoch ${epochNum}: refine using last critique`);
                genMessages = mode === 'decompose'
                    ? buildRefineDecomposeMessages(sysPromptGen, state.targetDataUrl, lastEpochScreenshot, state.currentDecompose ? JSON.stringify(state.currentDecompose, null, 2) : '{}', lastCritique)
                    : buildRefineMessages(sysPromptGen, state.targetDataUrl, lastEpochScreenshot, state.currentSvelte || '', state.currentCode || '', lastCritique);
            }
            state.lastPrompts.generator = genMessages;
            state.lastResponses.generator = '— esperando respuesta... —';
            refreshPromptsPane();
            const genRes = await callModel(genModel, genMessages, apiKey, maxTokens, 'generator');
            state.lastResponses.generator = genRes.content;
            refreshPromptsPane();
            if (mode === 'decompose') {
                const parsedD = parseDecomposeJson(genRes.content);
                for (const note of parsedD.parserNotes || []) {
                    const level = note.startsWith('⚠️') || note.startsWith('FAIL') ? 'warn' : 'info';
                    log(level, `parser: ${note}`);
                }
                if (!parsedD.data) {
                    log('err', `decompose generator no devolvió JSON parseable`, { rawLen: genRes.content.length });
                    log('err', `RAW (primeros 400 chars): ${genRes.content.slice(0, 400)}`);
                    throw new Error('decompose parser falló — ver tab Logs');
                }
                state.currentDecompose = parsedD.data;
                const compiled = compileLayersToSvelte(parsedD.data);
                state.currentSvelte = compiled.svelte;
                state.currentCode = compiled.html;
                updateCodePanes(state.currentSvelte, state.currentCode);
                updateLayersPane(parsedD.data);
                refreshIsolateOptions(parsedD.data);
                $('renderMeta').textContent = `[decompose] ${parsedD.data.layers.length}L · ${parsedD.data.states.length}S · svelte ${(state.currentSvelte.length / 1024).toFixed(1)}kb · ${genRes.dt.toFixed(1)}s`;
            }
            else {
                const parsed = parseDualOutput(genRes.content);
                for (const note of parsed.parserNotes || []) {
                    const level = note.startsWith('⚠️') || note.startsWith('FAIL') ? 'warn' : 'info';
                    log(level, `parser: ${note}`);
                }
                if (!parsed.html)
                    log('err', `generator no devolvió HTML preview parseable`, { rawLen: genRes.content.length });
                if (!parsed.svelte)
                    log('err', `generator no devolvió svelte parseable`, { rawLen: genRes.content.length });
                if (!parsed.svelte && !parsed.html) {
                    log('err', `RAW (primeros 400 chars): ${genRes.content.slice(0, 400)}`);
                }
                state.currentCode = parsed.html || stripFences(genRes.content);
                state.currentSvelte = parsed.svelte || '';
                updateCodePanes(state.currentSvelte, state.currentCode);
                $('renderMeta').textContent = `svelte ${(state.currentSvelte.length / 1024).toFixed(1)}kb · html ${(state.currentCode.length / 1024).toFixed(1)}kb · css ${(state.currentCss.length / 1024).toFixed(1)}kb · js ${(state.currentJs.length / 1024).toFixed(1)}kb · ${genRes.dt.toFixed(1)}s`;
            }
            setLoading(false);
            await renderInIframe(state.currentCode);
            log('info', `iframe rendered`, { bytes: state.currentCode.length });
            // ============ STEP B: CRITIQUE (always, including epoch 1) ============
            setLoading(true, `[${epochNum}/${epochs}] Capturando render...`);
            lastEpochScreenshot = await screenshotIframe();
            if (!lastEpochScreenshot)
                log('warn', `screenshot vacío (iframe vacío?)`);
            setLoading(true, `[${epochNum}/${epochs}] Crítico (${getModelInfo(criticModel)?.label}) analizando...`);
            const critMsg = buildCriticMessages(sysPromptCritic, state.targetDataUrl, lastEpochScreenshot, state.currentSvelte || state.currentCode);
            state.lastPrompts.critic = critMsg;
            state.lastResponses.critic = '— esperando respuesta... —';
            refreshPromptsPane();
            const critRes = await callModel(criticModel, critMsg, apiKey, 2000, 'critic');
            state.lastResponses.critic = critRes.content;
            refreshPromptsPane();
            lastCritique = extractJson(critRes.content);
            if (!lastCritique) {
                log('err', `crítico devolvió JSON inválido`, { raw: critRes.content.slice(0, 300) });
                lastCritique = { error: 'invalid JSON', raw: critRes.content.slice(0, 500) };
            }
            else {
                log('ok', `critique parsed`, {});
                const entry = {
                    epoch: epochNum,
                    scores: lastCritique.scores || {},
                    overall: lastCritique.overall,
                };
                state.scoreHistory.push(entry);
                drawChart();
            }
            $('paneCritique').textContent = JSON.stringify(lastCritique, null, 2);
            $('critiqueOverall').textContent = lastCritique?.overall != null ? `overall: ${lastCritique.overall}` : '';
            setLoading(false);
            addHistoryThumb(epochNum, lastEpochScreenshot, state.currentCode, state.currentSvelte, lastCritique);
            // Persist epoch artifacts to disk
            const saves = [
                saveImage(`epoch${epochNum}_render.jpg`, lastEpochScreenshot),
                saveText(`epoch${epochNum}_component.svelte`, state.currentSvelte),
                saveText(`epoch${epochNum}_preview.html`, state.currentCode),
                saveText(`epoch${epochNum}_critique.json`, JSON.stringify(lastCritique, null, 2)),
                saveText(`epoch${epochNum}_gen_response.txt`, genRes.content),
                saveText(`epoch${epochNum}_critic_response.txt`, critRes.content),
            ];
            if (mode === 'decompose' && state.currentDecompose) {
                saves.push(saveText(`epoch${epochNum}_layers.json`, JSON.stringify(state.currentDecompose, null, 2)));
            }
            await Promise.all(saves);
            // Allow human feedback in between epochs
            $('feedbackBtn').disabled = false;
            setStatus(`Epoch ${epochNum}/${epochs} listo · cost $${state.totalCost.toFixed(4)}`);
        }
        if (!state.stopRequested) {
            setStatus(`✓ Done · ${epochs} epochs · $${state.totalCost.toFixed(4)} · ${state.totalTime.toFixed(1)}s`);
            log('ok', `▶ Run completo`, { cost: state.totalCost, dt: state.totalTime });
        }
    }
    catch (err) {
        console.error(err);
        log('err', `RUN FAILED: ${err.message}`);
        setStatus('❌ ' + err.message);
        alert('Error: ' + err.message);
    }
    finally {
        setLoading(false);
        stopTicker();
        startBtn.disabled = false;
        stopBtn.disabled = true;
        epochBadge.classList.add('hidden');
        $('feedbackBtn').disabled = !(state.currentSvelte || state.currentCode);
        const exBtn = $('exportAllBtn');
        if (exBtn)
            exBtn.disabled = !(state.currentSvelte || state.currentCode);
    }
}
// =====================================================================
// Manual feedback epoch — single forced Gemini 3.1 Pro call
// =====================================================================
async function runFeedbackEpoch() {
    const feedback = $('feedbackInput').value.trim();
    if (!feedback) {
        alert('Escribí el feedback primero');
        return;
    }
    if (!state.currentSvelte && !state.currentCode) {
        alert('Primero corré al menos un epoch base');
        return;
    }
    const provider = currentProvider();
    const FORCED_MODEL = provider === 'google' ? 'gemini-3.1-pro-preview' : 'google/gemini-3.1-pro-preview';
    const apiKey = getCurrentApiKey();
    if (!apiKey) {
        alert(`Falta API key (${provider === 'google' ? 'Google AI Studio' : 'OpenRouter'})`);
        return;
    }
    const feedbackBtn = $('feedbackBtn');
    feedbackBtn.disabled = true;
    startBtn.disabled = true;
    startTicker();
    setLoading(true, `✨ Aplicando feedback con Gemini 3.1 Pro...`);
    log('info', `▶ Manual feedback epoch · model=${FORCED_MODEL}`);
    log('info', `feedback: ${feedback}`);
    try {
        const screenshot = await screenshotIframe();
        if (!screenshot)
            log('warn', 'screenshot vacío para feedback epoch');
        const messages = buildFeedbackMessages($('sysPromptGen').value, state.targetDataUrl, screenshot, state.currentSvelte || '', state.currentCode || '', feedback);
        state.lastPrompts.generator = messages;
        state.lastResponses.generator = '— esperando respuesta... —';
        refreshPromptsPane();
        const maxTokens = parseInt($('maxTokens').value, 10);
        const res = await callModelForced(provider, FORCED_MODEL, messages, apiKey, maxTokens, 'generator-feedback');
        state.lastResponses.generator = res.content;
        refreshPromptsPane();
        const parsed = parseDualOutput(res.content);
        for (const note of parsed.parserNotes || []) {
            log(note.startsWith('⚠️') || note.startsWith('FAIL') ? 'warn' : 'info', `parser: ${note}`);
        }
        if (!parsed.svelte && !parsed.html) {
            log('err', `feedback epoch: no se pudo parsear el output`);
            log('err', `RAW (primeros 400 chars): ${res.content.slice(0, 400)}`);
            throw new Error('parser falló — ver tab Logs');
        }
        state.currentCode = parsed.html || stripFences(res.content);
        state.currentSvelte = parsed.svelte || '';
        updateCodePanes(state.currentSvelte, state.currentCode);
        $('renderMeta').textContent = `[👤 manual] svelte ${(state.currentSvelte.length / 1024).toFixed(1)}kb · html ${(state.currentCode.length / 1024).toFixed(1)}kb · ${res.dt.toFixed(1)}s`;
        await renderInIframe(state.currentCode);
        const humanCritique = {
            type: 'human_feedback',
            feedback,
            applied_at: new Date().toISOString(),
        };
        $('paneCritique').textContent = JSON.stringify(humanCritique, null, 2);
        $('critiqueOverall').textContent = '👤 manual';
        const thumb = await screenshotIframe();
        state.humanEpochCount += 1;
        const epochLabel = `👤${state.humanEpochCount}`;
        addHistoryThumb(epochLabel, thumb, state.currentCode, state.currentSvelte, humanCritique);
        if (state.currentSession) {
            const n = state.humanEpochCount;
            await Promise.all([
                saveText(`human${n}_feedback.txt`, feedback),
                saveText(`human${n}_component.svelte`, state.currentSvelte),
                saveText(`human${n}_preview.html`, state.currentCode),
                saveImage(`human${n}_render.jpg`, thumb),
            ]);
            log('info', `📁 saved human${n}_* to runs/${state.currentSession}/`);
        }
        setStatus(`✓ Feedback aplicado · 👤${state.humanEpochCount} · $${state.totalCost.toFixed(4)}`);
        log('ok', `▶ Manual feedback epoch completo (h${state.humanEpochCount})`);
    }
    catch (e) {
        console.error(e);
        log('err', `feedback epoch FAILED: ${e.message}`);
        setStatus('❌ ' + e.message);
        alert('Error en feedback: ' + e.message);
    }
    finally {
        setLoading(false);
        stopTicker();
        feedbackBtn.disabled = !(state.currentSvelte || state.currentCode);
        startBtn.disabled = false;
    }
}
// =====================================================================
// Wire up the main buttons
// =====================================================================
startBtn.addEventListener('click', runRefinement);
stopBtn.addEventListener('click', () => {
    state.stopRequested = true;
    setStatus('Deteniendo...');
});
$('feedbackBtn').addEventListener('click', runFeedbackEpoch);
const exportBtn = $('exportAllBtn');
if (exportBtn) {
    exportBtn.addEventListener('click', exportAllToFile);
}
