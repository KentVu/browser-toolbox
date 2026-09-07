# AGENTS

## Purpose
This repository is a browser extension template using React + TypeScript + Vite for Chrome and Firefox.
Use this file as the fast-start operating guide for coding agents.

## Start Here
- Project overview and setup flow: [README.md](README.md)
- Local notes and pending cleanup: [TODO.md](TODO.md)

## Preferred Stack and Active Tooling
- Language: TypeScript for new application code.
- UI: React function components under `src/pages`.
- Build: Vite configs (`vite.config.chrome.ts`, `vite.config.firefox.ts`, shared `vite.config.base.ts`).
- Test runner: Vitest (`vitest.config.ts`).

## Commands Agents Should Use
- Install deps: `npm install`
- Chrome dev watch build: `npm run dev`
- Firefox dev watch build: `npm run dev:firefox`
- Chrome production build: `npm run build`
- Firefox production build: `npm run build:firefox`
- Tests: `npm run test`

## File Placement Rules
- Add new features in modern code paths:
  - `src/pages/**` for extension pages (popup/background/content/options/newtab/devtools/panel)
  - `src/lib/**` for shared types/helpers used by modern TS code
- Treat `src/js/**` as legacy code. Do not add new features there unless the change is explicitly legacy-maintenance.
- Do not edit build outputs in `dist/` or `dist_chrome/`; regenerate via build/dev commands.

## TypeScript and Imports
- Respect strict TypeScript settings in `tsconfig.json`.
- Prefer path aliases when appropriate:
  - `@src/*` -> `src/*`
  - `@assets/*` -> `src/assets/*`
  - `@locales/*` -> `src/locales/*`
  - `@pages/*` -> `src/pages/*`

## Chrome API Usage
- Call native Chrome APIs only through the `ChromeApi` / `ChromeTabApi` wrapper in `src/lib/Chrome.ts`.
- Do not call `chrome.*` directly from UI or feature code (`src/pages/**`, etc.).
- In tests, mock `ChromeApi` (see `test/unit/MockChrome.ts`); do not mock the native `chrome` API directly, except when unit-testing the wrapper itself.

## Testing Conventions
- Use Vitest for tests run in this repo (`npm run test`).
- Write or update tests in `test/**` with `*.test.ts` or `*.test.tsx` naming.
- For React UI tests, use Testing Library patterns already present in `test/popup.test.tsx`.
- Obey TDD rules, write tests first, minimal production code later, refactor when green.

## Multi-Browser Notes
- Chrome and Firefox builds use separate Vite configs and manifests.
- Keep browser-specific behavior isolated and avoid assumptions that Chrome-only APIs behave identically in Firefox.

## Known Pitfalls
- `jest.config.js` and `webpack.config.js` exist but are not the primary dev/build/test path for current work.
- i18n support exists but is currently disabled by default (`localize = false` in `vite.config.base.ts`).

## Change Hygiene
- Keep changes minimal and focused; avoid repo-wide churn.
- If you touch behavior, add or update tests in `test/**` when practical.
- Prefer updating source files under `src/**`; avoid editing generated assets.
