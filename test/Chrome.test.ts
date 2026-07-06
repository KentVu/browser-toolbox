import Chrome from '@src/lib/Chrome';
import { describe, it, expect, test, afterEach } from 'vitest'

describe('Chrome API wrapper', () => {
    describe('tabs', () => {
        afterEach(() => {
            chrome.tabs._tabs = [];
        });

        it('should return open tabs for Chrome.tabs.get()', async () => {
            await chrome.tabs.create({ url: 'https://www.example.com' });
            const tabs = await Chrome.tabs.get();
            expect(tabs).toHaveLength(1);
            expect(tabs[0].url).toBe('https://www.example.com');
        });

        // TODO use lastAccessed from chrome.tabs.query
        it('should display tabs in recently activated order for Chrome.tabs.getByLastAccessed()', async () => {
            const tab1 = await chrome.tabs.create({ url: 'https://www.example.com' });
            const tab2 = await chrome.tabs.create({ url: 'https://www.example.org' });
            let tabs = await Chrome.tabs.getByLastAccessed();
            expect(tabs).toHaveLength(2);
            expect(tabs[0].url).toBe(tab2.url);
            expect(tabs[1].url).toBe(tab1.url);
            await Chrome.tabs.activate(tab1.id as number);
            tabs = await Chrome.tabs.getByLastAccessed();
            expect(tabs[0].url).toBe(tab1.url);
            expect(tabs[1].url).toBe(tab2.url);
        });
    });
});