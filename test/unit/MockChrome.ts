import type { ChromeApi, ChromeTabApi } from '@src/lib/Chrome';
import type { Tab } from '@src/lib/Tab';
import { sortByLastAccessed } from '@src/lib/Util';

class MockTabs implements ChromeTabApi {
  constructor(private readonly tabs: Tab[]) {}

  async get(): Promise<Tab[]> {
    return this.tabs;
  }

  async getByLastAccessed(): Promise<Tab[]> {
    return sortByLastAccessed(this.tabs);
  }

  async activate(_tabId: number): Promise<void> {
    // no-op for unit tests
  }
}

export class MockChrome implements ChromeApi {
  tabs: ChromeTabApi;

  constructor(tabs: Tab[]) {
    this.tabs = new MockTabs(tabs);
  }
}
