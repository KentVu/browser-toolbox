import { Tab } from '@src/lib/Tab';

export interface ChromeTabApi {
    get(): Promise<Tab[]>;
    getByLastAccessed(): Promise<Tab[]>;
    activate(tabId: number): Promise<void>;
}

export interface ChromeApi {
    tabs: ChromeTabApi;
}

class DefaultTabs implements ChromeTabApi {
    async get(): Promise<Tab[]> {
        const chromeTabs = await chrome.tabs.query({});
        return chromeTabs 
            .map((t): Tab => ({
                id: t.id!,
                title: t.title || '',
                url: t.url,
                lastAccessed: t.lastAccessed,
            }))
    }
    async getByLastAccessed(): Promise<Tab[]> {
        // Reference defaultTabs directly to avoid 'this' context issues during object literal initialization
        const chromeTabs = await this.get();
        return chromeTabs
            .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    }
    async activate(tabId: number): Promise<void> {
        await chrome.tabs.update(tabId, { active: true });
    }
};

class DefaultChrome implements ChromeApi {
    tabs: ChromeTabApi;

    constructor() {
        this.tabs = new DefaultTabs();
    }
}
export default new DefaultChrome();