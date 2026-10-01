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

- [x] On tablist page, press `/` key. An indicator showing we're in search mode (Something start with `/` like vim).
- [x] Follow input keys are treated as search string until the `Enter` key, the search string is displayed in the indicator, if there's a match: highlight that matched part of the tab item, and jump (select) that item.
- [x] `Backspace` deletes the last query character; on an empty query it exits search mode.
- [x] The `enter` key ends search mode.
- [x] Subsequent `n` key jump to next match item and highlight the matched part.
- [x] Highlight clears when another key changes selection; last search query is retained so `n` still works.
- [x] Search should be case-insensitive.

## todo-search

- [ ] Search backward with `N` (Shift-n)

# Big refactoring: Move tab management into a mode, give way for next big new feature...

... that's: (drums roll...): scroll-sync!!!!

# TODO

- [ ] Eliminate duplicates in UI Text by introducing i18n.
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
- [x] `{`/`}` move selected tab left/right of active tab without activating or closing the popup.
- [x] Indicator for duplicated tab.
- [x] Legend box (for split-tab, other-window icons etc.).
- [x] chore: remove legacy code paths.
- [ ] Support navigating between search match while typing in search (in search mode). (While in search mode, up/down navigating between current matches)
- [x] ESC in popup?

# Bugs

1. [x] If there're matches on other pages, also switch to that page too.