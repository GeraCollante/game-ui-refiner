/**
 * Global mutable state for game-ui-refiner.
 *
 * Keeping all state in one module makes the dependency graph clean: every
 * other module imports from here, but state.ts itself imports nothing.
 */
// =====================================================================
// Memory caps (prevent unbounded DOM/memory growth across long runs)
// =====================================================================
export const MAX_LOG_ENTRIES = 500;
export const MAX_HISTORY_THUMBS = 30;
// =====================================================================
// Mutable state
// =====================================================================
/** Data URL of the user-provided target image (PNG/JPEG). */
export const state = {
    targetDataUrl: null,
    stopRequested: false,
    /** HTML preview rendered in the iframe (extracted from generator output). */
    currentCode: null,
    /** .svelte deliverable (extracted from generator output). */
    currentSvelte: null,
    /** Extracted from <style> in currentSvelte. */
    currentCss: '',
    /** Extracted from <script> in currentSvelte. */
    currentJs: '',
    scoreHistory: [],
    totalCost: 0,
    totalTime: 0,
    logs: [],
    lastPrompts: { generator: null, critic: null },
    lastResponses: { generator: '', critic: '' },
    activeTab: 'critique',
    /** Session ID for the current run, e.g. "20260407_152330_a3b8". */
    currentSession: null,
    /** Counter for manual feedback epochs (h1, h2, ...). */
    humanEpochCount: 0,
    /** performance.now() when the current run started; null when idle. */
    runStartTime: null,
    /** setInterval handle for the live elapsed counter. */
    tickerInterval: null,
    /** True when lastPrompts/lastResponses changed but the Prompts pane wasn't rebuilt. */
    promptsDirty: false,
};
/** Reset all per-run accumulators (called by runRefinement at start). */
export function resetState() {
    state.totalCost = 0;
    state.totalTime = 0;
    state.scoreHistory = [];
    state.logs = [];
    state.currentCss = '';
    state.currentJs = '';
    state.humanEpochCount = 0;
    state.lastPrompts = { generator: null, critic: null };
    state.lastResponses = { generator: '', critic: '' };
}
