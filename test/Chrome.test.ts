import Chrome from '@src/lib/Chrome';
import { describe, it, expect, test, afterEach } from 'vitest'

describe('Chrome API wrapper', () => {
    it.skip('should return open tabs for Chrome.tabs.get()', async () => {
        await chrome.tabs.create({ url: 'https://www.example.com' });
        const tabs = Chrome.tabs.get();
        expect(tabs).toHaveLength(1);
        expect(tabs[0].url).toBe('https://www.example.com');
    });
});