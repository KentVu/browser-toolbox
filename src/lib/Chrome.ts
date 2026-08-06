import { Tab } from '@src/lib/Tab';
import { sortByLastAccessed } from '@src/lib/Util';

export type MoveTabDirection = 'toTheRight' | 'toTheLeft';

export abstract class ChromeTabApi {
    abstract get(): Promise<Tab[]>;
    abstract activate(tabId: number): Promise<void>;
    abstract moveTab(direction: MoveTabDirection, tabId: number): Promise<void>;

    async getByLastAccessed(): Promise<Tab[]> {
        const chromeTabs = await this.get();
        return sortByLastAccessed(chromeTabs);
    }
}

export interface ChromeApi {
    tabs: ChromeTabApi;
}

class DefaultTabs extends ChromeTabApi {
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
    async activate(tabId: number): Promise<void> {
        await chrome.tabs.update(tabId, { active: true });
    }

    async moveTab(direction: MoveTabDirection, tabId: number): Promise<void> {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || activeTab.index === undefined || activeTab.windowId === undefined) {
            return;
        }

        const targetIndex =
            direction === 'toTheRight' ? activeTab.index + 1 : Math.max(0, activeTab.index - 1);

        await chrome.tabs.move(tabId, {
            index: targetIndex,
            windowId: activeTab.windowId,
        });
    }
};

class DefaultChrome implements ChromeApi {
    tabs: ChromeTabApi;

    constructor() {
        this.tabs = new DefaultTabs();
    }
}
export const Chrome = new DefaultChrome();