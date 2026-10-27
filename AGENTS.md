# AGENTS

## Purpose
This repository is a browser extension template using Preact + TypeScript + Vite for Chrome and Firefox.
Use this file as the fast-start operating guide for coding agents.

## Start Here
- Project overview and setup flow: [README.template.md](README.template.md)
- Pending TODO: [TODO.md](TODO.md)
- Preact conversion plan: [PREACT-PLAN.md](PREACT-PLAN.md)

## Preferred Stack and Active Tooling
- Language: TypeScript for new application code.
- UI: Preact function components under `src/pages` (`jsxImportSource`: `preact`).
- Popup state: presenter-owned snapshot + `useSyncExternalStore` in [src/pages/popup/PopupPresenter.ts](src/pages/popup/PopupPresenter.ts). Do not add Zustand or `preact/compat`.
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
- Do not edit build outputs in `dist/` or `dist_chrome/`; regenerate via build/dev commands.

## TypeScript and Imports
- Respect strict TypeScript settings in `tsconfig.json`.
- Prefer path aliases when appropriate:
  - `@src/*` -> `src/*`
  - `@assets/*` -> `src/assets/*`
  - `@locales/*` -> `src/locales/*`
  - `@pages/*` -> `src/pages/*`

## Chrome / Browser API Usage
- Call native Chrome APIs only through the `ChromeApi` / `ChromeTabApi` wrapper in `src/lib/Chrome.ts`.
- Call browser APIs (e.g. clipboard) through the `BrowserApi` wrapper in `src/lib/Browser.ts`.
- Do not call `chrome.*` or `navigator.clipboard` directly from UI or feature code (`src/pages/**`, etc.).
- In tests, mock `ChromeApi` / `BrowserApi` (see `test/unit/MockChrome.ts`, `test/unit/MockBrowser.ts`); do not mock the native APIs directly, except when unit-testing the wrappers themselves.

## Testing Conventions
- Use Vitest for tests run in this repo (`npm run test`).
- Write or update tests in `test/**` with `*.test.ts` or `*.test.tsx` naming.
- For Preact UI tests, use Testing Library patterns already present in `test/unit/popup.test.tsx` (`@testing-library/preact`).
- Obey TDD rules, write tests first, minimal production code later, refactor when green.
- Commit behavior changes with the git scheme below. Full steps: [.github/instructions/tdd-git.instructions.md](.github/instructions/tdd-git.instructions.md).

## Git scheme

For a behavior change:

1. Branch from the default branch. Do not commit the work directly on it.
2. `[red]` failing tests. Push that commit and open a pull request into the default branch so GitHub Actions runs. Wait until the failing result is recorded on the pull request before continuing. That failure is expected.
3. `[green]` the code that makes the tests pass, then `[refactor]` cleanup while they stay green.
4. Merge back with `git merge --no-ff` so the default branch gets a merge commit that lists those steps.
5. Push the feature branch and the default branch without rewriting history.

After the user confirms the pull request is open, push each commit separately. Ask the user before every push.

Do not squash, rebase, or force-push this history away. Leave the pull request and its red check on GitHub.

## Multi-Browser Notes
- Chrome and Firefox builds use separate Vite configs and manifests.
- Keep browser-specific behavior isolated and avoid assumptions that Chrome-only APIs behave identically in Firefox.

## Popup tab indicators

The tab list lives in [src/pages/popup/TabList.tsx](src/pages/popup/TabList.tsx). Badges come from `getTabBadges` and the footer legend from `INDICATOR_LEGEND` (only entries visible on the current page).

- **Current tab** (focused window): `ChromeTabApi.getCurrent()` in [src/lib/Chrome.ts](src/lib/Chrome.ts) queries `{ active: true, lastFocusedWindow: true }`. [src/pages/popup/PopupPresenter.ts](src/pages/popup/PopupPresenter.ts) stores that tab’s `id` as `currentTabId` and its `windowId` as `currentWindowId`. The matching row gets a bright cyan `●` (`text-cyan-300`, aria-label `Current tab`), `aria-current="true"`, and the `.current` inset bar in [src/pages/popup/index.css](src/pages/popup/index.css). Legend: `● current`. It is emphasized, not selected, by default.
- **Other windows:** every tab whose `windowId` differs from `currentWindowId` gets `🪟N` (`Window N`), numbered from sorted window ids on the visible page. That marks the whole window, not its active tab. Legend: `🪟 other window`.
- **Active in another window:** Chrome’s `tab.active` means “active in its own window” (one per window). [src/lib/Tab.ts](src/lib/Tab.ts) stores it, and `DefaultTabs.toTab()` copies it. When `tab.active` is set and `tab.windowId !== currentWindowId`, the row shows the same `●` dimmed (`text-cyan-300/40`, aria-label `Active in other window`). Legend: `● active elsewhere`. Inactive tabs in that window stay unmarked. The bright `●` stays exclusive to `currentTabId`. Popup tests pass `Tab` objects through `createMockChromeApi` and do not hit `toTab`; the mapping is covered in [test/unit/Chrome.test.ts](test/unit/Chrome.test.ts).

## Known Pitfalls
- i18n support exists but is currently disabled by default (`localize = false` in `vite.config.base.ts`).

## Change Hygiene
- Keep changes minimal and focused; avoid repo-wide churn.
- If you touch behavior, add or update tests in `test/**` when practical.
- Prefer updating source files under `src/**`; avoid editing generated assets.
