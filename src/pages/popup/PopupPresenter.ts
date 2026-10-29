import type { BrowserApi } from '@src/lib/Browser';
import { ChromeApi, type MoveTabDirection } from '@src/lib/Chrome';
import { PAGE_SIZE, shortcutKeys } from '@src/lib/constants';
import type { Tab } from '@src/lib/Tab';
import { hostnameOf, tryParseHttpUrl } from '@src/lib/Util';
import { useEffect, useState } from 'preact/hooks';

export const PASTE_URL_ERROR = 'Not a URL to paste!';
export const LAST_TAB_LIST_KEY = 'lastTabList';
const LAST_SEARCH_QUERY_KEY = 'lastSearchQuery';

export type CachedTabList = {
  tabList: Tab[];
  currentTabId?: number;
  currentWindowId?: number;
};

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
  | 'moveSelectedTabRight'
  | 'moveSelectedTabLeft'
  | 'breakSelectedTabIntoWindow'
  | 'activateSelectedTab'
  | 'closeSelectedTab'
  | 'copySelectedTabUrl'
  | 'pasteUrlIntoSelectedTab'
  | 'jumpToLastTab'
  | 'jumpToFirstTab'
  | 'toggleVimMode'
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
  '}': 'moveSelectedTabRight',
  '{': 'moveSelectedTabLeft',
  '!': 'breakSelectedTabIntoWindow',
  enter: 'activateSelectedTab',
  x: 'closeSelectedTab',
  'ctrl+w': 'closeSelectedTab',
  'ctrl+c': 'copySelectedTabUrl',
  'ctrl+v': 'pasteUrlIntoSelectedTab',
  v: 'toggleVimMode',
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
  /** Current page's Vim mode; undefined while checking or when unavailable. */
  vimModeEnabled: boolean | undefined;
  /** False until the first tab-list fetch finishes, so the empty state does not flash. */
  tabListLoaded = false;
}

type KeyResult = 'handled' | 'fallthrough';

interface PopupKeyMode {
  /** Plain results stay synchronous so tab selection is not deferred a microtask. */
  handle(key: string): KeyResult | Promise<KeyResult>;
}

/** Presenter operations shared by keyboard modes. ChromeApi stays private. */
interface PopupKeyHost {
  s(): PopupState;
  setState(state: Partial<PopupState>): void;
  selectSearchMatch(match: Tab | undefined, extra?: Partial<PopupState>): void;
  fetchTabList(options?: { preservePage?: boolean }): Promise<void>;
  changePage(delta: number): void;
  moveSelection(delta: number): void;
  jumpToPageEdgeOrChangePage(edge: 'first' | 'last'): void;
  readonly chrome: ChromeApi;
  readonly browser: BrowserApi;
}

/**
 * Search mode: raw keys edit the query. `ctrl+w` clears it; letters (including `x`) are typed.
 * Every key is consumed so browse shortcuts and tab selection do not run.
 */
class SearchKeyMode implements PopupKeyMode {
  private readonly handlers: Record<string, (key: string) => Promise<void>>;

  constructor(private readonly host: PopupKeyHost) {
    this.handlers = {
      enter: key => this.commitSearch(key),
      'ctrl+enter': key => this.commitSearch(key),
      escape: () => this.exitSearch(),
      'ctrl+w': () => this.clearSearchQuery(),
      'ctrl+backspace': () => this.clearSearchQuery(),
      'ctrl+v': () => this.pasteSearchQuery(),
      backspace: () => this.deleteSearchChar(),
    };
  }

  handle(key: string): KeyResult | Promise<KeyResult> {
    const append = key.length === 1 ? (typed: string) => this.appendSearchChar(typed) : undefined;
    const handler = this.handlers[key] ?? append;
    if (!handler) {
      return 'handled';
    }
    return Promise.resolve(handler(key)).then(() => 'handled' as const);
  }

