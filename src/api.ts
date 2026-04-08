/**
 * Provider API clients (OpenRouter + Google Gemini), message builders,
 * and the iframe screenshot helper.
 */

import { currentProvider, getModelInfo } from './config.js';
import { state } from './state.js';
import type { ChatMessage, ModelCallResult, MessagePart, Provider } from './types.js';
// `log` and `updateMeters` are imported lazily to avoid circular deps with ui.ts
import { log, updateMeters } from './ui.js';

// =====================================================================
// callModel — provider dispatcher
// =====================================================================

/**
 * Top-level model call. Reads `currentProvider()` from the DOM, dispatches
 * to the appropriate client, accumulates cost/time, and emits log entries.
 */
export async function callModel(
  modelId: string,
  messages: ChatMessage[],
  apiKey: string,
  maxTokens: number,
  role: string
): Promise<ModelCallResult> {
  const provider = currentProvider();
  const t0 = performance.now();
  log('call', `→ ${role} (${provider})`, { model: modelId });

  let result: { content: string; usage: any };
  try {
    if (provider === 'google') {
      result = await callGoogle(modelId, messages, apiKey, maxTokens);
    } else {
      result = await callOpenRouter(modelId, messages, apiKey, maxTokens);
    }
  } catch (e: any) {
    log('err', e.message, { model: modelId });
    throw e;
  }

  const dt = (performance.now() - t0) / 1000;
  state.totalTime += dt;

  const m = getModelInfo(modelId);
  let costThis = 0;
  if (m) {
    const costIn = ((result.usage.prompt_tokens || 0) / 1_000_000) * m.in;
    const costOut = ((result.usage.completion_tokens || 0) / 1_000_000) * m.out;
    costThis = costIn + costOut;
    state.totalCost += costThis;
  }
  updateMeters();

  log('ok', `← ${role} OK`, {
    model: modelId,
    dt,
    cost: costThis,
    tokens: { in: result.usage.prompt_tokens || 0, out: result.usage.completion_tokens || 0 },
    contentLen: result.content.length,
  });

  return { content: result.content, dt, usage: result.usage };
}

/**
 * Wrapper that forces a specific provider for one call (used by manual
 * feedback epoch which always wants Gemini 3.1 Pro). Temporarily overrides
 * the #provider select, then restores it in finally.
 */
export async function callModelForced(
  provider: Provider,
  modelId: string,
  messages: ChatMessage[],
  apiKey: string,
  maxTokens: number,
  role: string
): Promise<ModelCallResult> {
  const sel = document.getElementById('provider') as HTMLSelectElement;
  const prev = sel.value;
  sel.value = provider;
  try {
    return await callModel(modelId, messages, apiKey, maxTokens, role);
  } finally {
    sel.value = prev;
  }
}

// =====================================================================
// OpenRouter client
// =====================================================================

async function callOpenRouter(
  modelId: string,
  messages: ChatMessage[],
  apiKey: string,
  maxTokens: number
): Promise<{ content: string; usage: any }> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.href,
      'X-Title': 'game-ui-refiner',
    },
    body: JSON.stringify({ model: modelId, messages, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 400)}`);
  }
  const data = await res.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Empty OpenRouter response: ' + JSON.stringify(data).slice(0, 300));
  }
  return { content: data.choices[0].message.content, usage: data.usage || {} };
}

// =====================================================================
// Google Gemini client
// =====================================================================

async function callGoogle(
  modelId: string,
  messages: ChatMessage[],
  apiKey: string,
  maxTokens: number
): Promise<{ content: string; usage: any }> {
  const body: any = openAiToGoogle(messages);
  body.generationConfig = { maxOutputTokens: maxTokens, temperature: 0.7 };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google ${res.status}: ${errText.slice(0, 400)}`);
  }
  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error('Google: no candidates · ' + JSON.stringify(data).slice(0, 300));
  }
  if (candidate.finishReason === 'MAX_TOKENS') {
    log('err', `Google ⚠️ TRUNCADO por MAX_TOKENS — subí maxTokens (actual: ${maxTokens}). El parser probablemente va a fallar.`, { model: modelId });
  } else if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    log('warn', `Google finishReason=${candidate.finishReason}`, { model: modelId });
  }
  const parts = candidate.content?.parts || [];
  const text = parts.map((p: any) => p.text || '').join('');
  if (!text) {
    throw new Error('Google: empty content · ' + JSON.stringify(data).slice(0, 300));
  }
  const um = data.usageMetadata || {};
  const usage = {
    prompt_tokens: um.promptTokenCount || 0,
    completion_tokens: um.candidatesTokenCount || 0,
    total_tokens: um.totalTokenCount || 0,
  };
  return { content: text, usage };
}

/**
 * Convert OpenAI-style messages array to Google Gemini contents/systemInstruction.
 * Strips the data URL prefix from images and emits inline_data with base64.
 */
export function openAiToGoogle(messages: ChatMessage[]): any {
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const turnMsgs = messages.filter((m) => m.role !== 'system');

  const sysText = systemMsgs
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join('\n\n')
    .trim();

  const out: any = {
    contents: turnMsgs.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: (Array.isArray(m.content)
        ? m.content
        : [{ type: 'text', text: m.content || '' } as MessagePart]
      )
        .map((part) => {
          if (part.type === 'text') return { text: part.text };
          if (part.type === 'image_url') {
            const url = part.image_url.url;
            const matched = url.match(/^data:([^;]+);base64,(.*)$/);
            if (!matched) return null;
            return { inline_data: { mime_type: matched[1], data: matched[2] } };
          }
          return null;
        })
        .filter(Boolean),
    })),
  };
  if (sysText) {
    out.systemInstruction = { parts: [{ text: sysText }] };
  }
  return out;
}

