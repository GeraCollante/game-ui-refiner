# Contributing to game-ui-refiner

Thanks for considering a contribution! This project is small, opinionated,
and aims to stay that way.

## Project philosophy

- **Single-page app**: one `index.html` + one `serve.py` + a handful of compiled JS modules. No bundlers, no Webpack, no Vite.
- **TypeScript with a thin build step**: `tsc` only. No transpilers, no Babel, no SWC.
- **Compiled output is committed**: `js/*.js` is in git so cloners can run with just `python3 serve.py` — no `npm install` required for end users.
- **No frontend framework**: no React, no Vue, no Svelte (ironic). Just vanilla DOM + Tailwind CDN. The whole point is to be readable in one sitting.
- **PRs that add a bundler, framework, or build step will be politely rejected** unless they solve a problem that can't be solved any other way.

## Local setup

```bash
git clone https://github.com/GeraCollante/game-ui-refiner
cd game-ui-refiner

# Set your API key
cp .env.example .env
$EDITOR .env  # add GEMINI_API_KEY=AIza...

# Run (no npm install needed if you only want to use it)
python3 serve.py
# Open http://localhost:8000
```

## Dev setup (if you want to edit the TS source)

```bash
# Install TypeScript and the analyzer's dependency (acorn)
npm install
cd tools && npm install && cd ..

# Edit src/*.ts, then build
npm run build      # one-shot compile
npm run watch      # auto-recompile on changes

# Run all checks
npm run lint
# Or individually:
npm run check      # static analyzer
npm test           # parser unit tests
ruff check serve.py
```

The `tools/lint.sh` script runs everything in order and is what CI executes.

## Code layout

```
src/
├── types.ts     # interfaces shared across modules
├── state.ts     # global mutable state (single source of truth)
├── config.ts    # model catalogs, presets, dimension colors
├── parser.ts    # pure functions: parseDualOutput, extractJson, etc.
├── api.ts       # provider clients (OpenRouter + Google), message builders
├── ui.ts        # everything DOM: tabs, chart, history, ticker, save, log
└── main.ts      # entry: runRefinement, runFeedbackEpoch, init
```

`tsc` compiles each `src/*.ts` to `js/*.js` (preserving the same filenames),
and `index.html` loads `js/main.js` as `<script type="module">`. The browser
handles the rest natively — no bundler.

## Before submitting a PR

1. Make sure `npm run lint` passes (it runs all 4 checks).
2. If you added a function with non-trivial logic, add a test in `tests/run.mjs`.
3. If you changed the message builders or model catalogs, run a real refinement against a test image to verify nothing broke.
4. Don't commit `.env`, `runs/`, or `node_modules/`.
5. Keep commit messages descriptive — what + why.

## What kind of contributions are welcome

- **Bug fixes**: especially in the parser (the LLM output is messy and we keep finding edge cases)
- **New providers**: adding e.g. Anthropic Direct or AWS Bedrock alongside OpenRouter and Google
- **More presets**: well-justified pairings of (critic, generator) for specific use cases
- **Better save formats**: e.g. exporting a full session as a single zip or HTML report
- **Real e2e tests**: a smoke test that loads the page in headless Chromium and checks for console errors

## What kind of contributions will probably be rejected

- "Refactor everything to use [framework X]"
- Adding a new dependency just for one helper function
- Cosmetic-only formatting changes (the code is intentionally a bit terse)
- Commented-out code or TODO comments without an issue

## Issues

Open an issue if you find a bug. Please include:
- Provider used (Google or OpenRouter)
- Models used (critic + generator)
- The target image (if you can share it)
- A copy of the relevant section of the **🪵 Logs** tab
- Browser + OS

For security issues (e.g. a way to leak API keys), email instead of opening a public issue.
