/**
 * Model catalog, dropdown options, presets, and provider helpers.
 */

import type { ModelInfo, PresetConfig, Provider } from './types.js';

// =====================================================================
// Model catalog with pricing per provider
// =====================================================================

export const MODELS_BY_PROVIDER: Record<Provider, Record<string, ModelInfo>> = {
  google: {
    // Gemini 3.x family (preview, top tier)
    'gemini-3.1-pro-preview':       { in: 2.00,  out: 12.00, vision: true, label: 'Gemini 3.1 Pro Preview' },
    'gemini-3.1-flash-lite-preview':{ in: 0.25,  out: 1.50,  vision: true, label: 'Gemini 3.1 Flash-Lite Preview' },
    'gemini-3-pro-preview':         { in: 2.00,  out: 12.00, vision: true, label: 'Gemini 3 Pro Preview' },
    'gemini-3-flash-preview':       { in: 0.50,  out: 3.00,  vision: true, label: 'Gemini 3 Flash Preview' },
    // Latest aliases (auto-update)
    'gemini-pro-latest':            { in: 2.00,  out: 12.00, vision: true, label: 'Gemini Pro :latest' },
    'gemini-flash-latest':          { in: 0.50,  out: 3.00,  vision: true, label: 'Gemini Flash :latest' },
    'gemini-flash-lite-latest':     { in: 0.25,  out: 1.50,  vision: true, label: 'Gemini Flash-Lite :latest' },
    // Gemini 2.5 family (stable, generous free tier)
    'gemini-2.5-pro':               { in: 1.25,  out: 10.00, vision: true, label: 'Gemini 2.5 Pro' },
    'gemini-2.5-flash':             { in: 0.30,  out: 2.50,  vision: true, label: 'Gemini 2.5 Flash' },
    'gemini-2.5-flash-lite':        { in: 0.10,  out: 0.40,  vision: true, label: 'Gemini 2.5 Flash-Lite' },
    // Gemini 2.0 (fallback)
    'gemini-2.0-flash':             { in: 0.10,  out: 0.40,  vision: true, label: 'Gemini 2.0 Flash' },
    'gemini-2.0-flash-lite':        { in: 0.075, out: 0.30,  vision: true, label: 'Gemini 2.0 Flash-Lite' },
  },
  openrouter: {
    'google/gemini-3-flash-preview':            { in: 0.50, out: 3.00,  vision: true,  label: 'Gemini 3 Flash' },
    'google/gemini-3.1-pro-preview':            { in: 2.00, out: 12.00, vision: true,  label: 'Gemini 3.1 Pro Preview' },
    'google/gemini-3.1-flash-lite-preview':     { in: 0.25, out: 1.50,  vision: true,  label: 'Gemini 3.1 Flash-Lite' },
    'google/gemini-2.5-pro':                    { in: 1.25, out: 10.00, vision: true,  label: 'Gemini 2.5 Pro' },
    'google/gemini-2.5-flash':                  { in: 0.30, out: 2.50,  vision: true,  label: 'Gemini 2.5 Flash' },
    'openai/gpt-5.4':                           { in: 2.50, out: 15.00, vision: true,  label: 'GPT-5.4' },
    'openai/gpt-5.4-mini':                      { in: 0.75, out: 4.50,  vision: true,  label: 'GPT-5.4 mini' },
    'openai/gpt-5':                             { in: 1.25, out: 10.00, vision: true,  label: 'GPT-5' },
    'anthropic/claude-sonnet-4.6':              { in: 3.00, out: 15.00, vision: true,  label: 'Claude Sonnet 4.6' },
    'anthropic/claude-opus-4.6':                { in: 5.00, out: 25.00, vision: true,  label: 'Claude Opus 4.6' },
    'anthropic/claude-haiku-4.5':               { in: 1.00, out: 5.00,  vision: true,  label: 'Claude Haiku 4.5' },
    'x-ai/grok-4.20':                           { in: 2.00, out: 6.00,  vision: true,  label: 'Grok 4.20 (2M ctx)' },
    'x-ai/grok-4.20-multi-agent':               { in: 2.00, out: 6.00,  vision: true,  label: 'Grok 4.20 multi-agent' },
    'x-ai/grok-4-fast':                         { in: 0.20, out: 0.50,  vision: true,  label: 'Grok 4 Fast' },
    'x-ai/grok-4':                              { in: 3.00, out: 15.00, vision: true,  label: 'Grok 4' },
    'qwen/qwen3.5-397b-a17b':                   { in: 0.39, out: 2.34,  vision: true,  label: 'Qwen 3.5 397B' },
    'moonshotai/kimi-k2.5':                     { in: 0.38, out: 1.72,  vision: true,  label: 'Kimi K2.5' },
    'nvidia/nemotron-nano-12b-v2-vl':           { in: 0.20, out: 0.60,  vision: true,  label: 'Nemotron Nano 12B VL' },
    'nvidia/nemotron-nano-12b-v2-vl:free':      { in: 0,    out: 0,     vision: true,  label: 'Nemotron Nano VL :free' },
    'nvidia/nemotron-3-super-120b-a12b':        { in: 0.10, out: 0.50,  vision: false, label: 'Nemotron 3 Super (text)' },
    'nvidia/nemotron-3-super-120b-a12b:free':   { in: 0,    out: 0,     vision: false, label: 'Nemotron 3 Super :free' },
    'meta-llama/llama-4-maverick':              { in: 0.15, out: 0.60,  vision: true,  label: 'Llama 4 Maverick' },
  },
};

