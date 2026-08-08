import { ChromeApi } from '@src/lib/Chrome';
import { shortcutKeys } from '@src/lib/constants';
import type { Tab } from '@src/lib/Tab';
import { useState } from 'react';
import { create, type ExtractState } from 'zustand';
import { entity } from 'simpler-state'

export class PopupState {
  tabList: Tab[] = [];
  tabKeyMap: Map<number, string> = new Map();
  selectedTabId: number | undefined;
}

export class PopupShadow {
  private _tabKeyMap = new Map<number, string>();
  private _selectedTabId: number | undefined;
  tabList = entity<Tab[]>([]);
  selectedTabId = entity<number | null>(null);

  constructor(private readonly chrome: ChromeApi) {
  }

  async tabListByMostRecent(): Promise<Tab[]> {
    const tabList: Tab[] = await this.chrome.tabs.getByLastAccessed();
    this._tabKeyMap = genTabKeyMap(tabList.map(tab => tab.id));
    return tabList;
  }

  async fetchTabList() {
      const _tabs = await this.chrome.tabs.getByLastAccessed();
      this.tabList.set(_tabs);
  }

  keyForTab(tabId: number): string {
    return this._tabKeyMap.get(tabId)!;
  }

  onKeyPress(key: string): void {
    if (key === ']' && this._selectedTabId !== undefined) {
      void this.chrome.tabs.moveTab('toTheRight', this._selectedTabId);
      return;
    }

    if (key === '[' && this._selectedTabId !== undefined) {
      void this.chrome.tabs.moveTab('toTheLeft', this._selectedTabId);
      return;
    }

    const tabId = this.tabIdForKey(key);
    if (tabId === undefined) {
      return;
    }
    this.selectedTabId.set(tabId);
  }

  tabIdForKey(key: string): number | undefined {
    const normalized = key.toLowerCase();
    for (const [tabId, mappedKey] of this._tabKeyMap) {
      if (mappedKey.toLowerCase() === normalized) {
        return tabId;
      }
    }
    return undefined;
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
  const popupShadow = new PopupShadow(chrome);
  return create((set) => ({
    tabList: [] as Tab[],
    tabKeyMap: new Map<number, string>(),
    fetchTabList: async () => {
      const tabList: Tab[] = await chrome.tabs.getByLastAccessed();
      const tabKeyMap = genTabKeyMap(tabList.map(tab => tab.id));
      set({ tabList, tabKeyMap });
    },
    selectedTabId: undefined as number | undefined,
    selectTab: (tabId: number | undefined) => {
      set({ selectedTabId: tabId });
    },
    onKeyPress: (key: string) => {
      set((state: PopupState) => {
        if (key === ']' && state.selectedTabId !== undefined) {
          void chrome.tabs.moveTab('toTheRight', state.selectedTabId);
          return {};
        }
        if (key === '[' && state.selectedTabId !== undefined) {
          void chrome.tabs.moveTab('toTheLeft', state.selectedTabId);
          return;
        }

        const tabId = [...state.tabKeyMap.values()].find((k) => k === key);
        if (tabId === undefined) {
          return;
        }
        return { selectedTabId: tabId };
      });
    },
  }));
}