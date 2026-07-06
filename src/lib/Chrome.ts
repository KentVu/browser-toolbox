import { Tab } from '@src/lib/Tab';

const Chrome = {
    tabs: {
        get: async (): Promise<Tab[]> => {
            const chromeTabs = await chrome.tabs.query({});
            return chromeTabs
                .map((t): Tab => ({
                    id: t.id!,
                    title: t.title || '',
                    url: t.url,
                    lastAccessed: t.lastAccessed,
                }))
        },
        getByLastAccessed: async (): Promise<Tab[]> => {
            const chromeTabs = await Chrome.tabs.get();
            return chromeTabs
                .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
        },
        activate: async (tabId: number): Promise<void> => {
            await chrome.tabs.update(tabId, { active: true });
        },
    }
};

export default Chrome;