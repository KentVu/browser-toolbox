Chrome extension that helps navigating and organizing tabs, other utilities that I found useful for productivity.

# Audiences

Keyboard-heavy users, vim users. Aiding web browsing by maximizing keyboard usage.

# Activate

- Default shortcut: **Alt+O** (macOS suggested: **Command+B**)
- Or click the extension toolbar icon
- Remap anytime in `chrome://extensions/shortcuts`

# Behaviors

## Tab list

- Shows open tabs from **all windows**, sorted by **most recently accessed** first
- On open, selects the **previously visited** tab (not the current one)
- Each visible row shows:
  - Favicon (or a placeholder)
  - Title and hostname
  - A letter shortcut for that slot on the current page
  - Split-view badge (`🔗N`) when the tab is in a split view
  - Window badge (`🪟N`) when the tab is in another window

## Pagination

- Tabs are shown **10 per page**
- Letter shortcuts are **slot-stable**: the same key maps to the same position on every page

## Keyboard shortcuts (in the popup)

| Key | Action |
|---|---|
| Letter shortcut (`a`, `s`, `d`, …) | Select the tab in that slot on the current page |
| `j` / `↓` | Move selection down; at the last item, go to the **next page** and select its first item |
| `k` / `↑` | Move selection up; at the first item, go to the **previous page** and select its last item |
| `J` / `PageDown` | Jump to the **last** item on the page; if already there, go to the **next page** |
| `K` / `PageUp` | Jump to the **first** item on the page; if already there, go to the **previous page** |
| `,` | Go to the **previous page** |
| `.` | Go to the **next page** |
| `Enter` | Activate the selected tab and close the popup |
| `Ctrl`+`w` | Close the selected tab, refresh the list, and keep the popup open |
| `Ctrl`+`c` | Copy the selected tab's URL |
| `]` | Move the selected tab to the **right** of the current tab, activate it, and close the popup |
| `[` | Move the selected tab to the **left** of the current tab, activate it, and close the popup |

Clicking a row selects that tab (does not activate it).
