# Preact conversion plan

Popup open time is dominated by React 19 parse/execute, then by Chrome tab
fetch after first paint. Convert the UI to native Preact and drop Zustand so
we do not need `preact/compat`.

Each implementation step below is one commit. Keep tests green after every
step.

## Why

- [src/pages/popup/index.html](src/pages/popup/index.html) is an empty shell.
- [src/pages/popup/index.tsx](src/pages/popup/index.tsx) boots `react-dom/client`.
- [TabList](src/pages/popup/TabList.tsx) fetches tabs in `useEffect` after mount.

Preact (~4KB) vs React 19 (~40KB+ gzipped) should shrink time-to-first-paint.
Chrome `tabs` / `storage` latency is separate; step 4 overlaps that with paint.

## Constraints

- [PopupPresenter](src/pages/popup/PopupPresenter.ts) owns popup state.
  Tests call `s()` / `setState()` / `onKeyPress()` without mounting UI.
  Do **not** move source of truth into view `useState`.
- Zustand is only a subscription bus (`getState` / `setState` / selector
  hooks). `combine` / `ExtractState` / `usePopupStore` are unused leftovers.
- Zustand imports `react`, so keeping it would force `preact/compat`.
- Plain hooks work in Preact (`useEffect`, `useRef`, `useSyncExternalStore`).
- Do not introduce `simpler-state` or Signals.

## Step 1 — Document this plan

Write this file. No code changes.

## Step 2 — Replace Zustand with `useSyncExternalStore`

Keep React for this commit.

- Presenter holds a `PopupState` snapshot and a listener set.
- `setState` must replace the snapshot (new object), not mutate in place,
  so `useSyncExternalStore` re-renders.
- Keep `s()` and `setState()` behavior, including closing help when
  `selectedTabId` changes.
- Replace the ten `useX` selector hooks with one `usePopupState()`.
- [TabList](src/pages/popup/TabList.tsx) reads that snapshot and uses the
  already-exported `visibleTabs` / `pageCount` helpers.
- Delete leftover `usePopupStore`.
- Remove the `zustand` dependency.

Verify: `npm run test`.

## Step 3 — Convert the UI stack to native Preact

One commit, tree stays green.

**Add:** `preact`, `@preact/preset-vite`, `@testing-library/preact`  
**Remove:** `react`, `react-dom`, `@types/react`, `@types/react-dom`,
`@vitejs/plugin-react`, `@testing-library/react`

- [vite.config.base.ts](vite.config.base.ts): `preact()` instead of `react()`.
- [vitest.config.ts](vitest.config.ts): same preset (or equivalent JSX source).
- [tsconfig.json](tsconfig.json): `"jsx": "react-jsx"`, `"jsxImportSource": "preact"`.
- [src/global.d.ts](src/global.d.ts): drop React SVG types.
- Page entries (`popup`, `options`, `newtab`, `panel`): `render()` from `preact`.
- Components: `preact/hooks` where needed; remove unused `import React`.
- [PopupPresenter](src/pages/popup/PopupPresenter.ts): `useSyncExternalStore`
  from `preact/hooks`.
- Tests: `@testing-library/preact`; `ComponentChildren` instead of
  `React.ReactNode`.
- Content-script sample comment: Preact `render` or delete.

Do not use `preact/compat` aliases. Native imports only.

Verify: `npm run test`, `npm run build`. Popup chunks must not contain
`react-dom`.

## Step 4 — Start `fetchTabList()` at popup boot

- Kick off `presenter.fetchTabList()` in
  [src/pages/popup/index.tsx](src/pages/popup/index.tsx) **without awaiting**
  it before `render()`.
- Coalesce in-flight fetches so TabList/tests can still call `fetchTabList()`
  without a duplicate Chrome round-trip.
- Keep the TabList `useEffect` fetch (tests render `Popup`, not `index.tsx`).

Verify: `npm run test`. Manual: popup still lists tabs, search, and shortcuts.

## Step 5 — Update project docs

- [AGENTS.md](AGENTS.md): Preact pages, Testing Library Preact, no React.
- [README.template.md](README.template.md) and [package.json](package.json)
  description: Preact instead of React 19.
- Point at this plan from [TODO.md](TODO.md).

## Out of scope

- Measuring latency in CI (do it locally before/after if needed).
- Static HTML placeholder in the popup.
- Removing unused template pages (newtab / options / panel).
- Firefox-only behavior changes (smoke `npm run build:firefox` once).