// =====================================================================
// Curated dropdown subsets per provider
// =====================================================================

export const OPTIONS_BY_PROVIDER: Record<Provider, { critic: string[]; gen: string[] }> = {
  google: {
    critic: [
      'gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview',
      'gemini-3.1-pro-preview', 'gemini-3-pro-preview',
      'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro',
      'gemini-flash-latest', 'gemini-flash-lite-latest',
      'gemini-2.0-flash', 'gemini-2.0-flash-lite',
    ],
    gen: [
      'gemini-3.1-pro-preview', 'gemini-3-pro-preview',
      'gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview',
      'gemini-2.5-pro', 'gemini-2.5-flash',
      'gemini-pro-latest', 'gemini-flash-latest',
      'gemini-2.0-flash',
    ],
  },
  openrouter: {
    critic: [
      'google/gemini-3-flash-preview', 'google/gemini-3.1-pro-preview', 'google/gemini-3.1-flash-lite-preview',
      'google/gemini-2.5-pro', 'google/gemini-2.5-flash',
      'openai/gpt-5.4', 'openai/gpt-5.4-mini',
      'anthropic/claude-sonnet-4.6', 'anthropic/claude-opus-4.6',
      'x-ai/grok-4-fast', 'x-ai/grok-4.20', 'x-ai/grok-4',
      'qwen/qwen3.5-397b-a17b', 'moonshotai/kimi-k2.5',
      'nvidia/nemotron-nano-12b-v2-vl', 'nvidia/nemotron-nano-12b-v2-vl:free',
    ],
    gen: [
      'google/gemini-3.1-pro-preview', 'google/gemini-3-flash-preview',
      'openai/gpt-5.4', 'openai/gpt-5.4-mini',
      'anthropic/claude-sonnet-4.6', 'anthropic/claude-opus-4.6',
      'x-ai/grok-4.20', 'x-ai/grok-4', 'x-ai/grok-4.20-multi-agent',
      'qwen/qwen3.5-397b-a17b', 'moonshotai/kimi-k2.5',
      'nvidia/nemotron-3-super-120b-a12b', 'nvidia/nemotron-3-super-120b-a12b:free',
    ],
  },
};

// =====================================================================
// Presets — quick-pick pairs of (critic, generator) per provider
// =====================================================================

