import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ChromeApi, ChromeTabApi } from '@src/lib/Chrome';
import { PopupShadow } from '@src/pages/popup/PopupShadow';
import type { Tab } from '@src/lib/Tab';
import { createMockChromeApi } from './MockChrome';

describe('PopupShadow', () => {
  let chromeApi: ChromeApi;
  let popupShadow: PopupShadow;
  let tabs: Tab[];

  beforeEach(() => {
    tabs = [
      { id: 1, title: 'Docs', url: 'https://docs.example.com/page', lastAccessed: 1000 },
      { id: 2, title: 'Music', url: 'https://music.example.com', lastAccessed: 2000 },
      { id: 3, title: 'game', url: 'https://game.example.com/inbox', lastAccessed: 3000 },
    ];
    chromeApi = createMockChromeApi(tabs);
    popupShadow = new PopupShadow(chromeApi);
  });

  describe('tabListByMostRecent', () => {
    it('returns a list of all tabs most recent tab first', async () => {
      const tabList = await popupShadow.tabListByMostRecent();
      expect(chromeApi.tabs.getByLastAccessed).toHaveBeenCalled();
      expect(tabList).toEqual([tabs[2], tabs[1], tabs[0]]); // Most recent tab first
    });
  });
});