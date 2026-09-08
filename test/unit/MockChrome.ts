import { vi } from 'vitest';
import type { ChromeApi } from '@src/lib/Chrome';
import { ChromeTabApi } from '@src/lib/Chrome';
import type { Tab } from '@src/lib/Tab';
import { sortByLastAccessed } from '@src/lib/Util';

export function createMockChromeApi(tabs: Tab[] = [], currentTab?: Tab): ChromeApi {
  let openTabs = [...tabs];

  const mockTabs = {
    get: vi.fn().mockImplementation(async () => openTabs),
    getCurrent: vi.fn().mockResolvedValue(currentTab),
    activate: vi.fn().mockResolvedValue(undefined),
    getByLastAccessed: vi.fn().mockImplementation(async () => sortByLastAccessed(openTabs)),
    moveTab: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockImplementation(async (tabId: number) => {
      openTabs = openTabs.filter(tab => tab.id !== tabId);
    }),
  } satisfies Pick<ChromeTabApi, 'get' | 'getCurrent' | 'activate' | 'getByLastAccessed' | 'moveTab' | 'remove'>;
  // The above satisfies is ugly, can it just be `ChromeTabApi`?

  return {
    tabs: mockTabs as unknown as ChromeTabApi,
    closePopup: vi.fn(),
  };
}