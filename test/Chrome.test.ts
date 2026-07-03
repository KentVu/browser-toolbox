import Chrome from '@src/lib/Chrome';
import { describe, it, expect, test, afterEach } from 'vitest'

describe('Chrome API wrapper', () => {
    describe('tabs.get()', () => {
        afterEach(() => {
            chrome.tabs._tabs = [];
        });

        it('should return open tabs for Chrome.tabs.get()', async () => {
            await chrome.tabs.create({ url: 'https://www.example.com' });
            const tabs = await Chrome.tabs.get();
            expect(tabs).toHaveLength(1);
            expect(tabs[0].url).toBe('https://www.example.com');
        });

        // TODO use onActivated!!
        it('should display tabs in recently activated order', async () => {
            const tab1 = await chrome.tabs.create({ url: 'https://www.example.com' });
            const tab2 = await chrome.tabs.create({ url: 'https://www.example.org' });
            await chrome.tabs.activate(tab1.id);
            const tabs = await Chrome.tabs.get();
            expect(tabs).toHaveLength(2);
            expect(tabs[0].url).toBe('https://www.example.com');
            expect(tabs[1].url).toBe('https://www.example.org');
        });
    });
});