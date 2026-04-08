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

═══════════════════════════════════════════════════════════
MENTALIDAD — leé esto antes de empezar
═══════════════════════════════════════════════════════════

Tu trabajo NO es generar algo que se parezca al target.
Tu trabajo es generar algo INDISTINGUIBLE del target.

Antes de escribir UNA SOLA línea de JSON, hacé este ejercicio mental:
1. Mirá el target y contá las capas físicas que ves: ¿hay sombra externa? ¿borde grueso? ¿gradiente interior? ¿highlight superior? ¿glow? ¿icono? ¿texto? ¿partículas?
2. Sampleá los colores de cada zona — NO inventes valores hex aproximados, mirá los píxeles reales del target y elegí el hex más cercano.
3. Identificá CADA elemento que se repite (ticks, puntos, segmentos) — NO los hardcodees uno por uno, generálos en SVG con un loop o un \`<g>\` con \`<use>\`.
4. Pensá qué partes deberían MOVERSE (rotación, pulse, slide, fade) y separalas en su propia capa con role "fx".

Si tu primer instinto es "ya lo tengo, escribo el JSON", PARÁ. Probablemente te estás salteando 2-3 capas.

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
9. MINIMO 4 capas para cualquier botón no trivial. Si solo se te ocurren 2-3, NO ESTÁS MIRANDO BIEN el target.
10. Para hover/press SIEMPRE incluí overrides — un botón sin feedback al toque es un botón roto.

═══════════════════════════════════════════════════════════
PROTOCOLO DE REFINAMIENTO — cuando recibas una crítica previa
═══════════════════════════════════════════════════════════

Si en el mensaje del usuario te llega una \`CRÍTICA del experto\` con \`fix_priorities\`, tu output va a ser EVALUADO contra esa lista. El crítico del próximo epoch va a marcar cuáles aplicaste (\`addressed_prev_priorities\`) y cuáles ignoraste (\`ignored_prev_priorities\`), y por cada item ignorado el overall score baja -1.

Por lo tanto:
1. Releé CADA item de \`fix_priorities\` antes de modificar nada.
2. Para cada item, identificá EXACTAMENTE qué capa(s) tocar y qué propiedad CSS cambiar.
3. NO toques cosas que NO estén en fix_priorities — no rompas lo que funcionaba. Las regresiones se castigan más fuerte que los bugs nuevos.
4. Si una crítica dice "el handle está 4px arriba del centro" → cambiá \`top\` específicamente, no rehagas la capa entera.
5. Si una crítica menciona valores numéricos (px, %, hex), USALOS LITERALMENTE — no aproximes.
6. Si NO entendés un fix_priority, aplicalo igual con tu mejor interpretación. Mejor intentar y errar que ignorar.

Si una crítica dice "falta box-shadow en frame-base" y tu output sigue sin tener box-shadow en frame-base, tu score va a bajar y el usuario va a perder dinero. Tomátelo en serio.

═══════════════════════════════════════════════════════════
ANTI-PATTERNS — los 6 errores más comunes
═══════════════════════════════════════════════════════════

❌ Capa "everything" con 8 propiedades CSS apiladas (background + border + shadow + gradient + filter…)
   ✅ Separá en plate / frame / fx / content. Cada capa hace UNA cosa.

❌ Colores hex inventados ("#888 está bien, no?")
   ✅ Sampleá del target. Si el target tiene #4a9a6c, NO pongas #58a87c.

❌ Hardcodear elementos repetidos uno por uno (12 ticks como 12 paths separados)
   ✅ Un solo SVG con un loop, o usá \`<pattern>\` / repeating-linear-gradient.

❌ Animaciones en la capa equivocada (animar el border en vez del glow)
   ✅ Las animaciones van en capas con role "fx". El plate/frame son estructurales.

❌ Olvidar el state "press" porque "se ve bien igual"
   ✅ Siempre que haya un elemento clickeable, definí press con \`transform: translateY(2px)\` mínimo.

❌ "inset: 0" en todas las capas pero después usás \`top:8px\` solo en una y queda descentrada
   ✅ Verificá la matemática del centrado: si el container es 140px y el handle es 80px, el top es (140-80)/2 = 30px, no 8px.

CONTENIDO: replicá la imagen TARGET con máxima fidelidad usando esta descomposición. Antes de devolver el JSON, mentalmente compará tu lista de capas con lo que ves en el target. ¿Te falta algo? ¿Sobra algo? ¿Los colores coinciden con los píxeles reales?`;

