# Plan

Ken is a productive person, he always wants to boost his productivity.
He's a heavy keyboard user, he rarely touches his mouse, so he wants
to work with his browser (Chrome) entirely on keyboard.

When working with several related tabs, he wants to bring them closely together, here's how he'll want to do that using the keyboard:

1. [x] Activate this extension.
1. [x] He sees a list of all tabs in all windows, each tab item is marked with a key that can be pressed on the keyboard.
1. [x] He presses a key corresponding to a tab item to select it.
1. [x] A list of next possible actions is displayed, with `]` corresponds to: place the selected tab next to the current one.
1. [x] He presses `]` and sees the selected tab is placed next to the current one.
1. [x] He is brought to that tab.
1. [x] The extension's popup is closed automatically.

# Search flow:

- [x] On Tab Management page, press `/` key. An indicator showing we're in search mode (Something start with `/` like vim).
- [x] `/` starts with an empty query; do not prefill `lastSearchQuery`.
- [x] Follow input keys are treated as search string until the `Enter` key, the search string is displayed in the indicator, if there's a match: highlight that matched part of the tab item, and jump (select) that item.
- [x] `Backspace` deletes the last query character; on an empty query it exits search mode.
- [x] `Ctrl-W` / `Ctrl-Backspace` in search mode clears the query.
- [x] `Enter` on an empty search prompt fills `lastSearchQuery` and selects the first match (stay in search mode).
- [x] `Enter` on a non-empty query ends search mode.
- [x] Subsequent `n` key jump to next match item and highlight the matched part.
- [x] Highlight clears when another key changes selection; last search query is retained so `n` still works.
- [x] Search should be case-insensitive.
- [x] A non-empty query with no title or hostname hit shows `no matches` on the search indicator. An empty `/` does not.

## todo-search

_(items moved to Features (Behaviour) / Search enhancements below)_

# Big refactoring: Move tab management into a mode, give way for next big new feature...

... that's: (drums roll...): scroll-sync!!!!

# TODO

## Features (Behaviour)

- [ ] Eliminate duplicates in UI Text by introducing i18n.
- [ ] Support navigating between search match while typing in search (in search mode). (While in search mode, up/down navigating between current matches)
- [ ] `(`, `)` move **current tab** next to left/right of selected tab.

### Search enhancements
- [ ] Search backward with `N` (Shift-n)

### Completed (historical)
- [x] Tab should be sorted most recent tab first.
- [x] Pagination.
- [x] j/k for moving up/down the tab list.
- [x] Search using `/` key.
- [x] Should maintain current page after closing.
- [x] Move the behaviour of `,`/`.` to `J`/`K` (Shift-j/k), `,`/`.` remain simply prev/next page.
- [x] Move shortcut help into a floating element??
- [x] Toggle instructions by `?`.
- [x] Also support searching the hostname too.
- [x] prev/next page by left/right arrow also.
- [x] Move current tab left/right by `<`, `>`.
- [x] `{`/`}` move the selected tab left/right without closing the popup.
- [x] Indicator for duplicated tab.
- [x] Legend box (for split-tab, other-window icons etc.).
- [x] Emphasize the current tab in the list.
- [x] chore: remove legacy code paths.
- [x] ESC in popup?

## Refactorings

