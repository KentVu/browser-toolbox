import type { BrowserApi } from '@src/lib/Browser';
import { ChromeApi } from '@src/lib/Chrome';
import { PAGE_SIZE, shortcutKeys } from '@src/lib/constants';
import type { Tab } from '@src/lib/Tab';
import { tryParseHttpUrl } from '@src/lib/Util';
import { create, type ExtractState } from 'zustand';
import { combine } from 'zustand/middleware';

export const PASTE_URL_ERROR = 'Not a URL to paste!';

export class PopupState {
  tabList: Tab[] = [];
  tabKeyMap: Map<number, string> = new Map();
  selectedTabId: number | undefined;
  currentWindowId: number | undefined;
  pageIndex = 0;
  errorMessage: string | undefined;
  /** `undefined` means not in search mode; otherwise the current query (may be empty). */
  searchQuery: string | undefined;
  /** Retained after leaving search mode so `n` can jump to the next match. */
  lastSearchQuery: string | undefined;
  /** Query used to render `<mark>` on the selected match outside active typing. */
  highlightQuery: string | undefined;
}

/**
 * Business logic layer for the popup UI.
 *
 * Mediates between React views and ChromeApi/BrowserApi: owns popup state
 * (tab list, selection, pagination, shortcut map), loads tabs, and handles
 * keyboard navigation, activation, clipboard, and tab moves. Views subscribe
 * via hooks and stay presentational.
 */
export class PopupPresenter {
  private readonly store = create(() => ({
    tabList: [] as Tab[],
    tabKeyMap: new Map<number, string>(),
    selectedTabId: undefined as number | undefined,
    currentWindowId: undefined as number | undefined,
    pageIndex: 0,
    errorMessage: undefined as string | undefined,
    searchQuery: undefined as string | undefined,
    lastSearchQuery: undefined as string | undefined,
    highlightQuery: undefined as string | undefined,
  }));

  constructor(
    private readonly chrome: ChromeApi,
    private readonly browser: BrowserApi,
  ) {
  }

  s = (): PopupState => this.store.getState();
  setState = (state: Partial<PopupState>) => this.store.setState(state);
  useVisibleTabList = (): [Tab[], Map<number, string>] => {
    const tabList = this.store(state => state.tabList);
    const pageIndex = this.store(state => state.pageIndex);
    const tabKeyMap = this.store(state => state.tabKeyMap);
    return [visibleTabs(tabList, pageIndex), tabKeyMap];
  };
  useSelectedTabId = () => this.store(state => state.selectedTabId);
  useCurrentWindowId = () => this.store(state => state.currentWindowId);
  useErrorMessage = () => this.store(state => state.errorMessage);
  useSearchQuery = () => this.store(state => state.searchQuery);
  useHighlightQuery = () => this.store(state => state.highlightQuery);
  usePageInfo = (): { pageIndex: number; pageCount: number } => {
    const pageIndex = this.store(state => state.pageIndex);
    const tabCount = this.store(state => state.tabList.length);
    return { pageIndex, pageCount: Math.max(1, Math.ceil(tabCount / PAGE_SIZE)) };
  };

  async fetchTabList(options?: { preservePage?: boolean }) {
    const [_tabs, currentTab] = await Promise.all([
      this.chrome.tabs.getByLastAccessed(),
      this.chrome.tabs.getCurrent(),
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
      currentWindowId: currentTab?.windowId,
    });
  }

