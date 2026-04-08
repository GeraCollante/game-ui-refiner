# Changelog

## 0.1.0 — Initial public release

### Architecture
- Critic + generator iterative loop with vision-language models
- Dual provider support: Google AI Studio (direct) + OpenRouter
- TypeScript ES modules compiled to `js/` (committed, no `npm install` needed for end users)
- Single-page browser app + tiny Python server for `.env` injection
- Per-session disk save: renders, code, critique JSON, prompt I/O

### Models supported
- **Google direct**: Gemini 3.x preview family (3.1 Pro, 3.1 Flash-Lite, 3 Pro, 3 Flash), Gemini 2.5 Pro/Flash/Flash-Lite, Gemini 2.0 Flash, Gemini 1.5 fallback
- **OpenRouter**: GPT-5.x family, Claude 4.x family, Grok 4.x (4-fast / 4.20 / 4), Qwen 3.5 397B, Kimi K2.5, Nemotron Nano VL (with `:free` variants)

### Presets
- 🥇 Smart, 🥈 Smart-3, ⚡ Speed, 👑 Premium, 🪨 Stable, 🅰️ Anthropic (OR-only), 🤖 Grok (OR-only), 🤖 Grok Full (OR-only), 🆓 Free

### UI features
- Live cost + wall-clock elapsed time counter (ticking every 200ms during a run)
- 6 tabs: 📋 Critique, 📦 Svelte, 🎨 CSS, ⚙️ JS, 📄 HTML, 📝 Prompts (input+output with inline image thumbs), 🪵 Logs
- Score chart per epoch with 5 dimensions (structural / color / typography / spacing / completeness) + overall, clamped to 0–10
- History strip with click-to-restore for any past epoch (auto and 👤 manual feedback epochs marked separately)
- Manual feedback epoch with forced Gemini 3.1 Pro for final touches
- Pause button stops gracefully after the current epoch completes
- Lazy DOM rebuild for the Prompts pane (only when actively viewed)

### Parser robustness
- Handles markdown fenced blocks (with or without language tag)
- Tolerates indented fences inside numbered markdown lists
- Strips leading prose / chain-of-thought preamble
- Synthesizes missing svelte/html when only one block is provided
- Detects truncation (output ending mid-tag)
- Detailed parser notes in the logs for debugging

### Tooling
- `tools/check.mjs` — static analyzer: HTML structure, stray `</script>`, bracket balance, acorn parse, direct + indirect recursion (Tarjan SCC), DOM ID cross-check, src/js freshness
- `tools/lint.sh` — full pipeline (tsc + check + tests + ruff)
- `tests/run.mjs` — 38 unit tests for the parser functions, plain Node assertions, no test framework
- `.github/workflows/check.yml` — runs lint + tests + serve.py smoke test on every PR
