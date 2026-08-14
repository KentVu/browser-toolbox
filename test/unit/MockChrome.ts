import { vi } from 'vitest';
import type { ChromeApi } from '@src/lib/Chrome';
import { ChromeTabApi } from '@src/lib/Chrome';
import type { Tab } from '@src/lib/Tab';
import { sortByLastAccessed } from '@src/lib/Util';

class MockTabs extends ChromeTabApi {
  constructor(private readonly tabs: Tab[]) {
    super();
  }

  async get(): Promise<Tab[]> {
    return this.tabs;
  }

  async activate(_tabId: number): Promise<void> {
    // no-op for unit tests
  }

  async moveTab(_direction: 'toTheRight' | 'toTheLeft', _tabId: number): Promise<void> {
    // no-op for unit tests
  }
}

export class MockChrome implements ChromeApi {
  tabs: ChromeTabApi;

  constructor(tabs: Tab[]) {
    this.tabs = new MockTabs(tabs);
  }
}

export function createMockChromeApi(tabs: Tab[] = []): ChromeApi {
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