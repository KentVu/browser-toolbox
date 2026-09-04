import { ChromeApi } from '@src/lib/Chrome';
import { shortcutKeys } from '@src/lib/constants';
import type { Tab } from '@src/lib/Tab';
import { useEffect, useState } from 'react';
import { create, type ExtractState } from 'zustand';
import { combine } from 'zustand/middleware';
import { entity } from 'simpler-state'

export class PopupState {
  tabList: Tab[] = [];
  tabKeyMap: Map<number, string> = new Map();
  selectedTabId: number | undefined;
}

export class PopupShadow {
  readonly store = create(
    combine({
      tabList: [] as Tab[],
      tabKeyMap: new Map<number, string>(),
      selectedTabId: undefined as number | undefined,
    }, (set) => ({
      setTabList: (tabList: Tab[]) => set({ tabList }),
      setTabKeyMap: (tabKeyMap: Map<number, string>) => set({ tabKeyMap }),
      setSelectedTabId: (selectedTabId: number | undefined) => set({ selectedTabId }),
    })),
  );

  constructor(private readonly chrome: ChromeApi) {
  }

  s = () => this.store.getState();

  async fetchTabList() {
    const [_tabs, currentTab] = await Promise.all([
      this.chrome.tabs.getByLastAccessed(),
      this.chrome.tabs.getCurrent(),
    ]);
    /* this.store(s => s.setTabList)(_tabs);
    this.store(s => s.setTabKeyMap)(genTabKeyMap(_tabs.map(tab => tab.id)));
    this.store(s => s.setSelectedTabId)(currentTab?.id); */
    this.store.setState({
      tabList: _tabs,
      tabKeyMap: genTabKeyMap(_tabs.map(tab => tab.id)),
      selectedTabId: currentTab?.id,
    });
  }

  onKeyPress(key: string): void {
    const s = this.s();
    if (key === ']' && s.selectedTabId !== undefined) {
      this.chrome.tabs.moveTab('toTheRight', s.selectedTabId!);
      return;
    }

    if (key === '[' && s.selectedTabId !== undefined) {
      this.chrome.tabs.moveTab('toTheLeft', s.selectedTabId!);
      return;
    }

    const tabId = this.tabIdForKey(key);
    if (tabId === undefined) {
      return;
    }
    //this.store(s => s.setSelectedTabId)(tabId);
    this.store.setState({ selectedTabId: tabId });
  }

  tabIdForKey(key: string): number | undefined {
    const normalized = key.toLowerCase();
    const tabId = [...this.s().tabKeyMap.entries()]
      .find(([, mappedKey]) => mappedKey === normalized)?.[0];
    return tabId;
  }
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
            return {};
          }
          if (key === '[' && state.selectedTabId !== undefined) {
            void chrome.tabs.moveTab('toTheLeft', state.selectedTabId);
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