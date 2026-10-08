import type { BrowserApi } from '@src/lib/Browser';
import { ChromeApi } from '@src/lib/Chrome';
import { PAGE_SIZE, shortcutKeys } from '@src/lib/constants';
import type { Tab } from '@src/lib/Tab';
import { hostnameOf, tryParseHttpUrl } from '@src/lib/Util';
import { useLayoutEffect, useState } from 'preact/hooks';

export const PASTE_URL_ERROR = 'Not a URL to paste!';
const LAST_SEARCH_QUERY_KEY = 'lastSearchQuery';

export type ShortcutAction =
  | 'enterSearch'
  | 'toggleShortcutHelp'
  | 'nextSearchMatch'
  | 'previousPage'
  | 'nextPage'
  | 'moveCurrentTabRight'
  | 'moveCurrentTabLeft'
  | 'moveSelectedTabRightAndActivate'
  | 'moveSelectedTabLeftAndActivate'
  | 'moveSelectedTabBesideActiveRight'
  | 'moveSelectedTabBesideActiveLeft'
  | 'breakSelectedTabIntoWindow'
  | 'activateSelectedTab'
  | 'closeSelectedTab'
  | 'copySelectedTabUrl'
  | 'pasteUrlIntoSelectedTab'
  | 'jumpToLastTab'
  | 'jumpToFirstTab'
  | 'moveSelectionDown'
  | 'moveSelectionUp';

const shortcutActionByKey: Record<string, ShortcutAction> = {
  '/': 'enterSearch',
  '?': 'toggleShortcutHelp',
  n: 'nextSearchMatch',
  ',': 'previousPage',
  arrowleft: 'previousPage',
  '.': 'nextPage',
  arrowright: 'nextPage',
  '>': 'moveCurrentTabRight',
  '<': 'moveCurrentTabLeft',
  ']': 'moveSelectedTabRightAndActivate',
  '[': 'moveSelectedTabLeftAndActivate',
  '}': 'moveSelectedTabBesideActiveRight',
  '{': 'moveSelectedTabBesideActiveLeft',
  '!': 'breakSelectedTabIntoWindow',
  enter: 'activateSelectedTab',
  'ctrl+w': 'closeSelectedTab',
  'ctrl+c': 'copySelectedTabUrl',
  'ctrl+v': 'pasteUrlIntoSelectedTab',
  J: 'jumpToLastTab',
  pagedown: 'jumpToLastTab',
  K: 'jumpToFirstTab',
  pageup: 'jumpToFirstTab',
  j: 'moveSelectionDown',
  arrowdown: 'moveSelectionDown',
  k: 'moveSelectionUp',
  arrowup: 'moveSelectionUp',
};

export function resolveShortcutAction(key: string): ShortcutAction | undefined {
  return shortcutActionByKey[key];
}

export class PopupState {
  tabList: Tab[] = [];
  tabKeyMap: Map<number, string> = new Map();
  selectedTabId: number | undefined;
  currentTabId: number | undefined;
  currentWindowId: number | undefined;
  pageIndex = 0;
  errorMessage: string | undefined;
  /** `undefined` means not in search mode; otherwise the current query (may be empty). */
  searchQuery: string | undefined;
  /** Retained after leaving search mode so `n` can jump to the next match. */
  lastSearchQuery: string | undefined;
  /** Query used to render `<mark>` on the selected match outside active typing. */
  highlightQuery: string | undefined;
  /** Whether the floating shortcut help overlay is visible. */
  showHelp = false;
}

/**
 * Business logic layer for the popup UI.
 *
 * Mediates between Preact views and ChromeApi/BrowserApi: owns popup state
 * (tab list, selection, pagination, shortcut map), loads tabs, and handles
 * keyboard navigation, activation, clipboard, and tab moves. Views subscribe
 * via usePopupState and stay presentational.
 */
