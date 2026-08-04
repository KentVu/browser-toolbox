import { shortcutKeys } from '@src/lib/constants';
import type { Tab } from '@src/lib/Tab';

export abstract class PopupShadow {
  abstract tabList(): Promise<Tab[]>;

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