  private async commitSearch(key: string): Promise<void> {
    const s = this.host.s();
    const query = s.searchQuery;
    if (query === undefined) {
      return;
    }
    if (key === 'enter' && query.length === 0 && s.lastSearchQuery) {
      const searchQuery = s.lastSearchQuery;
      const match = findTabMatch(s.tabList, searchQuery);
      this.host.selectSearchMatch(match, {
        searchQuery,
        highlightQuery: searchQuery,
      });
      return;
    }
    const match = key === 'ctrl+enter' ? findTabMatch(s.tabList, query) : undefined;
    const nextLastSearchQuery = query || s.lastSearchQuery;
    this.host.setState({
      lastSearchQuery: nextLastSearchQuery,
      searchQuery: undefined,
      highlightQuery: undefined,
    });
    if (match) {
      await this.host.chrome.tabs.activate(match.id);
      this.host.chrome.closePopup();
    }
  }

  private async exitSearch(): Promise<void> {
    const s = this.host.s();
    if (s.searchQuery === undefined) {
      return;
    }
    if (s.searchQuery.length === 0) {
      this.host.setState({
        lastSearchQuery: undefined,
        searchQuery: undefined,
        highlightQuery: undefined,
      });
      await this.host.chrome.storage.setLocal(LAST_SEARCH_QUERY_KEY, '');
      return;
    }
    const nextLastSearchQuery = s.searchQuery || s.lastSearchQuery;
    this.host.setState({
      lastSearchQuery: nextLastSearchQuery,
      searchQuery: undefined,
      highlightQuery: undefined,
    });
  }

  private async clearSearchQuery(): Promise<void> {
    this.host.setState({
      lastSearchQuery: undefined,
      searchQuery: '',
      highlightQuery: undefined,
    });
    await this.host.chrome.storage.setLocal(LAST_SEARCH_QUERY_KEY, '');
  }

  private async deleteSearchChar(): Promise<void> {
    const s = this.host.s();
    const query = s.searchQuery ?? '';
    if (query.length === 0) {
      this.host.setState({
        lastSearchQuery: undefined,
        searchQuery: undefined,
        highlightQuery: undefined,
      });
      await this.host.chrome.storage.setLocal(LAST_SEARCH_QUERY_KEY, '');
      return;
    }
    const searchQuery = query.slice(0, -1);
    const match = findTabMatch(s.tabList, searchQuery);
    this.host.selectSearchMatch(match, {
      searchQuery,
      highlightQuery: searchQuery || undefined,
    });
    await this.host.chrome.storage.setLocal(LAST_SEARCH_QUERY_KEY, searchQuery);
  }

  private async appendSearchChar(key: string): Promise<void> {
    await this.appendSearchText(key);
  }

  private async pasteSearchQuery(): Promise<void> {
    let pastedText: string;
    try {
      pastedText = await this.host.browser.clipboard.readText();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.host.setState({ errorMessage: `Unable to paste search query: ${detail}` });
      return;
    }

    if (pastedText.length > 0) {
      await this.appendSearchText(pastedText);
    }
  }

  private async appendSearchText(text: string): Promise<void> {
    const s = this.host.s();
    const searchQuery = (s.searchQuery ?? '') + text;
    const match = findTabMatch(s.tabList, searchQuery);
    this.host.selectSearchMatch(match, {
      searchQuery,
      highlightQuery: searchQuery,
    });
    await this.host.chrome.storage.setLocal(LAST_SEARCH_QUERY_KEY, searchQuery);
  }
}

/**
 * Browse mode: shortcut actions, then fall through to tab selection.
 * `n` falls through when there is no saved search so it can still select a tab.
 */
class BrowseKeyMode implements PopupKeyMode {
  private readonly actions: Record<ShortcutAction, () => KeyResult | Promise<KeyResult>>;

