import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Popup from '@pages/popup/Popup';
import { PAGE_SIZE, shortcutKeys } from '@src/lib/constants';
import type { Tab } from '@src/lib/Tab';
import { PopupPresenter } from '@src/pages/popup/PopupPresenter';
import { createMockBrowserApi } from './MockBrowser';
import { createMockChromeApi } from './MockChrome';

afterEach(() => {
  cleanup();
});

describe('Popup', () => {
  describe('Tablist', () => {
    const tabList: Tab[] = [
      { id: 1, title: 'Docs', url: 'https://docs.example.com/page', lastAccessed: 1000, icon: 'https://docs.example.com/favicon.ico', splitViewId: 900000001 },
      { id: 3, title: 'game', url: 'https://game.example.com/inbox', lastAccessed: 2000, icon: 'https://game.example.com/favicon.ico', splitViewId: 900000002 },
    ];
    let chrome: ReturnType<typeof createMockChromeApi>;
    let browser: ReturnType<typeof createMockBrowserApi>;
    let presenter: PopupPresenter;

    function setup(tabs: Tab[] = tabList, currentTab?: Tab) {
      chrome = createMockChromeApi(tabs, currentTab);
      browser = createMockBrowserApi();
      presenter = new PopupPresenter(chrome, browser);
    }

    it('lists all tabs in all windows sorted by last accessed', async () => {
      setup();

      await renderAndWait(<Popup presenter={presenter} />);

      // Most recent tab (higher lastAccessed) should be listed first
      const items = await screen.findAllByRole('listitem') as HTMLLIElement[];
      const state = presenter.s();
      await expectTabItem(items[0], 'game', 'game.example.com', state.tabKeyMap.get(tabList[1].id)!, tabList[1].icon);
      await expectTabItem(items[1], 'Docs', 'docs.example.com', state.tabKeyMap.get(tabList[0].id)!, tabList[0].icon);
    });

    it('displays a link icon and split view ID next to the hostname', async () => {
      setup();

      await renderAndWait(<Popup presenter={presenter} />);

      const items = await screen.findAllByRole('listitem') as HTMLLIElement[];
      expect(within(items[0]).getByLabelText('Split view 2').textContent).toBe('🔗2');
      expect(within(items[1]).getByLabelText('Split view 1').textContent).toBe('🔗1');
    });

    it('does not display the split view none sentinel', async () => {
      const tabs = [{ ...tabList[0], splitViewId: -1 }];
      setup(tabs);

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Docs');

      const item = (await screen.findByText('Docs')).closest('li')!;
      expect(within(item).queryByLabelText('Split view -1')).toBeNull();
      expect(within(item).getByText('docs.example.com')).toBeTruthy();
    });

    it('displays each tab icon when available', async () => {
      setup();

      await renderAndWait(<Popup presenter={presenter} />);

      const items = await screen.findAllByRole('listitem') as HTMLLIElement[];
      expect((items[0].querySelector('img') as HTMLImageElement).src).toBe(tabList[1].icon);
      expect((items[1].querySelector('img') as HTMLImageElement).src).toBe(tabList[0].icon);
    });

    it('displays the window ID for tabs in a different window', async () => {
      const tabs = [
        { ...tabList[0], windowId: 10 },
        { ...tabList[1], windowId: 20 },
      ];
      setup(tabs, tabs[1]);

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'game');

      expect(screen.getByLabelText('Window 1').textContent).toBe('🪟1');
      expect(screen.queryByLabelText('Window 2')).toBeNull();
    });

    it('selects the correct tab when a key is pressed', async () => {
      setup();

      await renderAndWait(<Popup presenter={presenter} />);
      const secondTabKey = presenter.s().tabKeyMap.get(tabList[1].id);
      fireEvent.keyDown(document, { key: secondTabKey });
      const item = (await screen.findByText(tabList[1].title)).closest('li')!;
      expect(item.classList.contains('selected')).toBe(true);
    });

    it('moves selection with the up and down arrow keys', async () => {
      setup();

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'game');

      fireEvent.keyDown(document, { key: 'ArrowDown' });
      expect(presenter.s().selectedTabId).toBe(tabList[0].id);

      fireEvent.keyDown(document, { key: 'ArrowUp' });
      expect(presenter.s().selectedTabId).toBe(tabList[1].id);
    });

    it('selects a tab when its row is clicked', async () => {
      setup();

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'game');

      const docsItem = (await screen.findByText(tabList[0].title)).closest('li')!;
      fireEvent.click(docsItem);

      expect(presenter.s().selectedTabId).toBe(tabList[0].id);
      expect(chrome.tabs.activate).not.toHaveBeenCalled();
    });

    it('selects the previously visited tab after loading', async () => {
      const currentTab = tabList[1]; // most recently accessed
      const previousTab = tabList[0]; // visited before current
      setup(tabList, currentTab);

      await renderAndWait(<Popup presenter={presenter} />);

      expect(presenter.s().selectedTabId).toBe(previousTab.id);
    });

    it('Show correct guidance according to current state', async () => {
      setup();

      await renderAndWait(<Popup presenter={presenter} />);
      // Previously visited tab is pre-selected, so action guidance is shown
      expect(await screen.findByText('Select next action:')).toBeTruthy();
      expect(screen.getByText(/Move selection down\/up \(pages at edges\)/)).toBeTruthy();
      const keyLabel = await screen.findByText((content, element) =>
        element?.tagName === 'KBD' && element.textContent === ']'
      );
      expect(keyLabel.classList.contains('text-cyan-200')).toBe(true);
      const container = keyLabel.closest('li')!;
      expect(within(container).getByText(/Move tab to the right\/left of current tab/)).toBeTruthy();
    });

    it('activates the selected tab when Enter is pressed', async () => {
      setup();

      await renderAndWait(<Popup presenter={presenter} />);
      const state = presenter.s();
      fireEvent.keyDown(document, { key: state.tabKeyMap.get(tabList[1].id)! });
      fireEvent.keyDown(document, { key: 'Enter' });

      expect(chrome.tabs.activate).toHaveBeenCalledWith(tabList[1].id);
      await waitFor(() => expect(chrome.closePopup).toHaveBeenCalled());
    });

    it('closes the selected tab when Ctrl-W is pressed and refreshes the list', async () => {
      const tabs = makeTabs(3);
      setup(tabs, tabs[0]);
      const closedTab = tabs[1]; // pre-selected: previously visited

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Tab 1');
      expect(presenter.s().selectedTabId).toBe(closedTab.id);

      fireEvent.keyDown(document, { key: 'w', ctrlKey: true });

      expect(chrome.tabs.close).toHaveBeenCalledWith(closedTab.id);
      expect(chrome.closePopup).not.toHaveBeenCalled();
      await screen.findByText('Tab 3');
      expect(screen.queryByText(closedTab.title)).toBeNull();
      expect(presenter.s().tabList.map(tab => tab.id)).toEqual([1, 3]);
    });

    it('copies the selected tab URL when Ctrl-C is pressed', async () => {
      const tabs = makeTabs(3);
      setup(tabs, tabs[0]);

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Tab 1');
      expect(presenter.s().selectedTabId).toBe(tabs[1].id);

      fireEvent.keyDown(document, { key: 'c', ctrlKey: true });

      await waitFor(() => expect(browser.clipboard.writeText).toHaveBeenCalledWith(tabs[1].url));
      expect(chrome.closePopup).not.toHaveBeenCalled();
    });

    it('pastes a clipboard URL into the selected tab when Ctrl-V is pressed', async () => {
      const tabs = makeTabs(3);
      setup(tabs, tabs[0]);
      vi.mocked(browser.clipboard.readText).mockResolvedValue('https://pasted.example.com/page');

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Tab 1');
      expect(presenter.s().selectedTabId).toBe(tabs[1].id);

      fireEvent.keyDown(document, { key: 'v', ctrlKey: true });

      await waitFor(() => {
        expect(browser.clipboard.readText).toHaveBeenCalled();
        expect(chrome.tabs.updateUrl).toHaveBeenCalledWith(tabs[1].id, 'https://pasted.example.com/page');
      });
      expect(chrome.tabs.activate).not.toHaveBeenCalled();
      expect(chrome.closePopup).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByText('pasted.example.com')).toBeTruthy();
    });

    it('shows a footer error when Ctrl-V clipboard text is not a URL', async () => {
      const tabs = makeTabs(3);
      setup(tabs, tabs[0]);
      vi.mocked(browser.clipboard.readText).mockResolvedValue('not a url');

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Tab 1');

      fireEvent.keyDown(document, { key: 'v', ctrlKey: true });

      expect((await screen.findByRole('alert')).textContent).toBe('Not a URL to paste!');
      expect(chrome.tabs.updateUrl).not.toHaveBeenCalled();
      expect(chrome.closePopup).not.toHaveBeenCalled();
    });

    it('shows a footer error when Ctrl-V clipboard text is empty', async () => {
      const tabs = makeTabs(3);
      setup(tabs, tabs[0]);
      vi.mocked(browser.clipboard.readText).mockResolvedValue('   ');

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Tab 1');

      fireEvent.keyDown(document, { key: 'v', ctrlKey: true });

      expect((await screen.findByRole('alert')).textContent).toBe('Not a URL to paste!');
      expect(chrome.tabs.updateUrl).not.toHaveBeenCalled();
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
        setup(tabs, tabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Tab 1');

        // Current is Tab 1 → previous (pre-selected) is Tab 2
        expect(presenter.s().selectedTabId).toBe(tabs[1].id);

        fireEvent.keyDown(document, { key: 'j' });
        expect(presenter.s().selectedTabId).toBe(tabs[2].id);

        fireEvent.keyDown(document, { key: 'k' });
        expect(presenter.s().selectedTabId).toBe(tabs[1].id);

        fireEvent.keyDown(document, { key: 'k' });
        expect(presenter.s().selectedTabId).toBe(tabs[0].id);
      });

      it('clamps selection at the ends when there is no adjacent page', async () => {
        const tabs = makeTabs(3);
        setup(tabs, tabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Tab 1');

        fireEvent.keyDown(document, { key: 'k' }); // Tab 2 → Tab 1
        fireEvent.keyDown(document, { key: 'k' }); // already first page/item
        expect(presenter.s().selectedTabId).toBe(tabs[0].id);
        expect(presenter.s().pageIndex).toBe(0);

        fireEvent.keyDown(document, { key: 'j' });
        fireEvent.keyDown(document, { key: 'j' });
        fireEvent.keyDown(document, { key: 'j' }); // already last page/item
        expect(presenter.s().selectedTabId).toBe(tabs[2].id);
        expect(presenter.s().pageIndex).toBe(0);
      });

      it('jumps to page edges with J/K and changes page at the edge', async () => {
        const manyTabs = makeTabs(15);
        setup(manyTabs, manyTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Tab 1');
        // Current is Tab 1 → previous (pre-selected) is Tab 2
        expect(presenter.s().selectedTabId).toBe(manyTabs[1].id);

        fireEvent.keyDown(document, { key: 'J', shiftKey: true });
        expect(presenter.s().pageIndex).toBe(0);
        expect(presenter.s().selectedTabId).toBe(manyTabs[9].id);

        fireEvent.keyDown(document, { key: 'PageDown' });
        expect(presenter.s().pageIndex).toBe(1);

        fireEvent.keyDown(document, { key: 'J', shiftKey: true });
        expect(presenter.s().pageIndex).toBe(1);
        expect(presenter.s().selectedTabId).toBe(manyTabs[14].id);

        fireEvent.keyDown(document, { key: 'K', shiftKey: true });
        expect(presenter.s().pageIndex).toBe(1);
        expect(presenter.s().selectedTabId).toBe(manyTabs[10].id);

        fireEvent.keyDown(document, { key: 'PageUp' });
        expect(presenter.s().pageIndex).toBe(0);
      });

      it('selects the nearest visible item with J/K when selection is off-page', async () => {
        const manyTabs = makeTabs(11);
        setup(manyTabs, manyTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Tab 1');

        fireEvent.keyDown(document, { key: '.' }); // move to next page
        expect(presenter.s().pageIndex).toBe(1);

        // Selection may still point at a previous-page tab; J selects the last visible item
        fireEvent.keyDown(document, { key: 'J', shiftKey: true });
        expect(presenter.s().selectedTabId).toBe(manyTabs[10].id);

        fireEvent.keyDown(document, { key: 'J', shiftKey: true });
        expect(presenter.s().selectedTabId).toBe(manyTabs[10].id); // last page — no further page
        expect(presenter.s().pageIndex).toBe(1);
      });
    });

    describe('pagination', () => {
      it('reserves j and k for item navigation', () => {
        expect(shortcutKeys).not.toContain('j');
        expect(shortcutKeys).not.toContain('k');
        expect(shortcutKeys.length).toBeGreaterThan(PAGE_SIZE);
      });

      it('shows at most 10 tabs on the first page', async () => {
        const manyTabs = makeTabs(11);
        setup(manyTabs);

        render(<Popup presenter={presenter} />);
        await screen.findByText('Tab 1');

        expect(screen.getByText('Tab 1')).toBeTruthy();
        expect(screen.getByText('Tab 10')).toBeTruthy();
        expect(screen.queryByText('Tab 11')).toBeNull();
        expect(presenter.s().pageIndex).toBe(0);
      });

      it('uses . and , for next and previous page', async () => {
        const manyTabs = makeTabs(15);
        setup(manyTabs, manyTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Tab 1');
        // Current is Tab 1 → previous (pre-selected) is Tab 2
        expect(presenter.s().selectedTabId).toBe(manyTabs[1].id);

        fireEvent.keyDown(document, { key: '.' });
        expect(presenter.s().pageIndex).toBe(1);
        expect(presenter.s().selectedTabId).toBe(manyTabs[1].id);

        fireEvent.keyDown(document, { key: ',' });
        expect(presenter.s().pageIndex).toBe(0);
        expect(presenter.s().selectedTabId).toBe(manyTabs[1].id);
      });

      it('navigates pages with . and , while keeping slot shortcut keys stable', async () => {
        const manyTabs = makeTabs(11);
        setup(manyTabs);

        render(<Popup presenter={presenter} />);
        await screen.findByText('Tab 1');

        const firstPageFirstKey = presenter.s().tabKeyMap.get(manyTabs[0].id);
        expect(firstPageFirstKey).toBeTruthy();

        // . advances directly to the next page.
        fireEvent.keyDown(document, { key: '.' });
        expect(presenter.s().pageIndex).toBe(1);
        expect(presenter.s().selectedTabId).toBe(manyTabs[0].id);
        expect(screen.queryByText('Tab 1')).toBeNull();
        expect(await screen.findByText('Tab 11')).toBeTruthy();
        expect(presenter.s().tabKeyMap.get(manyTabs[10].id)).toBe(firstPageFirstKey);

        // , returns directly to the previous page without changing selection.
        fireEvent.keyDown(document, { key: ',' });
        expect(presenter.s().pageIndex).toBe(0);
        expect(presenter.s().selectedTabId).toBe(manyTabs[0].id);
        expect(await screen.findByText('Tab 1')).toBeTruthy();
        expect(presenter.s().tabKeyMap.get(manyTabs[0].id)).toBe(firstPageFirstKey);
      });
    });

    async function expectMoveSelectedTab(
      actionKey: string,
      direction: 'toTheRight' | 'toTheLeft',
    ) {
      const _tabList: Tab[] = [...tabList,
        { id: 4, title: 'Music', url: 'https://music.example.com', lastAccessed: 1500 }
      ];
      setup(_tabList);

      await renderAndWait(<Popup presenter={presenter} />);
      const state = presenter.s();
      fireEvent.keyDown(document, { key: state.tabKeyMap.get(_tabList[2].id)! });
      fireEvent.keyDown(document, { key: actionKey });

      expect(chrome.tabs.move).toHaveBeenCalledWith(direction, _tabList[2].id);
      await waitFor(() => {
        expect(chrome.tabs.activate).toHaveBeenCalledWith(_tabList[2].id);
        expect(chrome.closePopup).toHaveBeenCalled();
      });
      expect(vi.mocked(chrome.tabs.move).mock.invocationCallOrder[0])
        .toBeLessThan(vi.mocked(chrome.tabs.activate).mock.invocationCallOrder[0]);
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
  // Matcher requires the key label's full text to equal the shortcut (not a substring).
  within(item).getByText((text, el) => el?.tagName === 'KBD' && text === shortcut);
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
