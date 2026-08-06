import { ChromeApi } from '@src/lib/Chrome';
import { shortcutKeys } from '@src/lib/constants';
import type { Tab } from '@src/lib/Tab';

// TODO: Export zustand store for interface to React components.
export class PopupShadow {
  private _tabKeyMap = new Map<number, string>();
  private _selectedTabId: number | undefined;

  constructor(private readonly chrome: ChromeApi) {
  }

  async tabListByMostRecent(): Promise<Tab[]> {
    const tabList: Tab[] = await this.chrome.tabs.getByLastAccessed();
    this._tabKeyMap = this.tabKeyMap(tabList.map(tab => tab.id));
    return tabList;
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
    this._selectedTabId = tabId;
  }

  private tabIdForKey(key: string): number | undefined {
    const normalized = key.toLowerCase();
    for (const [tabId, mappedKey] of this._tabKeyMap) {
      if (mappedKey.toLowerCase() === normalized) {
        return tabId;
      }
    }
    return undefined;
  }

  /**
   * Generates a map of tab IDs to their corresponding keyboard shortcuts.
   * @param tabList 
   */
  private tabKeyMap(tabList: number[], keys = shortcutKeys): Map<number, string> {
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
}
