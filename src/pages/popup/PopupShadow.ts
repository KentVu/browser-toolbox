import { ChromeApi } from '@src/lib/Chrome';
import { shortcutKeys } from '@src/lib/constants';
import type { Tab } from '@src/lib/Tab';

export class PopupShadow {
  constructor(private readonly chrome: ChromeApi) {
  }

  async tabList(): Promise<Tab[]> {
    const tabList: Tab[] = await this.chrome.tabs.get();
    return tabList;
  }

  /**
   * Generates a map of tab IDs to their corresponding keyboard shortcuts.
   * @param tabList 
   */
  tabKeyMap(tabList: number[], keys = shortcutKeys): Map<number, string> {
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
