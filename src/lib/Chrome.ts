import { Tab } from '@src/lib/Tab';
import { sortByLastAccessed } from '@src/lib/Util';

export type MoveTabDirection = 'toTheRight' | 'toTheLeft';

/**
 * Thin wrapper around Chrome extension tab APIs (`chrome.tabs`, `chrome.windows`).
 * Feature code should depend on this instead of calling `chrome.*` directly.
 */
export abstract class ChromeTabApi {
    abstract get(): Promise<Tab[]>;
    abstract getCurrent(): Promise<Tab | undefined>;
    abstract activate(tabId: number): Promise<void>;
    abstract move(direction: MoveTabDirection, tabId: number): Promise<void>;
    abstract close(tabId: number): Promise<void>;

    async getByLastAccessed(): Promise<Tab[]> {
        const chromeTabs = await this.get();
        return sortByLastAccessed(chromeTabs);
    }
}

/**
 * Facade over Chrome extension APIs used by this extension.
 *
 * Wraps Chrome-specific surfaces such as `chrome.tabs` / `chrome.windows`
 * (via {@link ChromeTabApi}) and popup lifecycle helpers. Keep web platform
 * APIs (e.g. clipboard) on {@link BrowserApi} instead.
 */
export interface ChromeApi {
    tabs: ChromeTabApi;
    closePopup(): void;
}

class DefaultTabs extends ChromeTabApi {
    async get(): Promise<Tab[]> {
        const chromeTabs = await chrome.tabs.query({});
        return chromeTabs 
            .map(tab => this.toTab(tab));
    }
    async getCurrent(): Promise<Tab | undefined> {
        const [currentTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        return currentTab ? this.toTab(currentTab) : undefined;
    }
    private toTab(tab: chrome.tabs.Tab): Tab {
        return {
            id: tab.id!,
            windowId: tab.windowId,
            title: tab.title || '',
            url: tab.url,
            lastAccessed: tab.lastAccessed,
            icon: tab.favIconUrl,
            splitViewId: tab.splitViewId,
        };
    }
    async activate(tabId: number): Promise<void> {
        const tab = await chrome.tabs.get(tabId);
        await chrome.tabs.update(tabId, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
    }

    async move(direction: MoveTabDirection, tabId: number): Promise<void> {
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

    async close(tabId: number): Promise<void> {
        await chrome.tabs.remove(tabId);
    }
};

class DefaultChrome implements ChromeApi {
    tabs: ChromeTabApi;

    constructor() {
        this.tabs = new DefaultTabs();
    }

    closePopup(): void {
        window.close();
    }
}
export const Chrome = new DefaultChrome();