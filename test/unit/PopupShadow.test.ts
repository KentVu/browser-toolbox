import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ChromeApi, ChromeTabApi } from '@src/lib/Chrome';
import { PopupShadow } from '@src/pages/popup/PopupShadow';
import type { Tab } from '@src/lib/Tab';

function createMockChromeApi(tabs: Tab[] = []): ChromeApi {
  const byLastAccessed = [...tabs].sort(
    (a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0),
  );
  const mockTabs = {
    get: vi.fn().mockResolvedValue(tabs),
    activate: vi.fn().mockResolvedValue(undefined),
    getByLastAccessed: vi.fn().mockResolvedValue(byLastAccessed),
    moveTab: vi.fn().mockResolvedValue(undefined),
  } satisfies Pick<ChromeTabApi, 'get' | 'activate' | 'getByLastAccessed' | 'moveTab'>;

  return {
    tabs: mockTabs as unknown as ChromeTabApi,
  };
}

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
  it('move selected tab to the right of current tab', async () => {
    const tabListMRU = await popupShadow.tabListByMostRecent();
    const selectedTabId = tabListMRU[2].id;
    const selectKey = popupShadow.keyForTab(selectedTabId);
    popupShadow.onKeyPress(selectKey); // Select the tab
    popupShadow.onKeyPress(']'); // Move selected tab to the right
    expect(chromeApi.tabs.moveTab).toHaveBeenCalledWith('toTheRight', selectedTabId);
  });
});