  constructor(private readonly host: PopupKeyHost) {
    this.actions = {
      enterSearch: () => this.enterSearch(),
      toggleShortcutHelp: () => this.toggleShortcutHelp(),
      nextSearchMatch: () => this.nextSearchMatch(),
      previousPage: () => this.previousPage(),
      nextPage: () => this.nextPage(),
      moveCurrentTabRight: () => this.moveCurrentTab('toTheRight'),
      moveCurrentTabLeft: () => this.moveCurrentTab('toTheLeft'),
      moveSelectedTabRightAndActivate: () => this.moveSelectedAndActivate('toTheRight'),
      moveSelectedTabLeftAndActivate: () => this.moveSelectedAndActivate('toTheLeft'),
      moveSelectedTabRight: () => this.moveSelectedTab('toTheRight'),
      moveSelectedTabLeft: () => this.moveSelectedTab('toTheLeft'),
      breakSelectedTabIntoWindow: () => this.breakSelectedTabIntoWindow(),
      activateSelectedTab: () => this.activateSelectedTab(),
      closeSelectedTab: () => this.closeSelectedTab(),
      copySelectedTabUrl: () => this.copySelectedTabUrl(),
      pasteUrlIntoSelectedTab: () => this.pasteUrlIntoSelectedTab(),
      jumpToLastTab: () => this.jumpToEdge('last'),
      jumpToFirstTab: () => this.jumpToEdge('first'),
      toggleVimMode: () => this.toggleVimMode(),
      moveSelectionDown: () => this.moveSelection(1),
      moveSelectionUp: () => this.moveSelection(-1),
    };
  }

  handle(key: string): KeyResult | Promise<KeyResult> {
    if (key === 'escape' && this.host.s().showHelp) {
      this.host.setState({ showHelp: false });
      return 'handled';
    }
    const action = resolveShortcutAction(key);
    if (!action) {
      return 'fallthrough';
    }
    return this.actions[action]();
  }

  private async enterSearch(): Promise<KeyResult> {
    this.host.setState({ searchQuery: '', showHelp: false });
    return 'handled';
  }

  private async toggleShortcutHelp(): Promise<KeyResult> {
    this.host.setState({ showHelp: !this.host.s().showHelp });
    return 'handled';
  }

  private nextSearchMatch(): KeyResult {
    const s = this.host.s();
    if (!s.lastSearchQuery) {
      return 'fallthrough';
    }
    const match = findNextTabMatch(s.tabList, s.lastSearchQuery, s.selectedTabId);
    if (match) {
      this.host.selectSearchMatch(match, { highlightQuery: s.lastSearchQuery });
    }
    return 'handled';
  }

  private async previousPage(): Promise<KeyResult> {
    this.host.changePage(-1);
    return 'handled';
  }

  private async nextPage(): Promise<KeyResult> {
    this.host.changePage(1);
    return 'handled';
  }

  private async moveCurrentTab(direction: MoveTabDirection): Promise<KeyResult> {
    const currentTabId = (await this.host.chrome.tabs.getCurrent())?.id;
    if (currentTabId !== undefined) {
      // Do not activate after move: activate() focuses the browser window and
      // Chrome auto-closes the popup when focus leaves it.
      await this.host.chrome.tabs.move(direction, currentTabId);
    }
    return 'handled';
  }

  private async moveSelectedAndActivate(direction: MoveTabDirection): Promise<KeyResult> {
    const selectedTabId = this.host.s().selectedTabId;
    if (selectedTabId !== undefined) {
      await this.host.chrome.tabs.move(direction, selectedTabId);
      await this.host.chrome.tabs.activate(selectedTabId);
      this.host.chrome.closePopup();
    }
    return 'handled';
  }

  private async moveSelectedTab(direction: MoveTabDirection): Promise<KeyResult> {
    const selectedTabId = this.host.s().selectedTabId;
    if (selectedTabId !== undefined) {
      // Do not activate after the shift: activate() focuses the browser window
      // and Chrome auto-closes the popup when focus leaves it.
      await this.host.chrome.tabs.shift(direction, selectedTabId);
    }
    return 'handled';
  }