export class PopupPresenter {
  private state: PopupState = new PopupState();
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly chrome: ChromeApi,
    private readonly browser: BrowserApi,
  ) {
  }

  s = (): PopupState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  setState = (state: Partial<PopupState>) => {
    const selectedChanged =
      'selectedTabId' in state
      && state.selectedTabId !== this.state.selectedTabId;
    const next = Object.assign(new PopupState(), this.state, state);
    // Close floating help whenever the selected tab actually changes.
    if (selectedChanged && state.showHelp === undefined) {
      next.showHelp = false;
    }
    this.state = next;
    for (const listener of this.listeners) {
      listener();
    }
  };

  usePopupState = (): PopupState =>
    useSyncExternalStore(this.subscribe, this.s);

  async fetchTabList(options?: { preservePage?: boolean }) {
    const [_tabs, currentTab, savedSearchQuery] = await Promise.all([
      this.chrome.tabs.getByLastAccessed(),
      this.chrome.tabs.getCurrent(),
      this.chrome.storage.getLocal<string>(LAST_SEARCH_QUERY_KEY),
    ]);
    const maxPage = pageCount(_tabs) - 1;
    const pageIndex = options?.preservePage
      ? Math.min(this.s().pageIndex, maxPage)
      : 0;
    // Prefer the tab visited before the current one (second most recently accessed).
    const previousTab = _tabs.find(tab => tab.id !== currentTab?.id) ?? currentTab;
    this.setState({
      tabList: _tabs,
      pageIndex,
      tabKeyMap: genTabKeyMap(visibleTabs(_tabs, pageIndex).map(tab => tab.id)),
      selectedTabId: previousTab?.id,
      currentTabId: currentTab?.id,
      currentWindowId: currentTab?.windowId,
      lastSearchQuery: savedSearchQuery || undefined,
    });
  }

  async onKeyPress(key: string): Promise<void> {
    const s = this.s();
    const action = resolveShortcutAction(key);
    if (s.errorMessage !== undefined) {
      this.setState({ errorMessage: undefined });
    }

    if (action === 'enterSearch' && s.searchQuery === undefined) {
      this.setState({ searchQuery: '', showHelp: false });
      return;
    }

    if (s.searchQuery !== undefined) {
      if (key === 'enter' || key === 'ctrl+enter') {
        if (key === 'enter' && s.searchQuery.length === 0 && s.lastSearchQuery) {
          const searchQuery = s.lastSearchQuery;
          const match = findTabMatch(s.tabList, searchQuery);
          this.selectSearchMatch(match, {
            searchQuery,
            highlightQuery: searchQuery,
          });
          return;
        }
        const match = key === 'ctrl+enter'
          ? findTabMatch(s.tabList, s.searchQuery)
          : undefined;
        const nextLastSearchQuery = s.searchQuery || s.lastSearchQuery;
        this.setState({
          lastSearchQuery: nextLastSearchQuery,
          searchQuery: undefined,
          highlightQuery: undefined,
        });
        if (match) {
          await this.chrome.tabs.activate(match.id);
          this.chrome.closePopup();
        }
        return;
      }
      if (key === 'escape') {
        if (s.searchQuery.length === 0) {
          this.setState({
            lastSearchQuery: undefined,
            searchQuery: undefined,
            highlightQuery: undefined,
          });
          await this.chrome.storage.setLocal(LAST_SEARCH_QUERY_KEY, '');
          return;
        }
        const nextLastSearchQuery = s.searchQuery || s.lastSearchQuery;
        this.setState({
          lastSearchQuery: nextLastSearchQuery,
          searchQuery: undefined,
          highlightQuery: undefined,
        });
        return;
      }
      if (key === 'ctrl+w' || key === 'ctrl+backspace') {
        this.setState({
          lastSearchQuery: undefined,
          searchQuery: '',
          highlightQuery: undefined,
        });
        await this.chrome.storage.setLocal(LAST_SEARCH_QUERY_KEY, '');
        return;
      }
      if (key === 'backspace') {
        if (s.searchQuery.length === 0) {
          this.setState({
            lastSearchQuery: undefined,
            searchQuery: undefined,
            highlightQuery: undefined,
          });
          await this.chrome.storage.setLocal(LAST_SEARCH_QUERY_KEY, '');
          return;
        }
        const searchQuery = s.searchQuery.slice(0, -1);
        const match = findTabMatch(s.tabList, searchQuery);
        this.selectSearchMatch(match, {
          searchQuery,
          highlightQuery: searchQuery || undefined,
        });
        await this.chrome.storage.setLocal(LAST_SEARCH_QUERY_KEY, searchQuery);
        return;
      }
      if (key.length === 1) {
        const searchQuery = s.searchQuery + key;
        const match = findTabMatch(s.tabList, searchQuery);
        this.selectSearchMatch(match, {
          searchQuery,
          highlightQuery: searchQuery,
        });
        await this.chrome.storage.setLocal(LAST_SEARCH_QUERY_KEY, searchQuery);
      }
      return;
    }

    if (key === 'escape' && s.showHelp) {
      this.setState({ showHelp: false });
      return;
    }

    switch (action) {
      case 'toggleShortcutHelp':
        this.setState({ showHelp: !s.showHelp });
        return;
      case 'nextSearchMatch':
        if (s.lastSearchQuery) {
          const match = findNextTabMatch(s.tabList, s.lastSearchQuery, s.selectedTabId);
          if (match) {
            this.selectSearchMatch(match, { highlightQuery: s.lastSearchQuery });
          }
          return;
        }
        break;
      case 'previousPage':
        this.changePage(-1);
        return;
      case 'nextPage':
        this.changePage(1);
        return;
      case 'moveCurrentTabRight':
      case 'moveCurrentTabLeft': {
        const currentTabId = (await this.chrome.tabs.getCurrent())?.id;
        if (currentTabId !== undefined) {
          const direction = action === 'moveCurrentTabRight' ? 'toTheRight' : 'toTheLeft';
          // Do not activate after move: activate() focuses the browser window and
          // Chrome auto-closes the popup when focus leaves it.
          await this.chrome.tabs.move(direction, currentTabId);
        }
        return;
      }
      case 'moveSelectedTabRightAndActivate':
      case 'moveSelectedTabLeftAndActivate':
        if (s.selectedTabId !== undefined) {
          const tabId = s.selectedTabId;
          const direction = action === 'moveSelectedTabRightAndActivate' ? 'toTheRight' : 'toTheLeft';
          await this.chrome.tabs.move(direction, tabId);
          await this.chrome.tabs.activate(tabId);
          this.chrome.closePopup();
        }
        return;
      case 'moveSelectedTabBesideActiveRight':
      case 'moveSelectedTabBesideActiveLeft':
        if (s.selectedTabId !== undefined) {
          const currentTabId = (await this.chrome.tabs.getCurrent())?.id ?? s.currentTabId;
          // Inactive when the selected tab is already the active tab.
          if (currentTabId === undefined || s.selectedTabId !== currentTabId) {
            const direction = action === 'moveSelectedTabBesideActiveRight' ? 'toTheRight' : 'toTheLeft';
            // Do not activate after move: activate() focuses the browser window and
            // Chrome auto-closes the popup when focus leaves it.
            await this.chrome.tabs.move(direction, s.selectedTabId);
          }
        }
        return;
      case 'breakSelectedTabIntoWindow':
        if (s.selectedTabId !== undefined) {
          await this.chrome.tabs.breakIntoNewWindow(s.selectedTabId);
          this.chrome.closePopup();
        }
        return;
      case 'activateSelectedTab':
        if (s.selectedTabId !== undefined) {
          await this.chrome.tabs.activate(s.selectedTabId);
          this.chrome.closePopup();
        }
        return;
      case 'closeSelectedTab':
        if (s.selectedTabId !== undefined) {
          await this.chrome.tabs.close(s.selectedTabId);
          await this.fetchTabList({ preservePage: true });
        }
        return;
      case 'copySelectedTabUrl':
        if (s.selectedTabId !== undefined) {
          const selectedTab = s.tabList.find(tab => tab.id === s.selectedTabId);
          if (selectedTab?.url) {
            await this.browser.clipboard.writeText(selectedTab.url);
          }
        }
        return;
      case 'pasteUrlIntoSelectedTab':
        if (s.selectedTabId !== undefined) {
          const clipboardText = await this.browser.clipboard.readText();
          const url = tryParseHttpUrl(clipboardText);
          if (!url) {
            this.setState({ errorMessage: PASTE_URL_ERROR });
            return;
          }

          const tabId = s.selectedTabId;
          await this.chrome.tabs.updateUrl(tabId, url);
          this.setState({
            errorMessage: undefined,
            tabList: s.tabList.map(tab => (tab.id === tabId ? { ...tab, url } : tab)),
          });
        }
        return;
      case 'jumpToLastTab':
        this.jumpToPageEdgeOrChangePage('last');
        return;
      case 'jumpToFirstTab':
        this.jumpToPageEdgeOrChangePage('first');
        return;
      case 'moveSelectionDown':
        this.moveSelection(1);
        return;
      case 'moveSelectionUp':
        this.moveSelection(-1);
        return;
      case 'enterSearch':
        return;
      default:
        break;
    }

    const tabId = this.tabIdForKey(key);
    if (tabId === undefined) {
      return;
    }
    this.setState({ selectedTabId: tabId, highlightQuery: undefined });
  }

  /**
   * Select a search match and switch to its page when needed.
   * Extra state (query/highlight) is merged in either case.
   */
  selectSearchMatch(match: Tab | undefined, extra: Partial<PopupState> = {}): void {
    if (!match) {
      this.setState(extra);
      return;
    }

    const s = this.s();
    const matchIndex = s.tabList.findIndex(tab => tab.id === match.id);
    const pageIndex = matchIndex >= 0 ? Math.floor(matchIndex / PAGE_SIZE) : s.pageIndex;
    if (pageIndex === s.pageIndex) {
      this.setState({
        ...extra,
        selectedTabId: match.id,
      });
      return;
    }

    this.setState({
      ...extra,
      selectedTabId: match.id,
      pageIndex,
      tabKeyMap: genTabKeyMap(visibleTabs(s.tabList, pageIndex).map(tab => tab.id)),
    });
  }

  /**
   * Move selection within the currently visible page.
   * At the page edge, advances to the next/previous page and selects the first/last item there.
   * Clamps when there is no adjacent page.
   */
  moveSelection(delta: number): void {
    const s = this.s();
    const pageTabs = visibleTabs(s.tabList, s.pageIndex);
    if (pageTabs.length === 0) {
      return;
    }

    const currentIndex = pageTabs.findIndex(tab => tab.id === s.selectedTabId);
    if (currentIndex === -1) {
      const nextIndex = delta > 0 ? 0 : pageTabs.length - 1;
      this.setState({ selectedTabId: pageTabs[nextIndex].id, highlightQuery: undefined });
      return;
    }

    const nextIndex = currentIndex + delta;
    if (nextIndex >= 0 && nextIndex < pageTabs.length) {
      this.setState({ selectedTabId: pageTabs[nextIndex].id, highlightQuery: undefined });
      return;
    }

    const pageDelta = delta > 0 ? 1 : -1;
    const maxPage = pageCount(s.tabList) - 1;
    const pageIndex = Math.min(maxPage, Math.max(0, s.pageIndex + pageDelta));
    if (pageIndex === s.pageIndex) {
      return;
    }

    const newPageTabs = visibleTabs(s.tabList, pageIndex);
    const edgeIndex = delta > 0 ? 0 : newPageTabs.length - 1;
    this.setState({
      pageIndex,
      tabKeyMap: genTabKeyMap(newPageTabs.map(tab => tab.id)),
      selectedTabId: newPageTabs[edgeIndex].id,
      highlightQuery: undefined,
    });
  }

  /**
   * Jump selection to the first/last item on the current page.
   * If already there, switch to the previous/next page.
   */
  jumpToPageEdgeOrChangePage(edge: 'first' | 'last'): void {
    const s = this.s();
    const pageTabs = visibleTabs(s.tabList, s.pageIndex);
    if (pageTabs.length === 0) {
      return;
    }

    const edgeIndex = edge === 'first' ? 0 : pageTabs.length - 1;
    const edgeTabId = pageTabs[edgeIndex].id;
    if (s.selectedTabId !== edgeTabId) {
      this.setState({ selectedTabId: edgeTabId, highlightQuery: undefined });
      return;
    }

    this.changePage(edge === 'first' ? -1 : 1);
  }

  changePage(delta: number): void {
    const s = this.s();
    const maxPage = pageCount(s.tabList) - 1;
    const pageIndex = Math.min(maxPage, Math.max(0, s.pageIndex + delta));
    if (pageIndex === s.pageIndex) {
      return;
    }
    this.setState({
      pageIndex,
      tabKeyMap: genTabKeyMap(visibleTabs(s.tabList, pageIndex).map(tab => tab.id)),
      showHelp: false,
    });
  }

  tabIdForKey(key: string): number | undefined {
    const normalized = key.toLowerCase();
    const tabId = [...this.s().tabKeyMap.entries()]
      .find(([, mappedKey]) => mappedKey === normalized)?.[0];
    return tabId;
  }
}

