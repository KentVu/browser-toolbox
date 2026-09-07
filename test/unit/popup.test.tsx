import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Popup from '@pages/popup/Popup';
import { shortcutKeys } from '@src/lib/constants';
import type { Tab } from '@src/lib/Tab';
import { PopupShadow } from '@src/pages/popup/PopupShadow';
import { createMockChromeApi } from './MockChrome';

afterEach(() => {
  cleanup();
});

describe('Popup', () => {
  describe('Tablist', () => {
    const tabList: Tab[] = [
      { id: 1, title: 'Docs', url: 'https://docs.example.com/page', lastAccessed: 1000, icon: 'https://docs.example.com/favicon.ico' },
      { id: 3, title: 'game', url: 'https://game.example.com/inbox', lastAccessed: 2000, icon: 'https://game.example.com/favicon.ico' },
    ];
    it('lists all tabs in all windows sorted by last accessed', async () => {
      const chrome = createMockChromeApi(tabList);
      const shadow = new PopupShadow(chrome);

      await renderAndWait(<Popup shadow={shadow} />);

      // Most recent tab (higher lastAccessed) should be listed first
      const items = await screen.findAllByRole('listitem') as HTMLLIElement[];
      const state = shadow.s();
      await expectTabItem(items[0], 'game', 'game.example.com', state.tabKeyMap.get(tabList[1].id)!, tabList[1].icon);
      await expectTabItem(items[1], 'Docs', 'docs.example.com', state.tabKeyMap.get(tabList[0].id)!, tabList[0].icon);
    });

    it('displays each tab icon when available', async () => {
      const chrome = createMockChromeApi(tabList);
      const shadow = new PopupShadow(chrome);

      await renderAndWait(<Popup shadow={shadow} />);

      const items = await screen.findAllByRole('listitem') as HTMLLIElement[];
      expect((items[0].querySelector('img') as HTMLImageElement).src).toBe(tabList[1].icon);
      expect((items[1].querySelector('img') as HTMLImageElement).src).toBe(tabList[0].icon);
    });

    it('selects the correct tab when a key is pressed', async () => {
      const chrome = createMockChromeApi(tabList);
      const shadow = new PopupShadow(chrome);

      await renderAndWait(<Popup shadow={shadow} />);
      const secondTabKey = shadow.s().tabKeyMap.get(tabList[1].id);
      fireEvent.keyDown(document, { key: secondTabKey });
      const item = (await screen.findByText(tabList[1].title)).closest('li')!;
      expect(item.classList.contains('selected')).toBe(true);
    });

    it('selects the current active tab after loading', async () => {
      const currentTab = tabList[0];
      const chrome = createMockChromeApi(tabList, currentTab);
      const shadow = new PopupShadow(chrome);

      await renderAndWait(<Popup shadow={shadow} />);

      expect(shadow.s().selectedTabId).toBe(currentTab.id);
    });

    it('Show correct guidance according to current state', async () => {
      const chrome = createMockChromeApi(tabList);
      const shadow = new PopupShadow(chrome);

      await renderAndWait(<Popup shadow={shadow} />);
      // Initially, the guidance should be "Press a key to select a tab"
      expect(await screen.findByText('Press a key to select a tab')).toBeTruthy();
      const state = shadow.s();
      fireEvent.keyDown(document, { key: state.tabKeyMap.get(tabList[1].id)! });
      // After selecting a tab, the guidance should change
      expect(await screen.findByText('Select next action:')).toBeTruthy();
      const keyLabel = await screen.findByText((content, element) =>
        element?.tagName === 'SPAN' && element.textContent === ']'
      );
      const container = keyLabel.closest('li')!;
      expect(within(container).getByText(/Move tab to the right of current tab/)).toBeTruthy();
    });

    it('activates the selected tab when Enter is pressed', async () => {
      const chrome = createMockChromeApi(tabList);
      const shadow = new PopupShadow(chrome);

      await renderAndWait(<Popup shadow={shadow} />);
      const state = shadow.s();
      fireEvent.keyDown(document, { key: state.tabKeyMap.get(tabList[1].id)! });
      fireEvent.keyDown(document, { key: 'Enter' });

      expect(chrome.tabs.activate).toHaveBeenCalledWith(tabList[1].id);
      expect(chrome.tabs.close).toHaveBeenCalled();
    });

    it('move selected tab to the right of current tab', async () => {
      await expectMoveSelectedTab(']', 'toTheRight');
    });

    it('move selected tab to the left of current tab', async () => {
      await expectMoveSelectedTab('[', 'toTheLeft');
    });

    describe('pagination', () => {
      it('reserves j and k keys away from tab shortcuts', () => {
        expect(shortcutKeys).not.toContain('j');
        expect(shortcutKeys).not.toContain('k');
        expect(shortcutKeys.length).toBeGreaterThanOrEqual(10);
      });

      it('shows at most 10 tabs on the first page', async () => {
        const manyTabs = makeTabs(11);
        const chrome = createMockChromeApi(manyTabs);
        const shadow = new PopupShadow(chrome);

        render(<Popup shadow={shadow} />);
        await screen.findByText('Tab 1');

        expect(screen.getByText('Tab 1')).toBeTruthy();
        expect(screen.getByText('Tab 10')).toBeTruthy();
        expect(screen.queryByText('Tab 11')).toBeNull();
        expect(shadow.s().pageIndex).toBe(0);
      });

      it('navigates pages with . and , while keeping slot shortcut keys stable', async () => {
        const manyTabs = makeTabs(11);
        const chrome = createMockChromeApi(manyTabs);
        const shadow = new PopupShadow(chrome);

        render(<Popup shadow={shadow} />);
        await screen.findByText('Tab 1');

        const firstPageFirstKey = shadow.s().tabKeyMap.get(manyTabs[0].id);
        expect(firstPageFirstKey).toBeTruthy();

        fireEvent.keyDown(document, { key: '.' });

        expect(shadow.s().pageIndex).toBe(1);
        expect(screen.queryByText('Tab 1')).toBeNull();
        expect(await screen.findByText('Tab 11')).toBeTruthy();
        expect(shadow.s().tabKeyMap.get(manyTabs[10].id)).toBe(firstPageFirstKey);

        fireEvent.keyDown(document, { key: ',' });

        expect(shadow.s().pageIndex).toBe(0);
        expect(await screen.findByText('Tab 1')).toBeTruthy();
        expect(shadow.s().tabKeyMap.get(manyTabs[0].id)).toBe(firstPageFirstKey);
      });
    });

    async function expectMoveSelectedTab(
      actionKey: string,
      direction: 'toTheRight' | 'toTheLeft',
    ) {
      const _tabList: Tab[] = [...tabList,
        { id: 4, title: 'Music', url: 'https://music.example.com', lastAccessed: 1500 }
      ];
      const mockChrome = createMockChromeApi(_tabList);
      const shadow = new PopupShadow(mockChrome);

      await renderAndWait(<Popup shadow={shadow} />);
      const state = shadow.s();
      fireEvent.keyDown(document, { key: state.tabKeyMap.get(_tabList[2].id)! });
      fireEvent.keyDown(document, { key: actionKey });

      expect(mockChrome.tabs.moveTab).toHaveBeenCalledWith(direction, _tabList[2].id);
      expect(mockChrome.tabs.activate).toHaveBeenCalledWith(_tabList[2].id);
      expect(mockChrome.tabs.close).toHaveBeenCalled();
    }
  });
});

async function renderAndWait(
  ui: React.ReactNode,
) {
  render(ui);
  // Wait for async tab load so key handlers see the populated list.
  await screen.findByText('game');
}

async function expectTabItem(item: HTMLLIElement, title: string, hostname: string, shortcut: string, icon?: string) {
  expect(within(item).getByText(title)).toBeTruthy();
  expect(within(item).getByText(hostname)).toBeTruthy();
  // Matcher requires the span's full text to equal the shortcut (not a substring).
  within(item).getByText((text, el) => el?.tagName === 'SPAN' && text === shortcut);
  if (icon) {
    const img = item.querySelector('img') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img!.src).toBe(icon);
  }
}

function makeTabs(count: number): Tab[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Tab ${i + 1}`,
    url: `https://example.com/${i + 1}`,
    lastAccessed: 1000 - i,
  }));
}