// =====================================================================
// Message builders
// =====================================================================

export function buildInitialGenMessages(sysPrompt: string, targetUrl: string): ChatMessage[] {
  return [
    { role: 'system', content: sysPrompt },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Esta es la imagen TARGET. Generá un componente Svelte 4 + un HTML preview standalone que la repliquen con máxima fidelidad visual. Recordá: DOS bloques markdown exactos (```svelte``` y ```html```), nada más.',
        },
        { type: 'image_url', image_url: { url: targetUrl } },
      ],
    },
  ];
}

export function buildCriticMessages(
  sysPrompt: string,
  targetUrl: string,
  currentRenderUrl: string | null,
  currentCode: string
): ChatMessage[] {
  const userContent: MessagePart[] = [
    {
      type: 'text',
      text: 'IMAGEN 1: target. IMAGEN 2: render actual del código. Compará y devolvé EL JSON con scores y issues, sin markdown, sin texto fuera del JSON.',
    },
    { type: 'image_url', image_url: { url: targetUrl } },
  ];
  if (currentRenderUrl) {
    userContent.push({ type: 'image_url', image_url: { url: currentRenderUrl } });
  } else {
    userContent.push({ type: 'text', text: '(no se pudo capturar el render actual; juzgá basándote en el código previo)' });
  }
  userContent.push({ type: 'text', text: '\nCódigo actual:\n```html\n' + currentCode + '\n```' });
  return [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: userContent },
  ];
}

export function buildRefineMessages(
  sysPrompt: string,
  targetUrl: string,
  currentRenderUrl: string | null,
  prevSvelte: string,
  prevHtml: string,
  critique: any
): ChatMessage[] {
  const userContent: MessagePart[] = [
    {
      type: 'text',
      text: 'IMAGEN 1: TARGET. IMAGEN 2: render actual del HTML preview de tu output previo. Un crítico visual ya identificó las diferencias en el JSON de abajo. Aplicá los fix_priorities y producí una versión MEJORADA. Recordá los DOS bloques markdown obligatorios (```svelte``` y ```html```).',
    },
    { type: 'image_url', image_url: { url: targetUrl } },
  ];
  if (currentRenderUrl) {
    userContent.push({ type: 'image_url', image_url: { url: currentRenderUrl } });
  }
  userContent.push({
    type: 'text',
    text:
      '\nCRÍTICA del experto visual:\n```json\n' +
      JSON.stringify(critique, null, 2) +
      '\n```' +
      '\n\nSvelte previo:\n```svelte\n' +
      prevSvelte +
      '\n```' +
      '\n\nHTML preview previo:\n```html\n' +
      prevHtml +
      '\n```',
  });
  return [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: userContent },
  ];
}

export function buildFeedbackMessages(
  sysPrompt: string,
  targetUrl: string,
  currentRenderUrl: string | null,
  prevSvelte: string,
  prevHtml: string,
  humanFeedback: string
): ChatMessage[] {
  const userContent: MessagePart[] = [
    {
      type: 'text',
      text:
        'IMAGEN 1: TARGET original. IMAGEN 2: render actual de tu output previo. ' +
        'El humano (autor del proyecto) acaba de revisar el resultado y te da el siguiente feedback ' +
        'directo y específico para retoques finales. APLICALO EXACTAMENTE — el humano sabe lo que ' +
        'quiere, no reinterpretes ni agregues cambios extra. Recordá los DOS bloques markdown obligatorios (```svelte``` y ```html```).',
    },
    { type: 'image_url', image_url: { url: targetUrl } },
  ];
  if (currentRenderUrl) {
    userContent.push({ type: 'image_url', image_url: { url: currentRenderUrl } });
  }
  userContent.push({
    type: 'text',
    text:
      '\n👤 FEEDBACK DEL HUMANO:\n' +
      humanFeedback +
      '\n\nSvelte previo:\n```svelte\n' +
      prevSvelte +
      '\n```' +
      '\n\nHTML preview previo:\n```html\n' +
      prevHtml +
      '\n```',
  });
  return [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: userContent },
  ];
}

// =====================================================================
// iframe screenshot via html2canvas (CDN global)
// =====================================================================

const previewIframe = () => document.getElementById('preview') as HTMLIFrameElement;

/** Render an HTML string into the preview iframe. Resolves after onload. */
export function renderInIframe(html: string): Promise<void> {
  const preview = previewIframe();
  preview.srcdoc = html;
  return new Promise((resolve) => {
    preview.onload = () => setTimeout(() => resolve(), 300);
  });
}

/** Capture the iframe contents as a JPEG data URL. Returns null on failure. */
export async function screenshotIframe(): Promise<string | null> {
  const preview = previewIframe();
  const doc = preview.contentDocument;
  if (!doc || !doc.body) return null;
  try {
    const canvas = await html2canvas(doc.body, {
      backgroundColor: '#ffffff',
      scale: 1,
      logging: false,
      useCORS: true,
    });
    // JPEG quality 0.85 is ~5–10× smaller than PNG and visually identical
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (e) {
    console.error('screenshot failed', e);
    return null;
  }
}