export function findTabMatch(tabList: Tab[], query: string): Tab | undefined {
  if (!query) {
    return undefined;
  }
  const needle = query.toLowerCase();
  return tabList.find(tab => tabMatchesQuery(tab, needle));
}

export function findNextTabMatch(
  tabList: Tab[],
  query: string,
  afterTabId: number | undefined,
): Tab | undefined {
  if (!query || tabList.length === 0) {
    return undefined;
  }
  const needle = query.toLowerCase();
  const startIndex = Math.max(0, tabList.findIndex(tab => tab.id === afterTabId));
  for (let offset = 1; offset <= tabList.length; offset++) {
    const tab = tabList[(startIndex + offset) % tabList.length];
    if (tabMatchesQuery(tab, needle)) {
      return tab;
    }
  }
  return undefined;
}

function tabMatchesQuery(tab: Tab, needle: string): boolean {
  if (tab.title.toLowerCase().includes(needle)) {
    return true;
  }
  return hostnameOf(tab.url).toLowerCase().includes(needle);
}

function useSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
): T {
  const [snapshot, setSnapshot] = useState(getSnapshot);
  useLayoutEffect(() => {
    setSnapshot(getSnapshot());
    return subscribe(() => setSnapshot(getSnapshot()));
  }, [subscribe, getSnapshot]);
  return snapshot;
}

export function visibleTabs(tabList: Tab[], pageIndex: number, pageSize = PAGE_SIZE): Tab[] {
  const start = pageIndex * pageSize;
  return tabList.slice(start, start + pageSize);
}

export function pageCount(tabList: Tab[], pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(tabList.length / pageSize));
}

/**
 * Generates a map of tab IDs to their corresponding keyboard shortcuts.
 * @param tabList 
 */
export function genTabKeyMap(tabList: number[], keys = shortcutKeys): Map<number, string> {
  // Assign each tab with a unique key that's as close to the homerow as possible.
  const keyMap = new Map<number, string>();
  let keyIndex = 0;

  tabList.forEach(tabId => {
      if (keyIndex < keys.length) {
          keyMap.set(tabId, keys[keyIndex]);
          keyIndex++;
      }
  });

  return keyMap;
}