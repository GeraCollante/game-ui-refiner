/**
 * Global mutable state for game-ui-refiner.
 *
 * Keeping all state in one module makes the dependency graph clean: every
 * other module imports from here, but state.ts itself imports nothing.
 */

import type { DecomposeOutput, LastPrompts, LastResponses, LogEntry, RefinerMode, ScoreEntry } from './types.js';

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
  targetDataUrl: null as string | null,
  stopRequested: false,

  /** HTML preview rendered in the iframe (extracted from generator output). */
  currentCode: null as string | null,
  /** .svelte deliverable (extracted from generator output). */
  currentSvelte: null as string | null,
  /** Extracted from <style> in currentSvelte. */
  currentCss: '' as string,
  /** Extracted from <script> in currentSvelte. */
  currentJs: '' as string,

  scoreHistory: [] as ScoreEntry[],
  totalCost: 0 as number,
  totalTime: 0 as number,
  logs: [] as LogEntry[],

  lastPrompts: { generator: null, critic: null } as LastPrompts,
  lastResponses: { generator: '', critic: '' } as LastResponses,

  activeTab: 'critique' as string,
  /** Session ID for the current run, e.g. "20260407_152330_a3b8". */
  currentSession: null as string | null,
  /** Counter for manual feedback epochs (h1, h2, ...). */
  humanEpochCount: 0 as number,
  /** performance.now() when the current run started; null when idle. */
  runStartTime: null as number | null,
  /** setInterval handle for the live elapsed counter. */
  tickerInterval: null as ReturnType<typeof setInterval> | null,
  /** True when lastPrompts/lastResponses changed but the Prompts pane wasn't rebuilt. */
  promptsDirty: false as boolean,

  /** Active mode (holistic = original Svelte loop; decompose = layered JSON loop). */
  mode: 'holistic' as RefinerMode,
  /** Last successfully-parsed decompose JSON for the active session. */
  currentDecompose: null as DecomposeOutput | null,
};

/** Reset all per-run accumulators (called by runRefinement at start). */
export function resetState(): void {
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
