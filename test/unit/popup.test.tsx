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

    it('selects the previously visited tab after loading', async () => {
      const currentTab = tabList[1]; // most recently accessed
      const previousTab = tabList[0]; // visited before current
      const chrome = createMockChromeApi(tabList, currentTab);
      const shadow = new PopupShadow(chrome);

      await renderAndWait(<Popup shadow={shadow} />);

      expect(shadow.s().selectedTabId).toBe(previousTab.id);
    });

    it('Show correct guidance according to current state', async () => {
      const chrome = createMockChromeApi(tabList);
      const shadow = new PopupShadow(chrome);

      await renderAndWait(<Popup shadow={shadow} />);
      // Previously visited tab is pre-selected, so action guidance is shown
      expect(await screen.findByText('Select next action:')).toBeTruthy();
      expect(screen.getByText(/Move selection down\/up/)).toBeTruthy();
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

    describe('j/k item navigation', () => {
      it('moves selection down with j and up with k within the visible page', async () => {
        const tabs = makeTabs(3);
        const chrome = createMockChromeApi(tabs, tabs[0]);
        const shadow = new PopupShadow(chrome);

        await renderAndWaitForTitle(<Popup shadow={shadow} />, 'Tab 1');

        // Current is Tab 1 → previous (pre-selected) is Tab 2
        expect(shadow.s().selectedTabId).toBe(tabs[1].id);

        fireEvent.keyDown(document, { key: 'j' });
        expect(shadow.s().selectedTabId).toBe(tabs[2].id);

        fireEvent.keyDown(document, { key: 'k' });
        expect(shadow.s().selectedTabId).toBe(tabs[1].id);

        fireEvent.keyDown(document, { key: 'k' });
        expect(shadow.s().selectedTabId).toBe(tabs[0].id);
      });

      it('clamps selection at the ends of the visible page', async () => {
        const tabs = makeTabs(3);
        const chrome = createMockChromeApi(tabs, tabs[0]);
        const shadow = new PopupShadow(chrome);

        await renderAndWaitForTitle(<Popup shadow={shadow} />, 'Tab 1');

        fireEvent.keyDown(document, { key: 'k' }); // Tab 2 → Tab 1
        fireEvent.keyDown(document, { key: 'k' }); // already first
        expect(shadow.s().selectedTabId).toBe(tabs[0].id);

        fireEvent.keyDown(document, { key: 'j' });
        fireEvent.keyDown(document, { key: 'j' });
        fireEvent.keyDown(document, { key: 'j' }); // already last
        expect(shadow.s().selectedTabId).toBe(tabs[2].id);
      });

      it('navigates only within the current page after pagination', async () => {
        const manyTabs = makeTabs(11);
        const chrome = createMockChromeApi(manyTabs, manyTabs[0]);
        const shadow = new PopupShadow(chrome);

        await renderAndWaitForTitle(<Popup shadow={shadow} />, 'Tab 1');

        fireEvent.keyDown(document, { key: '.' });
        expect(shadow.s().pageIndex).toBe(1);

        // Selection may still point at a previous-page tab; j selects first visible item
        fireEvent.keyDown(document, { key: 'j' });
        expect(shadow.s().selectedTabId).toBe(manyTabs[10].id);

        fireEvent.keyDown(document, { key: 'j' });
        expect(shadow.s().selectedTabId).toBe(manyTabs[10].id); // only one item on page 2
        expect(shadow.s().pageIndex).toBe(1);
      });
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
  await renderAndWaitForTitle(ui, 'game');
}

async function renderAndWaitForTitle(
  ui: React.ReactNode,
  title: string,
) {
  render(ui);
  // Wait for async tab load so key handlers see the populated list.
  await screen.findByText(title);
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