  private async breakSelectedTabIntoWindow(): Promise<KeyResult> {
    const selectedTabId = this.host.s().selectedTabId;
    if (selectedTabId !== undefined) {
      await this.host.chrome.tabs.breakIntoNewWindow(selectedTabId);
      this.host.chrome.closePopup();
    }
    return 'handled';
  }

  private async activateSelectedTab(): Promise<KeyResult> {
    const selectedTabId = this.host.s().selectedTabId;
    if (selectedTabId !== undefined) {
      await this.host.chrome.tabs.activate(selectedTabId);
      this.host.chrome.closePopup();
    }
    return 'handled';
  }

  private async closeSelectedTab(): Promise<KeyResult> {
    const selectedTabId = this.host.s().selectedTabId;
    if (selectedTabId !== undefined) {
      await this.host.chrome.tabs.close(selectedTabId);
      await this.host.fetchTabList({ preservePage: true });
    }
    return 'handled';
  }

  private async copySelectedTabUrl(): Promise<KeyResult> {
    const s = this.host.s();
    if (s.selectedTabId !== undefined) {
      const selectedTab = s.tabList.find(tab => tab.id === s.selectedTabId);
      if (selectedTab?.url) {
        await this.host.browser.clipboard.writeText(selectedTab.url);
      }
    }
    return 'handled';
  }

  private async pasteUrlIntoSelectedTab(): Promise<KeyResult> {
    const s = this.host.s();
    if (s.selectedTabId !== undefined) {
      const clipboardText = await this.host.browser.clipboard.readText();
      const url = tryParseHttpUrl(clipboardText);
      if (!url) {
        this.host.setState({ errorMessage: PASTE_URL_ERROR });
        return 'handled';
      }

      const tabId = s.selectedTabId;
      await this.host.chrome.tabs.updateUrl(tabId, url);
      this.host.setState({
        errorMessage: undefined,
        tabList: s.tabList.map(tab => (tab.id === tabId ? { ...tab, url } : tab)),
      });
    }
    return 'handled';
  }

  private async jumpToEdge(edge: 'first' | 'last'): Promise<KeyResult> {
    this.host.jumpToPageEdgeOrChangePage(edge);
    return 'handled';
  }

  private async toggleVimMode(): Promise<KeyResult> {
    try {
      const vimModeEnabled = await this.host.chrome.tabs.toggleVimMode();
      this.host.setState({ vimModeEnabled });
      this.host.chrome.closePopup();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.host.setState({ errorMessage: `Unable to toggle page navigation: ${detail}` });
    }
    return 'handled';
  }

  private async moveSelection(delta: number): Promise<KeyResult> {
    this.host.moveSelection(delta);
    return 'handled';
  }
}

/**
 * Business logic layer for the popup UI.
 *
 * Mediates between Preact views and ChromeApi/BrowserApi: owns popup state
 * (tab list, selection, pagination, shortcut map), loads tabs, and delegates
 * keys to SearchKeyMode or BrowseKeyMode. Views subscribe via usePopupState
 * and stay presentational.
 */
export class PopupPresenter {
  private state: PopupState = new PopupState();
  private readonly listeners = new Set<() => void>();
  private initialLoad?: Promise<void>;
  private liveTabListLoaded = false;
  private readonly searchMode: PopupKeyMode;
  private readonly browseMode: PopupKeyMode;

