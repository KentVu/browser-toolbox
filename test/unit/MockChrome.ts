import { vi } from 'vitest';
import type { ChromeApi } from '@src/lib/Chrome';
import { ChromeTabApi } from '@src/lib/Chrome';
import type { Tab } from '@src/lib/Tab';
import { sortByLastAccessed } from '@src/lib/Util';

export function createMockChromeApi(tabs: Tab[] = [], currentTab?: Tab): ChromeApi {
  let openTabs = [...tabs];
  const localStorage = new Map<string, unknown>();

  const mockTabs: ChromeTabApi = {
    get: vi.fn().mockImplementation(async () => openTabs),
    getCurrent: vi.fn().mockResolvedValue(currentTab),
    activate: vi.fn().mockResolvedValue(undefined),
    getByLastAccessed: vi.fn().mockImplementation(async () => sortByLastAccessed(openTabs)),
    move: vi.fn().mockResolvedValue(undefined),
    breakIntoNewWindow: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockImplementation(async (tabId: number) => {
      openTabs = openTabs.filter(tab => tab.id !== tabId);
    }),
    updateUrl: vi.fn().mockResolvedValue(undefined),
  };

  return {
    tabs: mockTabs,
    storage: {
      getLocal: async <T>(key: string): Promise<T | undefined> => localStorage.get(key) as T | undefined,
      setLocal: async (key: string, value: unknown): Promise<void> => {
        localStorage.set(key, value);
      },
    },
    closePopup: vi.fn(),
  };
}