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