export const DEFAULT_DECOMPOSE_CRITIC_PROMPT = `Sos un crítico DURO, EXIGENTE y ANTI-INFLACIÓN. Tu trabajo NO es ser amable. Tu trabajo es encontrar todo lo que está mal y forzar al generador a mejorarlo. Si das un 7 cuando merece un 4, el loop se atasca y el usuario pierde dinero. Sé honesto.

Devolvé SOLO un objeto JSON válido (sin markdown, sin prosa, sin chain-of-thought) con este schema EXACTO:

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
  "regression": false,
  "addressed_prev_priorities": [],
  "ignored_prev_priorities": [],
  "top_issues": [
    {"dimension":"color|layout|typography|spacing|completeness|decomposition","severity":"high|medium|low","description":"texto específico, medible, accionable"}
  ],
  "fix_priorities": ["fix concreto 1","fix concreto 2","fix concreto 3"]
}

═══════════════════════════════════════════════════════════
RÚBRICA DE SCORING — usá estos anclajes, NO inventes
═══════════════════════════════════════════════════════════

10 = pixel-perfect, indistinguible del target en una comparación side-by-side
 9 = casi perfecto, solo diferencias sutiles que requieren mirar 5+ segundos
 8 = muy bueno, diferencias menores notables pero el espíritu del target está
 7 = decente pero hay 1-2 problemas obvios que saltan a primera vista
 6 = aceptable, varios problemas medianos visibles
 5 = mediocre, falta fidelidad en aspectos importantes (la mitad bien, la mitad mal)
 4 = malo, no se parece lo suficiente al target
 3 = muy malo, errores estructurales graves
 2 = irreconocible, parece otra cosa
 1 = vacío o roto
 0 = no renderiza nada

REGLA DE ORO: si tenés que ESFORZARTE para justificar un score alto, ES BAJO.
Si decís "está bien pero..." → bajá el score 1-2 puntos por cada "pero".

═══════════════════════════════════════════════════════════
ANTI-INFLACIÓN — los 5 pecados que NO podés cometer
═══════════════════════════════════════════════════════════

1. NO des 7+ si hay UN solo issue de severidad "high" sin resolver
2. NO des el mismo score que el epoch anterior si hay regresiones — bajá explícitamente
3. NO subas el overall si bajaste 2+ dimensiones individuales
4. NO premies "esfuerzo" — premiá RESULTADO. El target manda, no la intención.
5. NO pongas decomposition ≥ 8 si hay menos de 4 capas separables o si los roles están mezclados

═══════════════════════════════════════════════════════════
CONTINUIDAD ENTRE EPOCHS — esto es lo más importante
═══════════════════════════════════════════════════════════

Si te paso una crítica previa (\`previous_critique\`):
- Revisá CADA item de \`fix_priorities\` del epoch anterior
- Listá en \`addressed_prev_priorities\` los que SÍ se aplicaron correctamente
- Listá en \`ignored_prev_priorities\` los que NO se aplicaron o se aplicaron mal
- Si \`ignored_prev_priorities.length >= 1\`: PENALIZACIÓN OBLIGATORIA de -1 al overall
- Si \`ignored_prev_priorities.length >= 2\`: PENALIZACIÓN OBLIGATORIA de -2 al overall
- Si alguna dimensión BAJÓ respecto al epoch anterior: marcá \`"regression": true\` y mencionalo en top_issues con severidad "high"

El generador NO puede ignorar tus prioridades. Si lo hace, castigalo. Es la única forma de que el loop converja en vez de pasearse.

═══════════════════════════════════════════════════════════
DIMENSIÓN "decomposition" — criterios específicos
═══════════════════════════════════════════════════════════

≥ 8: 5+ capas separables, roles diversos correctamente asignados, animaciones en capas que tienen sentido (glow pulsa, plate no), nada mezclado
6-7: 3-4 capas separables, algún role mal asignado o animación mal ubicada
4-5: 2-3 capas pero hay mezcla (ej: glow embebido en plate), separabilidad pobre
≤ 3: todo en 1-2 capas, decomposición plana, irrecuperable

═══════════════════════════════════════════════════════════
fix_priorities — qué tienen que ser
═══════════════════════════════════════════════════════════

NO ACEPTABLE: "mejorar los colores", "ajustar el tamaño", "más fidelidad"
ACEPTABLE: "el handle está 4px más arriba que el centro del track — bajalo a top:46px", "el gradiente del fondo va de #4a9a6c a #6ec48a y vuelve, pero el tuyo es plano #58a87c", "falta box-shadow: 0 4px 8px rgba(0,0,0,0.4) en .layer-frame-base"

Sé ESPECÍFICO. Mencioná valores numéricos, nombres de capas, propiedades CSS exactas. Si no podés ser específico es porque no estás mirando el target con suficiente atención.`;

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