- [ ] Derive popup shortcut help from `shortcutActionByKey` (remove manual duplication in TabManagement.tsx)
  - Goal: make the help list in `TabManagement.tsx:332` (the `<ul>` of `<kbd>`+descriptions) be generated from (or validated against) the same data that powers key resolution.
  - Current state: help text is hand-written and must be updated manually when keys or descriptions change (see recent Alt+]/Alt+[ addition).
  - Files: `src/pages/popup/TabManagementPresenter.ts` (source of `shortcutActionByKey` + `ShortcutAction`), `src/pages/popup/TabManagement.tsx` (render), tests that assert on help text (`test/unit/popup.test.tsx` around help queries).
  - Challenges: help entries carry human descriptions and grouping (e.g., some are grouped with Alt/Shift notes). Need a way to attach optional `helpText` (and maybe `helpGroup`) per action or per key without making the keymap noisy.
  - Approaches to consider:
    - Add a parallel `helpByAction: Partial<Record<ShortcutAction, string>>` (or richer struct) and a small renderer that walks the map.
    - Introduce a `ShortcutBinding[]` (see below) that includes `{key, action, help?: string}`.
    - Keep a small curated help order array that references actions and pulls labels from a central map.
  - Acceptance: adding or renaming a shortcut + its help description touches only one authoritative place; help tests still pass; no drift between actual keys and documented keys.
  - Out of scope for this item: i18n of the help text itself.

- [ ] Unify `shortcutActionByKey` and dispatch (done) — still listed for bookkeeping; consider a declarative `ShortcutBinding[]` later
  - Current state (post place-beside-active green+refactor): `shortcutActionByKey` is the single source of truth for key → `ShortcutAction`. `BrowseKeyMode.handle` calls `resolveShortcutAction` then a type-safe `dispatch(action)` switch (no more parallel `actions` record).
  - Files: `src/pages/popup/TabManagementPresenter.ts:43` (`shortcutActionByKey`), `resolveShortcutAction`, `dispatch` (switch on 23 cases), `Popup.tsx:26` (key construction for ctrl/alt/shift).
  - Remaining bookkeeping / next step:
    - Evaluate extracting a single `type ShortcutBinding = { key: string; action: ShortcutAction; handler: (ctx: ...) => KeyResult | Promise<KeyResult> }` or `description?: string`.
    - Benefits would be: one list drives resolve map, dispatch, help generation, and possibly tests.
    - Tradeoff: current switch is simple, exhaustive by TypeScript, and easy to debug; a registry might require indirection or builder functions for the handlers (which are currently `this.xxx()` methods).
    - Only pursue if it reduces the switch size or enables help generation without adding much complexity.
  - Do not change `ShortcutAction` union naming or the existing long action names unless a clear win.

- [ ] Collapse the three near-identical "move selected" methods (moveAndActivate, move, besideActive) behind a shared helper
  - Goal: reduce boilerplate in the three methods that all do "get selectedTabId, if defined, do something, return 'handled'".
  - Files: `src/pages/popup/TabManagementPresenter.ts` around the move methods (currently using `withSelectedTabId` for five actions, but not these three):
    - `moveSelectedAndActivate` (calls `tabs.move`, then `activate`, then `closePopup`)
    - `moveSelectedTab` (calls `tabs.shift`)
    - `moveSelectedBesideActive` (calls `tabs.move`)
  - Already extracted: `withSelectedTabId(action)` helper (used by activate, break, close, copy/paste remain different, and the three move variants).
  - Approach options:
    - Extend `withSelectedTabId` to accept an options object or a strategy: `{ direction, api: 'shift'|'move', activateAfter?: boolean, closeAfter?: boolean }`.
    - Or a thin `performSelectedMove(direction, kind: 'shift'|'moveBeside'|'moveAndActivate')` that centralizes the guard + the small differences.
  - Constraints:
    - Keep `moveSelectedAndActivate` semantics (must activate + close popup).
    - Preserve the distinct comments and behavior notes.
    - Keep call sites in `dispatch` (or the actions wiring) readable.
    - Tests: existing move-selected tests (`expectMoveSelectedTab`, Alt-] tests, 'already active tab' tests) must stay green.
  - Scope: only the three selected-tab move helpers. Do not touch `moveCurrentTab` (which uses `getCurrent` not `selectedTabId`).
  - Acceptance: the three methods become thin wrappers (1-3 lines each) or disappear entirely; no behavior change; no increase in test fragility.

## Bugs

1. [x] If there're matches on other pages, also switch to that page too.