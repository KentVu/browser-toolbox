import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
        const get = vi.fn().mockResolvedValue({ id: 42, windowId: 7, discarded: false });
        const update = vi.fn().mockResolvedValue({});
        const reload = vi.fn().mockResolvedValue({});
        const windowsUpdate = vi.fn().mockResolvedValue({});

        (globalThis as any).chrome = {
          tabs: { get, update, reload },
          windows: { update: windowsUpdate },
        };

        await Chrome.tabs.activate(42);

        expect(get).toHaveBeenCalledWith(42);
        expect(update).toHaveBeenCalledWith(42, { active: true });
        expect(windowsUpdate).toHaveBeenCalledWith(7, { focused: true });
        expect(reload).not.toHaveBeenCalled();
      });

      it('reloads a discarded tab after activation so Chrome restores its content', async () => {
        const get = vi.fn().mockResolvedValue({ id: 42, windowId: 7, discarded: true });
        const update = vi.fn().mockResolvedValue({});
        const reload = vi.fn().mockResolvedValue({});
        const windowsUpdate = vi.fn().mockResolvedValue({});

        (globalThis as any).chrome = {
          tabs: { get, update, reload },
          windows: { update: windowsUpdate },
        };

        await Chrome.tabs.activate(42);

        expect(get).toHaveBeenCalledWith(42);
        expect(update).toHaveBeenCalledWith(42, { active: true });
        expect(windowsUpdate).toHaveBeenCalledWith(7, { focused: true });
        expect(reload).toHaveBeenCalledWith(42);
      });
    });

    describe('close', () => {
      const originalChrome = (globalThis as any).chrome;

      afterEach(() => {
        (globalThis as any).chrome = originalChrome;
      });

      it('closes the tab via chrome.tabs.remove', async () => {
        const remove = vi.fn().mockResolvedValue(undefined);

        (globalThis as any).chrome = {
          tabs: { remove },
        };

        await Chrome.tabs.close(42);

        expect(remove).toHaveBeenCalledWith(42);
      });
    });

    describe('updateUrl', () => {
      const originalChrome = (globalThis as any).chrome;

      afterEach(() => {
        (globalThis as any).chrome = originalChrome;
      });

      it('updates the tab URL via chrome.tabs.update', async () => {
        const update = vi.fn().mockResolvedValue({});

        (globalThis as any).chrome = {
          tabs: { update },
        };

        await Chrome.tabs.updateUrl(42, 'https://pasted.example.com');

        expect(update).toHaveBeenCalledWith(42, { url: 'https://pasted.example.com' });
      });
    });

    describe('breakIntoNewWindow', () => {
      const originalChrome = (globalThis as any).chrome;

      afterEach(() => {
        (globalThis as any).chrome = originalChrome;
      });

      it('moves the tab into a new window via chrome.windows.create', async () => {
        const create = vi.fn().mockResolvedValue({ id: 99 });

        (globalThis as any).chrome = {
          windows: { create },
        };

        await Chrome.tabs.breakIntoNewWindow(42);

        expect(create).toHaveBeenCalledWith({ tabId: 42 });
      });
    });

    describe('move', () => {
      const originalChrome = (globalThis as any).chrome;
      const activeTab = { id: 2, index: 1, windowId: 10 };
      let query: ReturnType<typeof vi.fn>;
      let get: ReturnType<typeof vi.fn>;
      let move: ReturnType<typeof vi.fn>;

      beforeEach(() => {
        query = vi.fn().mockResolvedValue([activeTab]);
        get = vi.fn();
        move = vi.fn().mockResolvedValue({});
        (globalThis as any).chrome = {
          tabs: { query, get, move },
        };
      });

      afterEach(() => {
        (globalThis as any).chrome = originalChrome;
      });

      it('places a tab from the right immediately left of the active tab', async () => {
        get.mockResolvedValue({ id: 4, index: 3, windowId: 10 });

        await Chrome.tabs.move('toTheLeft', 4);

        expect(move).toHaveBeenCalledWith(4, { index: 1, windowId: 10 });
      });

      it('places a tab from the left immediately left of the active tab', async () => {
        get.mockResolvedValue({ id: 1, index: 0, windowId: 10 });

        await Chrome.tabs.move('toTheLeft', 1);

        expect(move).toHaveBeenCalledWith(1, { index: 0, windowId: 10 });
      });

      it('places a tab from the right immediately right of the active tab', async () => {
        get.mockResolvedValue({ id: 4, index: 3, windowId: 10 });

        await Chrome.tabs.move('toTheRight', 4);

        expect(move).toHaveBeenCalledWith(4, { index: 2, windowId: 10 });
      });

      it('places a tab from the left immediately right of the active tab', async () => {
        get.mockResolvedValue({ id: 1, index: 0, windowId: 10 });

        await Chrome.tabs.move('toTheRight', 1);

        expect(move).toHaveBeenCalledWith(1, { index: 1, windowId: 10 });
      });

      it('places a tab from another window immediately left of the active tab', async () => {
        get.mockResolvedValue({ id: 9, index: 0, windowId: 20 });

        await Chrome.tabs.move('toTheLeft', 9);

        expect(move).toHaveBeenCalledWith(9, { index: 1, windowId: 10 });
      });

      it('places a tab from another window immediately right of the active tab', async () => {
        get.mockResolvedValue({ id: 9, index: 0, windowId: 20 });

        await Chrome.tabs.move('toTheRight', 9);

        expect(move).toHaveBeenCalledWith(9, { index: 2, windowId: 10 });
      });

      it('shifts the active tab itself one position left or right', async () => {
        get.mockResolvedValue(activeTab);

        await Chrome.tabs.move('toTheLeft', activeTab.id);
        expect(move).toHaveBeenCalledWith(activeTab.id, { index: 0, windowId: 10 });

        await Chrome.tabs.move('toTheRight', activeTab.id);
        expect(move).toHaveBeenLastCalledWith(activeTab.id, { index: 2, windowId: 10 });
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