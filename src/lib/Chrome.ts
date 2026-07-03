import { Tab } from '@src/lib/Tab';

const Chrome = {
    tabs: {
        get: async (): Promise<Tab[]> => {
            const chromeTabs = await chrome.tabs.query({});
            return chromeTabs.map((t): Tab => ({
                id: t.id!,
                title: t.title || '',
                url: t.url,
            }));
        },
        activate: async (tabId: number): Promise<void> => {
            await chrome.tabs.activate(tabId);
        },
    }
};

export default Chrome;