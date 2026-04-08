/**
 * Shared TypeScript interfaces for game-ui-refiner.
 */

/** A model entry in the catalog. */
export interface ModelInfo {
  /** Input price USD per 1M tokens. */
  in: number;
  /** Output price USD per 1M tokens. */
  out: number;
  /** Whether the model accepts image input. */
  vision: boolean;
  /** Display label shown in the dropdown. */
  label: string;
}

export type Provider = 'google' | 'openrouter';

export interface PresetConfig {
  critic: string;
  gen: string;
}

/** OpenAI-style message used internally; converted to Google format on the fly. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'model';
  content: string | MessagePart[];
}

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/** Token usage normalized to OpenAI shape. */
export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ModelCallResult {
  content: string;
  usage: UsageInfo;
  dt: number;
}

/** Critic JSON schema (5–6 dimensions, each 0–10). */
export interface CritiqueScores {
  structural_fidelity?: number;
  color_consistency?: number;
  typography?: number;
  spacing_alignment?: number;
  visual_completeness?: number;
  /** Only present in decompose mode: how separable / animatable the layers are. */
  decomposition?: number;
}

// =====================================================================
// Decompose mode (layered button schema)
// =====================================================================

export type RefinerMode = 'holistic' | 'decompose';

export type LayerRole = 'plate' | 'frame' | 'fx' | 'content' | 'shadow';
export type StateName = 'idle' | 'hover' | 'press' | 'disabled';

export interface DecomposeAnimation {
  name: string;
  trigger: 'always' | 'hover' | 'press';
  /** A bare `@keyframes` body, e.g. `0% { opacity:.6 } 100% { opacity:1 }` (no `@keyframes` keyword, no name, no braces around it) */
  keyframes: string;
  duration: string;
  iteration: 'infinite' | number;
}

export interface DecomposeLayer {
  name: string;
  role: LayerRole;
  /** Plain CSS body for `.layer-{name}` (no selector, no braces). */
  css: string;
  svg?: string;
  text?: string;
  ninepatch?: { top: number; right: number; bottom: number; left: number };
  animations?: DecomposeAnimation[];
}

export interface DecomposeState {
  name: StateName;
  /** layer name → extra css body */
  overrides?: Record<string, string>;
}

export interface DecomposeOutput {
  layers: DecomposeLayer[];
  states: DecomposeState[];
  width?: number;
  height?: number;
}

export interface ParsedDecompose {
  data: DecomposeOutput | null;
  parserNotes: string[];
}

export interface CritiqueIssue {
  dimension: 'color' | 'layout' | 'typography' | 'spacing' | 'completeness' | string;
  severity: 'high' | 'medium' | 'low' | string;
  description: string;
}

export interface Critique {
  scores?: CritiqueScores;
  overall?: number;
  top_issues?: CritiqueIssue[];
  fix_priorities?: string[];
  /** Used when the critic returned invalid JSON. */
  error?: string;
  raw?: string;
  /** Used by the manual feedback epoch path. */
  type?: 'human_feedback';
  feedback?: string;
  applied_at?: string;
}

export interface ScoreEntry {
  epoch: number;
  scores: CritiqueScores;
  overall?: number;
}

export interface LogEntry {
  ts: string;
  level: 'info' | 'call' | 'ok' | 'err' | 'warn';
  msg: string;
  model?: string;
  dt?: number;
  cost?: number;
  tokens?: { in: number; out: number };
  contentLen?: number;
  raw?: string;
  rawLen?: number;
  bytes?: number;
}

export interface ParsedDualOutput {
  svelte: string | null;
  html: string | null;
  parserNotes: string[];
}

export interface SvelteParts {
  script: string;
  template: string;
  style: string;
}

/** Last messages sent to each role for the Prompts panel. */
export interface LastPrompts {
  generator: ChatMessage[] | null;
  critic: ChatMessage[] | null;
}

export interface LastResponses {
  generator: string;
  critic: string;
}

/** Globals injected by serve.py from .env. */
declare global {
  interface Window {
    GEMINI_API_KEY?: string;
    GOOGLE_API_KEY?: string;
    OPENROUTER_API_KEY?: string;
  }
}

/** html2canvas global from CDN. */
declare global {
  const html2canvas: (
    el: HTMLElement,
    opts?: { backgroundColor?: string; scale?: number; logging?: boolean; useCORS?: boolean }
  ) => Promise<HTMLCanvasElement>;
}