export const PRESETS_BY_PROVIDER: Record<Provider, Record<string, PresetConfig>> = {
  google: {
    smart:   { critic: 'gemini-3.1-flash-lite-preview', gen: 'gemini-3.1-pro-preview' },
    smart3:  { critic: 'gemini-3-flash-preview',        gen: 'gemini-3.1-pro-preview' },
    speed:   { critic: 'gemini-3.1-flash-lite-preview', gen: 'gemini-3-flash-preview' },
    premium: { critic: 'gemini-3.1-pro-preview',        gen: 'gemini-3.1-pro-preview' },
    stable:  { critic: 'gemini-2.5-flash',              gen: 'gemini-2.5-pro' },
    free:    { critic: 'gemini-2.5-flash',              gen: 'gemini-2.5-flash' },
  },
  openrouter: {
    smart:     { critic: 'google/gemini-3.1-flash-lite-preview',  gen: 'google/gemini-3.1-pro-preview' },
    smart3:    { critic: 'google/gemini-3-flash-preview',         gen: 'google/gemini-3.1-pro-preview' },
    speed:     { critic: 'google/gemini-3.1-flash-lite-preview',  gen: 'openai/gpt-5.4-mini' },
    premium:   { critic: 'google/gemini-3.1-pro-preview',         gen: 'openai/gpt-5.4' },
    anthropic: { critic: 'google/gemini-3.1-flash-lite-preview',  gen: 'anthropic/claude-sonnet-4.6' },
    grok:      { critic: 'x-ai/grok-4-fast',                      gen: 'x-ai/grok-4.20' },
    grokfull:  { critic: 'x-ai/grok-4.20',                        gen: 'x-ai/grok-4' },
    free:      { critic: 'nvidia/nemotron-nano-12b-v2-vl:free',   gen: 'nvidia/nemotron-3-super-120b-a12b:free' },
  },
};

export const PRESET_LABELS: Record<string, string> = {
  smart:    '🥇 Smart (3.1 Flash-Lite + 3.1 Pro)',
  smart3:   '🥈 Smart-3 (3 Flash + 3.1 Pro)',
  speed:    '⚡ Speed',
  premium:  '👑 Premium',
  stable:   '🪨 Stable (Gemini 2.5)',
  anthropic:'🅰️ Anthropic',
  grok:     '🤖 Grok (4 Fast + 4.20)',
  grokfull: '🤖 Grok Full (4.20 + 4)',
  free:     '🆓 Free',
  cheapest: '🪙 Cheapest',
};

/** Per-dimension chart colors. */
export const DIM_COLORS: Record<string, { c: string; short: string }> = {
  structural_fidelity: { c: '#f87171', short: 'struc' },
  color_consistency:   { c: '#60a5fa', short: 'color' },
  typography:          { c: '#4ade80', short: 'type'  },
  spacing_alignment:   { c: '#facc15', short: 'space' },
  visual_completeness: { c: '#c084fc', short: 'compl' },
};

/** Extra dimension only used in decompose mode. */
export const DECOMPOSE_DIM = {
  decomposition: { c: '#fb923c', short: 'decmp' },
} as const;

// =====================================================================
// Default system prompts for decompose mode
// =====================================================================