  constructor(
    private readonly chrome: ChromeApi,
    private readonly browser: BrowserApi,
  ) {
    const host: PopupKeyHost = {
      s: () => this.s(),
      setState: state => this.setState(state),
      selectSearchMatch: (match, extra) => this.selectSearchMatch(match, extra),
      fetchTabList: options => this.fetchTabList(options),
      changePage: delta => this.changePage(delta),
      moveSelection: delta => this.moveSelection(delta),
      jumpToPageEdgeOrChangePage: edge => this.jumpToPageEdgeOrChangePage(edge),
      chrome: this.chrome,
      browser: this.browser,
    };
    this.searchMode = new SearchKeyMode(host);
    this.browseMode = new BrowseKeyMode(host);
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

  ensureTabListLoaded = (): Promise<void> => {
    if (!this.initialLoad) {
      this.initialLoad = this.fetchTabList();
      void this.hydrateCachedTabList();
      void this.refreshVimModeState();
    }
    return this.initialLoad;
  };

  async refreshVimModeState(): Promise<void> {
    try {
      this.setState({ vimModeEnabled: await this.chrome.tabs.getVimModeEnabled() });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.setState({
        vimModeEnabled: undefined,
        errorMessage: `Unable to read page navigation mode: ${detail}`,
      });
    }
  }

  async fetchTabList(options?: { preservePage?: boolean }) {
    const [_tabs, currentTab, savedSearchQuery] = await Promise.all([
      this.chrome.tabs.getByLastAccessed(),
      this.chrome.tabs.getCurrent(),
      this.chrome.storage.getLocal<string>(LAST_SEARCH_QUERY_KEY),
    ]);
    this.liveTabListLoaded = true;
    this.applyTabList(_tabs, currentTab, {
      preservePage: options?.preservePage,
      lastSearchQuery: savedSearchQuery || undefined,
    });
    void this.chrome.storage.setLocal(LAST_TAB_LIST_KEY, {
      tabList: _tabs,
      currentTabId: currentTab?.id,
      currentWindowId: currentTab?.windowId,
    } satisfies CachedTabList);
  }

  private async hydrateCachedTabList(): Promise<void> {
    if (this.liveTabListLoaded) {
      return;
    }
    const snapshot = await this.chrome.storage.getLocal<CachedTabList>(LAST_TAB_LIST_KEY);
    if (this.liveTabListLoaded || !snapshot?.tabList.length) {
      return;
    }
    const currentTab = snapshot.currentTabId === undefined
      ? undefined
      : snapshot.tabList.find(tab => tab.id === snapshot.currentTabId)
        ?? {
          id: snapshot.currentTabId,
          title: '',
          windowId: snapshot.currentWindowId,
        };
    this.applyTabList(snapshot.tabList, currentTab);
  }

  /**
   * Apply a tab list to popup state. Used for both the live Chrome fetch and
   * the cached snapshot shown while that fetch is in flight.
   */
  private applyTabList(
    tabs: Tab[],
    currentTab: Tab | undefined,
    options?: { preservePage?: boolean; lastSearchQuery?: string },
  ): void {
    const maxPage = pageCount(tabs) - 1;
    const pageIndex = options?.preservePage
      ? Math.min(this.s().pageIndex, maxPage)
      : 0;
    // Prefer the tab visited before the current one (second most recently accessed).
    const previousTab = tabs.find(tab => tab.id !== currentTab?.id) ?? currentTab;
    this.setState({
      tabList: tabs,
      pageIndex,
      tabKeyMap: genTabKeyMap(visibleTabs(tabs, pageIndex).map(tab => tab.id)),
      selectedTabId: previousTab?.id,
      currentTabId: currentTab?.id,
      currentWindowId: currentTab?.windowId,
      tabListLoaded: true,
      ...(options && 'lastSearchQuery' in options
        ? { lastSearchQuery: options.lastSearchQuery }
        : {}),
    });
  }

  async onKeyPress(key: string): Promise<void> {
    if (this.s().errorMessage !== undefined) {
      this.setState({ errorMessage: undefined });
    }
    const mode = this.s().searchQuery !== undefined ? this.searchMode : this.browseMode;
    const result = mode.handle(key);
    if ((result instanceof Promise ? await result : result) === 'handled') {
      return;
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
  useEffect(() => {
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