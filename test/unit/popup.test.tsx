import { cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Popup from '@pages/popup/Popup';
import { PAGE_SIZE, shortcutKeys } from '@src/lib/constants';
import type { Tab } from '@src/lib/Tab';
import { PopupPresenter, resolveShortcutAction } from '@src/pages/popup/PopupPresenter';
import { createMockBrowserApi } from './MockBrowser';
import { createMockChromeApi } from './MockChrome';

afterEach(() => {
  cleanup();
});

describe('Popup shortcut actions', () => {
  it('resolves key aliases to the same named action', () => {
    expect(resolveShortcutAction(',')).toBe('previousPage');
    expect(resolveShortcutAction('arrowleft')).toBe('previousPage');
    expect(resolveShortcutAction('j')).toBe('moveSelectionDown');
    expect(resolveShortcutAction('arrowdown')).toBe('moveSelectionDown');
  });

  it('allows n to select its assigned tab when there is no saved search', async () => {
    const tab: Tab = { id: 1, title: 'Docs', url: 'https://docs.example.com', lastAccessed: 1 };
    const presenter = new PopupPresenter(
      createMockChromeApi([tab]),
      createMockBrowserApi(),
    );
    presenter.setState({ tabList: [tab], tabKeyMap: new Map([[tab.id, 'n']]) });

    await presenter.onKeyPress('n');

    expect(presenter.s().selectedTabId).toBe(tab.id);
  });
});

describe('Popup', () => {
  describe('Tablist', () => {
    const tabList: Tab[] = [
      { id: 1, title: 'Docs', url: 'https://docs.example.com/page', lastAccessed: 1000, icon: 'https://docs.example.com/favicon.ico', splitViewId: 900000001 },
      { id: 3, title: 'game', url: 'https://game.example.com/inbox', lastAccessed: 2000, icon: 'https://game.example.com/favicon.ico', splitViewId: 900000002 },
    ];
    // TODO: make these 3 setup's return object members.
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

    it('displays a duplicate indicator ordered by older tab first', async () => {
      const tabs = [
        { id: 10, title: 'New copy', url: 'https://docs.example.com/page#later', lastAccessed: 3000 },
        { id: 2, title: 'Old copy', url: 'https://docs.example.com/page#earlier', lastAccessed: 1000 },
        { id: 5, title: 'Unique', url: 'https://unique.example.com/', lastAccessed: 2000 },
      ];
      setup(tabs);

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'New copy');

      const oldCopy = (await screen.findByText('Old copy')).closest('li')!;
      const newCopy = (await screen.findByText('New copy')).closest('li')!;
      const unique = (await screen.findByText('Unique')).closest('li')!;

      expect(within(oldCopy).getByLabelText('Duplicate 1').textContent).toBe('⧉1');
      expect(within(newCopy).getByLabelText('Duplicate 2').textContent).toBe('⧉2');
      expect(within(unique).queryByLabelText(/Duplicate/)).toBeNull();
    });

    it('treats URLs that differ only by fragment as duplicates', async () => {
      const tabs = [
        { id: 1, title: 'With fragment', url: 'https://example.com/a#section', lastAccessed: 2000 },
        { id: 2, title: 'Without fragment', url: 'https://example.com/a', lastAccessed: 1000 },
      ];
      setup(tabs);

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'With fragment');

      expect(screen.getByLabelText('Duplicate 1').textContent).toBe('⧉1');
      expect(screen.getByLabelText('Duplicate 2').textContent).toBe('⧉2');
    });

    it('shows duplicate indicators using the full tab list across pages', async () => {
      const pageTabs = makeTabs(PAGE_SIZE - 1);
      const tabs = [
        { id: 100, title: 'Dup A', url: 'https://dup.example.com/page#one', lastAccessed: 2000 },
        ...pageTabs,
        { id: 101, title: 'Dup B', url: 'https://dup.example.com/page#two', lastAccessed: 1 },
      ];
      setup(tabs);

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Dup A');
      expect(within((await screen.findByText('Dup A')).closest('li')!).getByLabelText('Duplicate 1').textContent).toBe('⧉1');

      fireEvent.keyDown(document, { key: '.' });
      expect(within((await screen.findByText('Dup B')).closest('li')!).getByLabelText('Duplicate 2').textContent).toBe('⧉2');
    });

    it('shows a footer legend only for indicators visible on the current page', async () => {
      const tabs = [
        { id: 1, title: 'Docs', url: 'https://docs.example.com/page', lastAccessed: 1000, windowId: 10, splitViewId: 900000001 },
        { id: 2, title: 'Docs copy', url: 'https://docs.example.com/page#copy', lastAccessed: 3000, windowId: 10 },
        { id: 3, title: 'Other window', url: 'https://other.example.com/', lastAccessed: 2000, windowId: 20 },
      ];
      setup(tabs, tabs[0]);

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Docs copy');

      const legend = screen.getByLabelText('Indicator legend');
      expect(legend.textContent).toContain('🪟 other window');
      expect(legend.textContent).toContain('🔗 split view');
      expect(legend.textContent).toContain('⧉ duplicate');
    });

    it('hides footer legend entries for indicators not visible on the current page', async () => {
      const tabs = [
        { id: 1, title: 'Unique', url: 'https://unique.example.com/', lastAccessed: 1000, windowId: 10 },
      ];
      setup(tabs, tabs[0]);

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Unique');

      expect(screen.queryByLabelText('Indicator legend')).toBeNull();
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

    it('shows a compact ? help hint and keeps full instructions hidden by default', async () => {
      setup();

      await renderAndWait(<Popup presenter={presenter} />);

      expect(screen.getByLabelText('Toggle shortcut help')).toBeTruthy();
      expect(screen.queryByRole('dialog', { name: 'Shortcut help' })).toBeNull();
      expect(screen.queryByText('Select next action:')).toBeNull();
    });

    it('toggles floating shortcut help with ?', async () => {
      setup();

      await renderAndWait(<Popup presenter={presenter} />);

      fireEvent.keyDown(document, { key: '?', shiftKey: true });

      const help = await screen.findByRole('dialog', { name: 'Shortcut help' });
      expect(within(help).getByText('Select next action:')).toBeTruthy();
      expect(within(help).getByText(/Move selection down\/up \(pages at edges\)/)).toBeTruthy();
      expect(within(help).getByText(/Enter search mode/)).toBeTruthy();
      expect(within(help).getByText(/Jump to next search match/)).toBeTruthy();
      const keyLabel = within(help).getByText((content, element) =>
        element?.tagName === 'KBD' && element.textContent === ']'
      );
      expect(keyLabel.classList.contains('text-cyan-200')).toBe(true);
      expect(within(keyLabel.closest('li')!).getByText(/Move selected tab to the right\/left of current tab/)).toBeTruthy();

      fireEvent.keyDown(document, { key: '?', shiftKey: true });
      expect(screen.queryByRole('dialog', { name: 'Shortcut help' })).toBeNull();
    });

    it('closes floating help with Escape without dismissing the popup', async () => {
      setup();

      await renderAndWait(<Popup presenter={presenter} />);
      fireEvent.keyDown(document, { key: '?', shiftKey: true });
      expect(await screen.findByRole('dialog', { name: 'Shortcut help' })).toBeTruthy();

      const escapeEvent = createEvent.keyDown(document, { key: 'Escape' });
      fireEvent(document, escapeEvent);

      expect(escapeEvent.defaultPrevented).toBe(true);
      expect(screen.queryByRole('dialog', { name: 'Shortcut help' })).toBeNull();
      expect(chrome.closePopup).not.toHaveBeenCalled();
    });

    it('closes floating help on selection change, page change, or search', async () => {
      const manyTabs = makeTabs(15);
      setup(manyTabs, manyTabs[0]);

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Tab 1');
      // Current is Tab 1 → previous (pre-selected) is Tab 2
      expect(presenter.s().selectedTabId).toBe(manyTabs[1].id);

      fireEvent.keyDown(document, { key: '?', shiftKey: true });
      expect(await screen.findByRole('dialog', { name: 'Shortcut help' })).toBeTruthy();

      const tabKey = presenter.s().tabKeyMap.get(manyTabs[0].id)!;
      fireEvent.keyDown(document, { key: tabKey });
      expect(presenter.s().selectedTabId).toBe(manyTabs[0].id);
      expect(screen.queryByRole('dialog', { name: 'Shortcut help' })).toBeNull();

      fireEvent.keyDown(document, { key: '?', shiftKey: true });
      expect(await screen.findByRole('dialog', { name: 'Shortcut help' })).toBeTruthy();

      fireEvent.keyDown(document, { key: 'j' });
      expect(presenter.s().selectedTabId).toBe(manyTabs[1].id);
      expect(screen.queryByRole('dialog', { name: 'Shortcut help' })).toBeNull();

      fireEvent.keyDown(document, { key: '?', shiftKey: true });
      expect(await screen.findByRole('dialog', { name: 'Shortcut help' })).toBeTruthy();

      fireEvent.keyDown(document, { key: '.' });
      expect(presenter.s().pageIndex).toBe(1);
      expect(screen.queryByRole('dialog', { name: 'Shortcut help' })).toBeNull();

      fireEvent.keyDown(document, { key: '?', shiftKey: true });
      expect(await screen.findByRole('dialog', { name: 'Shortcut help' })).toBeTruthy();

      fireEvent.keyDown(document, { key: ',' });
      expect(presenter.s().pageIndex).toBe(0);
      expect(screen.queryByRole('dialog', { name: 'Shortcut help' })).toBeNull();

      fireEvent.keyDown(document, { key: '?', shiftKey: true });
      expect(await screen.findByRole('dialog', { name: 'Shortcut help' })).toBeTruthy();

      fireEvent.keyDown(document, { key: '/' });
      expect(presenter.s().searchQuery).toBe('');
      expect(screen.queryByRole('dialog', { name: 'Shortcut help' })).toBeNull();
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

    it('retains the current page after closing a tab with Ctrl-W', async () => {
      const manyTabs = makeTabs(15);
      setup(manyTabs, manyTabs[0]);

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Tab 1');

      fireEvent.keyDown(document, { key: '.' });
      expect(presenter.s().pageIndex).toBe(1);

      // Selection is still on page 1; j selects the first item on the current page.
      fireEvent.keyDown(document, { key: 'j' });
      const closedTab = manyTabs[10];
      expect(presenter.s().selectedTabId).toBe(closedTab.id);

      fireEvent.keyDown(document, { key: 'w', ctrlKey: true });

      await waitFor(() => {
        expect(chrome.tabs.close).toHaveBeenCalledWith(closedTab.id);
        expect(presenter.s().tabList).toHaveLength(14);
      });
      expect(presenter.s().pageIndex).toBe(1);
      expect(screen.queryByText(closedTab.title)).toBeNull();
      expect(await screen.findByText('Tab 12')).toBeTruthy();
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

    it('moves selected tab next to the active tab with } and { without activating or closing', async () => {
      const _tabList: Tab[] = [...tabList,
        { id: 4, title: 'Music', url: 'https://music.example.com', lastAccessed: 1500 }
      ];
      setup(_tabList);

      await renderAndWait(<Popup presenter={presenter} />);
      const state = presenter.s();
      fireEvent.keyDown(document, { key: state.tabKeyMap.get(_tabList[2].id)! });

      fireEvent.keyDown(document, { key: '}', shiftKey: true });
      await waitFor(() => {
        expect(chrome.tabs.move).toHaveBeenCalledWith('toTheRight', _tabList[2].id);
      });
      expect(chrome.tabs.activate).not.toHaveBeenCalled();
      expect(chrome.closePopup).not.toHaveBeenCalled();

      fireEvent.keyDown(document, { key: '{', shiftKey: true });
      await waitFor(() => {
        expect(chrome.tabs.move).toHaveBeenLastCalledWith('toTheLeft', _tabList[2].id);
      });
      expect(chrome.tabs.activate).not.toHaveBeenCalled();
      expect(chrome.closePopup).not.toHaveBeenCalled();
      expect(chrome.tabs.move).toHaveBeenCalledTimes(2);
    });

    it('ignores } and { when the selected tab is the active tab', async () => {
      const currentTab = tabList[1];
      setup(tabList, currentTab);

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'game');
      fireEvent.keyDown(document, { key: presenter.s().tabKeyMap.get(currentTab.id)! });
      expect(presenter.s().selectedTabId).toBe(currentTab.id);

      fireEvent.keyDown(document, { key: '?', shiftKey: true });
      const stayInPopupHelp = within(await screen.findByRole('dialog', { name: 'Shortcut help' }))
        .getByText(/Move selected tab to the right\/left of current tab \(stay in popup\)/);
      expect(stayInPopupHelp.closest('li')?.getAttribute('aria-disabled')).toBe('true');

      fireEvent.keyDown(document, { key: '}', shiftKey: true });
      fireEvent.keyDown(document, { key: '{', shiftKey: true });
      await waitFor(() => {
        expect(chrome.tabs.getCurrent).toHaveBeenCalled();
      });
      expect(chrome.tabs.move).not.toHaveBeenCalled();
      expect(chrome.tabs.activate).not.toHaveBeenCalled();
      expect(chrome.closePopup).not.toHaveBeenCalled();
    });

    it('moves the current active tab left and right with < and > without closing the popup', async () => {
      const currentTab = tabList[1];
      const selectedTab = tabList[0];
      setup(tabList, currentTab);

      await renderAndWaitForTitle(<Popup presenter={presenter} />, 'game');
      expect(presenter.s().selectedTabId).toBe(selectedTab.id);

      fireEvent.keyDown(document, { key: '>' });
      await waitFor(() => {
        expect(chrome.tabs.move).toHaveBeenCalledWith('toTheRight', currentTab.id);
      });
      expect(chrome.tabs.activate).not.toHaveBeenCalled();
      expect(chrome.closePopup).not.toHaveBeenCalled();

      fireEvent.keyDown(document, { key: '<' });
      await waitFor(() => {
        expect(chrome.tabs.move).toHaveBeenLastCalledWith('toTheLeft', currentTab.id);
      });
      expect(chrome.tabs.activate).not.toHaveBeenCalled();
      expect(chrome.closePopup).not.toHaveBeenCalled();
      expect(chrome.tabs.move).toHaveBeenCalledTimes(2);
    });

    it('breaks the selected tab into a new window when ! is pressed', async () => {
      const _tabList: Tab[] = [...tabList,
        { id: 4, title: 'Music', url: 'https://music.example.com', lastAccessed: 1500 }
      ];
      setup(_tabList);

      await renderAndWait(<Popup presenter={presenter} />);
      const state = presenter.s();
      fireEvent.keyDown(document, { key: state.tabKeyMap.get(_tabList[2].id)! });
      fireEvent.keyDown(document, { key: '!', shiftKey: true });

      expect(chrome.tabs.breakIntoNewWindow).toHaveBeenCalledWith(_tabList[2].id);
      await waitFor(() => {
        expect(chrome.closePopup).toHaveBeenCalled();
      });
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

      it('uses ., `,`, ArrowRight, and ArrowLeft for next and previous page', async () => {
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

        fireEvent.keyDown(document, { key: 'ArrowRight' });
        expect(presenter.s().pageIndex).toBe(1);
        expect(presenter.s().selectedTabId).toBe(manyTabs[1].id);

        fireEvent.keyDown(document, { key: 'ArrowLeft' });
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

    describe('search flow', () => {
      const searchTabs: Tab[] = [
        { id: 1, title: 'React Docs', url: 'https://react.example.com/docs', lastAccessed: 3000 },
        { id: 2, title: 'Game Hub', url: 'https://game.example.com', lastAccessed: 2000 },
        { id: 3, title: 'react patterns', url: 'https://patterns.example.com', lastAccessed: 1000 },
      ];

      it('enters search mode with / and shows a vim-style indicator', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });

        const indicator = screen.getByLabelText('Search');
        expect(indicator.textContent).toBe('/');
      });

      it('updates the indicator while typing, selects the first match, and highlights it', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        fireEvent.keyDown(document, { key: 'g' });
        fireEvent.keyDown(document, { key: 'a' });
        fireEvent.keyDown(document, { key: 'm' });
        fireEvent.keyDown(document, { key: 'e' });

        expect(screen.getByLabelText('Search').textContent).toBe('/game');
        expect(presenter.s().selectedTabId).toBe(searchTabs[1].id);

        const item = await findHighlightedItem('game');
        expect(item.classList.contains('selected')).toBe(true);
        expect(item.textContent).toContain('Game Hub');
      });

      it('shows the inline search shortcuts while search mode is active', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        fireEvent.keyDown(document, { key: 'g' });

        const shortcuts = screen.getByLabelText('Search shortcuts');
        expect(shortcuts.textContent).toContain('Esc');
        expect(shortcuts.textContent).toContain('Enter');
        expect(shortcuts.textContent).toContain('keep');
        expect(shortcuts.textContent).toContain('Ctrl');
        expect(shortcuts.textContent).toContain('Backspace');
        expect(shortcuts.textContent).toContain('clear');
      });

      it('shows Enter last in the footer when the search prompt is empty and a last query exists', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        for (const key of ['r', 'e', 'a', 'c', 't']) {
          fireEvent.keyDown(document, { key });
        }
        fireEvent.keyDown(document, { key: 'Enter' });
        fireEvent.keyDown(document, { key: '/' });

        const shortcuts = screen.getByLabelText('Search shortcuts');
        expect(shortcuts.textContent).toContain('last');
        expect(shortcuts.textContent).not.toContain('keep');
      });

      it('matches tab titles case-insensitively', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        for (const key of ['r', 'e', 'a', 'c', 't']) {
          fireEvent.keyDown(document, { key });
        }

        expect(screen.getByLabelText('Search').textContent).toBe('/react');
        expect(presenter.s().selectedTabId).toBe(searchTabs[0].id);

        expectSelectedHighlight('react');
      });

      it('ends search mode on Enter without activating the selected tab', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        for (const key of ['r', 'e', 'a', 'c', 't']) {
          fireEvent.keyDown(document, { key });
        }
        expect(presenter.s().selectedTabId).toBe(searchTabs[0].id);

        fireEvent.keyDown(document, { key: 'Enter' });

        expect(screen.queryByLabelText('Search')).toBeNull();
        expect(presenter.s().selectedTabId).toBe(searchTabs[0].id);
        expect(chrome.tabs.activate).not.toHaveBeenCalled();
        expect(chrome.closePopup).not.toHaveBeenCalled();
      });

      it('prevents the browser default escape action while search mode is active', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        fireEvent.keyDown(document, { key: 'g' });

        const escapeEvent = createEvent.keyDown(document, { key: 'Escape' });
        fireEvent(document, escapeEvent);

        expect(escapeEvent.defaultPrevented).toBe(true);
        expect(screen.queryByLabelText('Search')).toBeNull();
        expect(chrome.closePopup).not.toHaveBeenCalled();
      });

      it('activates the first matching tab on Ctrl+Enter', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        for (const key of ['r', 'e', 'a', 'c', 't']) {
          fireEvent.keyDown(document, { key });
        }

        fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });

        expect(screen.queryByLabelText('Search')).toBeNull();
        await waitFor(() => {
          expect(chrome.tabs.activate).toHaveBeenCalledWith(searchTabs[0].id);
          expect(chrome.closePopup).toHaveBeenCalled();
        });
      });

      it.each([
        { key: 'w', label: 'Ctrl-W' },
        { key: 'Backspace', label: 'Ctrl-Backspace' },
      ])('clears the query with $label without closing the selected tab', async ({ key }) => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        for (const typed of ['g', 'a', 'm', 'e']) {
          fireEvent.keyDown(document, { key: typed });
        }
        expect(screen.getByLabelText('Search').textContent).toBe('/game');
        expect(presenter.s().selectedTabId).toBe(searchTabs[1].id);

        const event = createEvent.keyDown(document, { key, ctrlKey: true });
        fireEvent(document, event);

        expect(event.defaultPrevented).toBe(true);
        expect(screen.getByLabelText('Search').textContent).toBe('/');
        expect(presenter.s().searchQuery).toBe('');
        expect(presenter.s().lastSearchQuery).toBeUndefined();
        expect(presenter.s().highlightQuery).toBeUndefined();
        expect(presenter.s().selectedTabId).toBe(searchTabs[1].id);
        expect(chrome.tabs.close).not.toHaveBeenCalled();
        expect(chrome.closePopup).not.toHaveBeenCalled();

        const reopenedPresenter = new PopupPresenter(chrome, browser);
        await reopenedPresenter.fetchTabList();
        await reopenedPresenter.onKeyPress('/');
        expect(reopenedPresenter.s().searchQuery).toBe('');
      });

      it('does not close a tab when Ctrl-W is pressed on an empty search query', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        expect(presenter.s().searchQuery).toBe('');

        fireEvent.keyDown(document, { key: 'w', ctrlKey: true });

        expect(screen.getByLabelText('Search').textContent).toBe('/');
        expect(presenter.s().searchQuery).toBe('');
        expect(chrome.tabs.close).not.toHaveBeenCalled();
      });

      it('deletes the last query character with Backspace and exits when empty', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        for (const key of ['g', 'a', 'm', 'e']) {
          fireEvent.keyDown(document, { key });
        }
        expect(screen.getByLabelText('Search').textContent).toBe('/game');
        expect(presenter.s().selectedTabId).toBe(searchTabs[1].id);

        fireEvent.keyDown(document, { key: 'Backspace' });
        expect(screen.getByLabelText('Search').textContent).toBe('/gam');
        expect(presenter.s().selectedTabId).toBe(searchTabs[1].id);
        expectSelectedHighlight('gam');

        fireEvent.keyDown(document, { key: 'Backspace' });
        fireEvent.keyDown(document, { key: 'Backspace' });
        fireEvent.keyDown(document, { key: 'Backspace' });
        expect(screen.getByLabelText('Search').textContent).toBe('/');

        fireEvent.keyDown(document, { key: 'Backspace' });
        expect(screen.queryByLabelText('Search')).toBeNull();
        expect(presenter.s().lastSearchQuery).toBeUndefined();
        expect(presenter.s().selectedTabId).toBe(searchTabs[1].id);
      });

      it('does not prefill the last search when entering search with /', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        for (const key of ['r', 'e', 'a', 'c', 't']) {
          fireEvent.keyDown(document, { key });
        }
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(presenter.s().lastSearchQuery).toBe('react');

        fireEvent.keyDown(document, { key: '/' });
        expect(screen.getByLabelText('Search').textContent).toBe('/');
        expect(presenter.s().searchQuery).toBe('');
      });

      it('fills the last search query when Enter is pressed on an empty search prompt', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        for (const key of ['r', 'e', 'a', 'c', 't']) {
          fireEvent.keyDown(document, { key });
        }
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(presenter.s().lastSearchQuery).toBe('react');

        fireEvent.keyDown(document, { key: '/' });
        expect(screen.getByLabelText('Search').textContent).toBe('/');

        fireEvent.keyDown(document, { key: 'Enter' });
        expect(screen.getByLabelText('Search').textContent).toBe('/react');
        expect(presenter.s().searchQuery).toBe('react');
        expect(presenter.s().selectedTabId).toBe(searchTabs[0].id);
        expectSelectedHighlight('react');
        expect(chrome.tabs.activate).not.toHaveBeenCalled();
        expect(chrome.closePopup).not.toHaveBeenCalled();
      });

      it('jumps to the next title match with n, highlights it, and wraps around', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        for (const key of ['r', 'e', 'a', 'c', 't']) {
          fireEvent.keyDown(document, { key });
        }
        expect(presenter.s().selectedTabId).toBe(searchTabs[0].id);

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByLabelText('Search')).toBeNull();
        expect(chrome.tabs.activate).not.toHaveBeenCalled();

        fireEvent.keyDown(document, { key: 'n' });
        expect(presenter.s().selectedTabId).toBe(searchTabs[2].id);
        expectSelectedHighlight('react');

        fireEvent.keyDown(document, { key: 'n' });
        expect(presenter.s().selectedTabId).toBe(searchTabs[0].id);
        expectSelectedHighlight('react');
      });

      it('restores the last search phrase when the popup is reopened', async () => {
        setup(searchTabs, searchTabs[0]);
        await presenter.fetchTabList();
        await presenter.onKeyPress('/');
        for (const key of 'react') {
          await presenter.onKeyPress(key);
        }

        const reopenedPresenter = new PopupPresenter(chrome, browser);
        await reopenedPresenter.fetchTabList();
        await reopenedPresenter.onKeyPress('/');

        expect(reopenedPresenter.s().searchQuery).toBe('');
        expect(reopenedPresenter.s().lastSearchQuery).toBe('react');

        await reopenedPresenter.onKeyPress('enter');
        expect(reopenedPresenter.s().searchQuery).toBe('react');

        await reopenedPresenter.onKeyPress('enter');
        await reopenedPresenter.onKeyPress('n');

        expect(reopenedPresenter.s().lastSearchQuery).toBe('react');
        expect(reopenedPresenter.s().selectedTabId).toBe(searchTabs[2].id);
      });

      it('clears the highlight when another key changes selection but keeps the last search query', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        for (const key of ['r', 'e', 'a', 'c', 't']) {
          fireEvent.keyDown(document, { key });
        }
        fireEvent.keyDown(document, { key: 'Enter' });

        fireEvent.keyDown(document, { key: 'n' });
        expect(presenter.s().selectedTabId).toBe(searchTabs[2].id);
        expectSelectedHighlight('react');

        fireEvent.keyDown(document, { key: 'k' });
        expect(presenter.s().selectedTabId).toBe(searchTabs[1].id);
        expect(screen.queryByText((_, el) => el?.tagName === 'MARK')).toBeNull();

        fireEvent.keyDown(document, { key: 'n' });
        expect(presenter.s().selectedTabId).toBe(searchTabs[2].id);
        expectSelectedHighlight('react');
      });

      it('switches to the page that contains a typed search match', async () => {
        const manyTabs = makeTabs(PAGE_SIZE + 2);
        manyTabs[PAGE_SIZE].title = 'Unique Match Tab';
        setup(manyTabs, manyTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Tab 1');
        expect(presenter.s().pageIndex).toBe(0);
        expect(screen.queryByText('Unique Match Tab')).toBeNull();

        fireEvent.keyDown(document, { key: '/' });
        for (const key of 'unique') {
          fireEvent.keyDown(document, { key });
        }

        expect(presenter.s().selectedTabId).toBe(manyTabs[PAGE_SIZE].id);
        expect(presenter.s().pageIndex).toBe(1);
        const item = await findHighlightedItem('unique');
        expect(item.classList.contains('selected')).toBe(true);
        expect(item.textContent).toContain('Unique Match Tab');
      });

      it('switches page when n jumps to a match on another page, including wrap-around', async () => {
        const manyTabs = makeTabs(PAGE_SIZE + 2);
        manyTabs[0].title = 'React Docs';
        manyTabs[PAGE_SIZE].title = 'react patterns';
        setup(manyTabs, manyTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');
        expect(presenter.s().pageIndex).toBe(0);

        fireEvent.keyDown(document, { key: '/' });
        for (const key of 'react') {
          fireEvent.keyDown(document, { key });
        }
        expect(presenter.s().selectedTabId).toBe(manyTabs[0].id);
        expect(presenter.s().pageIndex).toBe(0);

        fireEvent.keyDown(document, { key: 'Enter' });

        fireEvent.keyDown(document, { key: 'n' });
        expect(presenter.s().selectedTabId).toBe(manyTabs[PAGE_SIZE].id);
        expect(presenter.s().pageIndex).toBe(1);
        expectSelectedHighlight('react');

        fireEvent.keyDown(document, { key: 'n' });
        expect(presenter.s().selectedTabId).toBe(manyTabs[0].id);
        expect(presenter.s().pageIndex).toBe(0);
        expectSelectedHighlight('react');
      });

      it('matches hostname text and highlights the hostname', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        for (const key of 'patterns.example') {
          fireEvent.keyDown(document, { key });
        }

        expect(screen.getByLabelText('Search').textContent).toBe('/patterns.example');
        expect(presenter.s().selectedTabId).toBe(searchTabs[2].id);

        const item = await findHighlightedItem('patterns.example');
        expect(item.classList.contains('selected')).toBe(true);
        expect(item.textContent).toContain('react patterns');
        expect(item.textContent).toContain('patterns.example.com');
      });

      it('matches hostnames case-insensitively', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        for (const char of 'game.example') {
          const isLetter = /[a-z]/.test(char);
          fireEvent.keyDown(document, {
            key: isLetter ? char.toUpperCase() : char,
            shiftKey: isLetter,
          });
        }

        expect(screen.getByLabelText('Search').textContent).toBe('/GAME.EXAMPLE');
        expect(presenter.s().selectedTabId).toBe(searchTabs[1].id);
        expectSelectedHighlight('GAME.EXAMPLE');
      });

      it('jumps to the next hostname match with n', async () => {
        const hostnameTabs: Tab[] = [
          { id: 1, title: 'Home', url: 'https://docs.example.com', lastAccessed: 3000 },
          { id: 2, title: 'Blog', url: 'https://blog.example.com', lastAccessed: 2000 },
          { id: 3, title: 'Shop', url: 'https://shop.example.com', lastAccessed: 1000 },
        ];
        setup(hostnameTabs, hostnameTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'Home');

        fireEvent.keyDown(document, { key: '/' });
        for (const key of 'example.com') {
          fireEvent.keyDown(document, { key });
        }
        expect(presenter.s().selectedTabId).toBe(hostnameTabs[0].id);

        fireEvent.keyDown(document, { key: 'Enter' });

        fireEvent.keyDown(document, { key: 'n' });
        expect(presenter.s().selectedTabId).toBe(hostnameTabs[1].id);
        expectSelectedHighlight('example.com');

        fireEvent.keyDown(document, { key: 'n' });
        expect(presenter.s().selectedTabId).toBe(hostnameTabs[2].id);
        expectSelectedHighlight('example.com');

        fireEvent.keyDown(document, { key: 'n' });
        expect(presenter.s().selectedTabId).toBe(hostnameTabs[0].id);
        expectSelectedHighlight('example.com');
      });

      it('highlights title and hostname when both match', async () => {
        setup(searchTabs, searchTabs[0]);

        await renderAndWaitForTitle(<Popup presenter={presenter} />, 'React Docs');

        fireEvent.keyDown(document, { key: '/' });
        for (const key of 'react') {
          fireEvent.keyDown(document, { key });
        }

        expect(presenter.s().selectedTabId).toBe(searchTabs[0].id);
        const marks = screen.getAllByText(isHighlightMark('react'));
        expect(marks.length).toBeGreaterThanOrEqual(2);
        expect(marks.every(mark => mark.closest('li')?.classList.contains('selected'))).toBe(true);
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

function isHighlightMark(query: string) {
  const needle = query.toLowerCase();
  return (_: string, el: Element | null) =>
    el?.tagName === 'MARK' && el.textContent?.toLowerCase() === needle;
}

function expectSelectedHighlight(query: string) {
  const marks = screen.getAllByText(isHighlightMark(query));
  expect(marks.length).toBeGreaterThan(0);
  expect(marks.every(mark => mark.closest('li')?.classList.contains('selected'))).toBe(true);
}

async function findHighlightedItem(query: string): Promise<HTMLLIElement> {
  const marks = await screen.findAllByText(isHighlightMark(query));
  return marks[0].closest('li')!;
}
