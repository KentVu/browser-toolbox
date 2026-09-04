import { vi } from 'vitest';
import type { ChromeApi } from '@src/lib/Chrome';
import { ChromeTabApi } from '@src/lib/Chrome';
import type { Tab } from '@src/lib/Tab';
import { sortByLastAccessed } from '@src/lib/Util';

export function createMockChromeApi(tabs: Tab[] = [], currentTab?: Tab): ChromeApi {
  const byLastAccessed = [...tabs].sort(
    (a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0),
  );
  const mockTabs = {
    get: vi.fn().mockResolvedValue(tabs),
    getCurrent: vi.fn().mockResolvedValue(currentTab),
    activate: vi.fn().mockResolvedValue(undefined),
    getByLastAccessed: vi.fn().mockResolvedValue(byLastAccessed),
    moveTab: vi.fn().mockResolvedValue(undefined),
  } satisfies Pick<ChromeTabApi, 'get' | 'getCurrent' | 'activate' | 'getByLastAccessed' | 'moveTab'>;

  return {
    tabs: mockTabs as unknown as ChromeTabApi,
  };
}