  async onKeyPress(key: string): Promise<void> {
    const s = this.s();
    if (s.errorMessage !== undefined) {
      this.setState({ errorMessage: undefined });
    }

    if (key === '/' && s.searchQuery === undefined) {
      this.setState({ searchQuery: '' });
      return;
    }

    if (s.searchQuery !== undefined) {
      if (key === 'enter') {
        this.setState({
          lastSearchQuery: s.searchQuery,
          searchQuery: undefined,
          highlightQuery: undefined,
        });
        return;
      }
      if (key === 'backspace') {
        if (s.searchQuery.length === 0) {
          this.setState({
            searchQuery: undefined,
            highlightQuery: undefined,
          });
          return;
        }
        const searchQuery = s.searchQuery.slice(0, -1);
        const match = findTitleMatch(s.tabList, searchQuery);
        this.setState({
          searchQuery,
          highlightQuery: searchQuery || undefined,
          ...(match ? { selectedTabId: match.id } : {}),
        });
        return;
      }
      if (key.length === 1) {
        const searchQuery = s.searchQuery + key;
        const match = findTitleMatch(s.tabList, searchQuery);
        this.setState({
          searchQuery,
          highlightQuery: searchQuery,
          ...(match ? { selectedTabId: match.id } : {}),
        });
      }
      return;
    }

    if (key === 'n' && s.lastSearchQuery) {
      const match = findNextTitleMatch(s.tabList, s.lastSearchQuery, s.selectedTabId);
      if (match) {
        this.setState({
          selectedTabId: match.id,
          highlightQuery: s.lastSearchQuery,
        });
      }
      return;
    }

    if (key === ',') {
      this.changePage(-1);
      return;
    }
    if (key === '.') {
      this.changePage(1);
      return;
    }

    if (key === '>' || key === '<') {
      const currentTabId = (await this.chrome.tabs.getCurrent())?.id;
      if (currentTabId === undefined) {
        return;
      }
      const direction = key === '>' ? 'toTheRight' : 'toTheLeft';
      await this.chrome.tabs.move(direction, currentTabId);
      await this.chrome.tabs.activate(currentTabId);
      return;
    }

    if (key === ']' && s.selectedTabId !== undefined) {
      const tabId = s.selectedTabId;
      await this.chrome.tabs.move('toTheRight', tabId);
      await this.chrome.tabs.activate(tabId);
      this.chrome.closePopup();
      return;
    }

    if (key === '[' && s.selectedTabId !== undefined) {
      const tabId = s.selectedTabId;
      await this.chrome.tabs.move('toTheLeft', tabId);
      await this.chrome.tabs.activate(tabId);
      this.chrome.closePopup();
      return;
    }

    if (key === '!' && s.selectedTabId !== undefined) {
      const tabId = s.selectedTabId;
      await this.chrome.tabs.breakIntoNewWindow(tabId);
      this.chrome.closePopup();
      return;
    }

    if (key === 'enter' && s.selectedTabId !== undefined) {
      await this.chrome.tabs.activate(s.selectedTabId);
      this.chrome.closePopup();
      return;
    }

    if (key === 'ctrl+w' && s.selectedTabId !== undefined) {
      const tabId = s.selectedTabId;
      await this.chrome.tabs.close(tabId);
      await this.fetchTabList({ preservePage: true });
      return;
    }

    if (key === 'ctrl+c' && s.selectedTabId !== undefined) {
      const selectedTab = s.tabList.find(tab => tab.id === s.selectedTabId);
      if (selectedTab?.url) {
        await this.browser.clipboard.writeText(selectedTab.url);
      }
      return;
    }

    if (key === 'ctrl+v' && s.selectedTabId !== undefined) {
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
      return;
    }

    if (key === 'J' || key === 'pagedown') {
      this.jumpToPageEdgeOrChangePage('last');
      return;
    }
    if (key === 'K' || key === 'pageup') {
      this.jumpToPageEdgeOrChangePage('first');
      return;
    }
    if (key === 'j' || key === 'arrowdown') {
      this.moveSelection(1);
      return;
    }
    if (key === 'k' || key === 'arrowup') {
      this.moveSelection(-1);
      return;
    }

    const tabId = this.tabIdForKey(key);
    if (tabId === undefined) {
      return;
    }
    this.setState({ selectedTabId: tabId, highlightQuery: undefined });
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
    });
  }

  tabIdForKey(key: string): number | undefined {
    const normalized = key.toLowerCase();
    const tabId = [...this.s().tabKeyMap.entries()]
      .find(([, mappedKey]) => mappedKey === normalized)?.[0];
    return tabId;
  }
}

export function findTitleMatch(tabList: Tab[], query: string): Tab | undefined {
  if (!query) {
    return undefined;
  }
  const needle = query.toLowerCase();
  return tabList.find(tab => tab.title.toLowerCase().includes(needle));
}

export function findNextTitleMatch(
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
    if (tab.title.toLowerCase().includes(needle)) {
      return tab;
    }
  }
  return undefined;
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

export function usePopupStore(chrome: ChromeApi) {
  const store = create(
    combine({
      tabList: [] as Tab[],
      tabKeyMap: new Map<number, string>(),
      selectedTabId: undefined as number | undefined,
    }, (set) => ({
      fetchTabList: async () => {
        const [tabList, currentTab] = await Promise.all([
          chrome.tabs.getByLastAccessed(),
          chrome.tabs.getCurrent(),
        ]);
        const tabKeyMap = genTabKeyMap(tabList.map(tab => tab.id));
        set({ tabList, tabKeyMap, selectedTabId: currentTab?.id });
      },
      selectTab: (tabId: number | undefined) => {
        set({ selectedTabId: tabId });
      },
      onKeyPress: (key: string) => {
        set((state) => {
          const tabKeyMap = genTabKeyMap(state.tabList.map(tab => tab.id));
          if (key === ']' && state.selectedTabId !== undefined) {
            void chrome.tabs.move('toTheRight', state.selectedTabId);
            chrome.closePopup();
            return {};
          }
          if (key === '[' && state.selectedTabId !== undefined) {
            void chrome.tabs.move('toTheLeft', state.selectedTabId);
            chrome.closePopup();
            return {};
          }

          const tabId = [...tabKeyMap.entries()].find(([, mappedKey]) => mappedKey === key)?.[0];
          return { selectedTabId: tabId };
        });
      },
    })
  ));
  //store(s => s.fetchTabList)();
  return store;
}

export type PopupStoreState = ExtractState<ReturnType<typeof usePopupStore>>;