export const DEFAULT_DECOMPOSE_GEN_PROMPT = `CRITICAL OUTPUT FORMAT: tu respuesta entera DEBE consistir EXACTAMENTE en un único bloque markdown \`\`\`json …\`\`\` y NADA más. Sin prosa antes, sin explicación después, sin chain-of-thought. Cualquier carácter fuera del fence corrompe el parser.

ROL: sos un experto descomponiendo botones de game UI en CAPAS animables. NO generás un .svelte monolítico — devolvés un schema JSON de capas que después un compilador determinístico convierte a Svelte+CSS.

SCHEMA EXACTO:
{
  "width": 220,
  "height": 72,
  "layers": [
    {
      "name": "shadow",
      "role": "shadow",
      "css": "filter: blur(6px); background: radial-gradient(...); opacity:.6;"
    },
    {
      "name": "base",
      "role": "plate",
      "css": "background: linear-gradient(...); border-radius: 12px; box-shadow: inset 0 2px 0 #fff5, inset 0 -3px 0 #0006;"
    },
    {
      "name": "border",
      "role": "frame",
      "css": "border: 2px solid #c08040; border-radius: 12px; box-shadow: 0 0 0 1px #000;",
      "ninepatch": { "top": 8, "right": 8, "bottom": 8, "left": 8 }
    },
    {
      "name": "glow",
      "role": "fx",
      "css": "background: radial-gradient(ellipse at center, #ffd97755, transparent 60%); mix-blend-mode: screen;",
      "animations": [
        {
          "name": "idle-pulse",
          "trigger": "always",
          "keyframes": "0%,100% { opacity:.5 } 50% { opacity:1 }",
          "duration": "1.6s",
          "iteration": "infinite"
        }
      ]
    },
    {
      "name": "icon",
      "role": "content",
      "svg": "<svg viewBox='0 0 24 24' fill='#fff'><path d='...'/></svg>",
      "css": "display:flex; align-items:center; justify-content:center;"
    },
    {
      "name": "label",
      "role": "content",
      "text": "ATTACK",
      "css": "display:flex; align-items:center; justify-content:center; font-family: 'Arial Black', sans-serif; color:#fff; text-shadow: 0 2px 0 #000;"
    }
  ],
  "states": [
    { "name": "idle" },
    { "name": "hover", "overrides": { "glow": "opacity:1; filter: brightness(1.2);" } },
    { "name": "press", "overrides": { "base": "transform: translateY(2px);", "shadow": "opacity:.3;" } },
    { "name": "disabled", "overrides": { "base": "filter: grayscale(1) brightness(.6);" } }
  ]
}

REGLAS DURAS:
1. Layers van apilados por orden (índice 0 = atrás, último = frente). z-index automático.
2. Cada layer.css es un body CSS plano (sin selector ni llaves). El compilador lo inyecta en \`.layer-{name} { … }\`.
3. Cada layer ocupa todo el botón por default (position:absolute; inset:0). Si querés posicionarlo, usá márgenes/padding/transform en css.
4. NO uses imágenes externas. SVG inline o gradientes/box-shadow CSS solamente.
5. Cada animation.keyframes es un body de @keyframes (los stops adentro), sin la palabra @keyframes ni el nombre.
6. SIEMPRE incluí al menos el state "idle". Los demás (hover/press/disabled) son opcionales pero recomendados.
7. PENSÁ en SEPARABILIDAD: si oculto la capa "glow" sola, las demás tienen que seguir teniendo sentido visual. NO mezcles efectos en la capa base.
8. Roles válidos: plate (placa de fondo), frame (borde/marco), fx (efectos: glow/particles/highlights), content (icono/texto), shadow (sombras externas).

CONTENIDO: replicá la imagen TARGET con máxima fidelidad usando esta descomposición. Pensá: ¿qué capa va atrás? ¿cuál encima? ¿qué partes deberían animarse? ¿qué cambia en hover/press?`;

export const DEFAULT_DECOMPOSE_CRITIC_PROMPT = `Sos crítico estricto de UI animable. Compará TARGET vs RENDER del botón compilado y devolvé SOLO un objeto JSON válido (sin markdown, sin prosa) con este schema EXACTO:

{
  "scores": {
    "structural_fidelity": 0-10,
    "color_consistency": 0-10,
    "typography": 0-10,
    "spacing_alignment": 0-10,
    "visual_completeness": 0-10,
    "decomposition": 0-10
  },
  "overall": 0-10,
  "top_issues": [
    {"dimension":"color|layout|typography|spacing|completeness|decomposition","severity":"high|medium|low","description":"texto breve y accionable"}
  ],
  "fix_priorities": ["fix1","fix2","fix3"]
}

La nueva dimensión "decomposition" mide:
- ¿Las capas son SEPARABLES? (al ocultar una, las demás siguen teniendo sentido)
- ¿Las animaciones declaradas TIENEN SENTIDO en su capa? (un border no debería pulsar, un glow sí)
- ¿FALTAN capas obvias del target? (hay partículas en el target pero no en el JSON → bajá el score)
- ¿Los roles están BIEN ASIGNADOS? (no metas glow en una capa "plate")

Sé honesto: si la decomposición es plana (todo metido en una sola capa "base") poné decomposition ≤ 4.`;

// =====================================================================
// Provider helpers (read DOM at call time for live state)
// =====================================================================

export function currentProvider(): Provider {
  return (document.getElementById('provider') as HTMLSelectElement).value as Provider;
}

export function getModels(): Record<string, ModelInfo> {
  return MODELS_BY_PROVIDER[currentProvider()];
}

export function getModelInfo(id: string): ModelInfo | undefined {
  return getModels()[id];
}

export function getCurrentApiKey(): string {
  const provider = currentProvider();
  const id = provider === 'google' ? 'googleKey' : 'apiKey';
  return (document.getElementById(id) as HTMLInputElement).value.trim();
}
