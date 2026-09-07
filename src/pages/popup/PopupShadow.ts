import { ChromeApi } from '@src/lib/Chrome';
import { PAGE_SIZE, shortcutKeys } from '@src/lib/constants';
import type { Tab } from '@src/lib/Tab';
import { create, type ExtractState } from 'zustand';
import { combine } from 'zustand/middleware';

export class PopupState {
  tabList: Tab[] = [];
  tabKeyMap: Map<number, string> = new Map();
  selectedTabId: number | undefined;
  pageIndex = 0;
}

export class PopupShadow {
  private readonly store = create(() => ({
    tabList: [] as Tab[],
    tabKeyMap: new Map<number, string>(),
    selectedTabId: undefined as number | undefined,
    pageIndex: 0,
  }));

  constructor(private readonly chrome: ChromeApi) {
  }

  s = (): PopupState => this.store.getState();
  setState = (state: Partial<PopupState>) => this.store.setState(state);
  useTabList = (): [Tab[], Map<number, string>] => {
    const tabList = this.store(state => state.tabList);
    const pageIndex = this.store(state => state.pageIndex);
    const tabKeyMap = this.store(state => state.tabKeyMap);
    return [visibleTabs(tabList, pageIndex), tabKeyMap];
  };
  useSelectedTabId = () => this.store(state => state.selectedTabId);
  usePageInfo = (): { pageIndex: number; pageCount: number } => {
    const pageIndex = this.store(state => state.pageIndex);
    const tabCount = this.store(state => state.tabList.length);
    return { pageIndex, pageCount: Math.max(1, Math.ceil(tabCount / PAGE_SIZE)) };
  };

  async fetchTabList() {
    const [_tabs, currentTab] = await Promise.all([
      this.chrome.tabs.getByLastAccessed(),
      this.chrome.tabs.getCurrent(),
    ]);
    const pageIndex = 0;
    // Prefer the tab visited before the current one (second most recently accessed).
    const previousTab = _tabs.find(tab => tab.id !== currentTab?.id) ?? currentTab;
    this.setState({
      tabList: _tabs,
      pageIndex,
      tabKeyMap: genTabKeyMap(visibleTabs(_tabs, pageIndex).map(tab => tab.id)),
      selectedTabId: previousTab?.id,
    });
  }

  onKeyPress(key: string): void {
    const s = this.s();

    if (key === ',') {
      this.changePage(-1);
      return;
    }
    if (key === '.') {
      this.changePage(1);
      return;
    }

    if (key === ']' && s.selectedTabId !== undefined) {
      const tabId = s.selectedTabId;
      void this.chrome.tabs.moveTab('toTheRight', tabId);
      void this.chrome.tabs.activate(tabId);
      this.chrome.tabs.close();
      return;
    }

    if (key === '[' && s.selectedTabId !== undefined) {
      const tabId = s.selectedTabId;
      void this.chrome.tabs.moveTab('toTheLeft', tabId);
      void this.chrome.tabs.activate(tabId);
      this.chrome.tabs.close();
      return;
    }

    if (key === 'enter' && s.selectedTabId !== undefined) {
      void this.chrome.tabs.activate(s.selectedTabId);
      this.chrome.tabs.close();
      return;
    }

    const tabId = this.tabIdForKey(key);
    if (tabId === undefined) {
      return;
    }
    this.setState({ selectedTabId: tabId });
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
            void chrome.tabs.moveTab('toTheRight', state.selectedTabId);
            chrome.tabs.close();
            return {};
          }
          if (key === '[' && state.selectedTabId !== undefined) {
            void chrome.tabs.moveTab('toTheLeft', state.selectedTabId);
            chrome.tabs.close();
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