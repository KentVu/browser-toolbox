import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chrome } from '@src/lib/Chrome';
import { createMockChromeApi } from './MockChrome';

describe('ChromeAPI', () => {
  describe('tabs', () => {
    it('getByLastAccessed', async () => {
      const chrome = createMockChromeApi([
        { id: 1, title: 'Docs', url: 'https://docs.example.com/page', lastAccessed: 1000 },
        { id: 3, title: 'game', url: 'https://game.example.com/inbox', lastAccessed: 2000 },
      ]);
      const tabs = await chrome.tabs.getByLastAccessed();
      expect(tabs).toEqual([
        { id: 3, title: 'game', url: 'https://game.example.com/inbox', lastAccessed: 2000 },
        { id: 1, title: 'Docs', url: 'https://docs.example.com/page', lastAccessed: 1000 },
      ]);
    });

    describe('activate', () => {
      const originalChrome = (globalThis as any).chrome;

      afterEach(() => {
        (globalThis as any).chrome = originalChrome;
      });

      it('activates the tab and focuses its window', async () => {
        const get = vi.fn().mockResolvedValue({ id: 42, windowId: 7 });
        const update = vi.fn().mockResolvedValue({});
        const windowsUpdate = vi.fn().mockResolvedValue({});

        (globalThis as any).chrome = {
          tabs: { get, update },
          windows: { update: windowsUpdate },
        };

        await Chrome.tabs.activate(42);

        expect(get).toHaveBeenCalledWith(42);
        expect(update).toHaveBeenCalledWith(42, { active: true });
        expect(windowsUpdate).toHaveBeenCalledWith(7, { focused: true });
      });
    });

    describe('remove', () => {
      const originalChrome = (globalThis as any).chrome;

      afterEach(() => {
        (globalThis as any).chrome = originalChrome;
      });

      it('closes the tab via chrome.tabs.remove', async () => {
        const remove = vi.fn().mockResolvedValue(undefined);

        (globalThis as any).chrome = {
          tabs: { remove },
        };

        await Chrome.tabs.remove(42);

        expect(remove).toHaveBeenCalledWith(42);
      });
    });
  });

  describe('closePopup', () => {
    it('closes the popup window', () => {
      const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);

      Chrome.closePopup();

      expect(close).toHaveBeenCalled();
      close.mockRestore();
    });
  });
});