import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Popup from '@pages/popup/Popup';
import type { Tab } from '@src/lib/Tab';
import { PopupShadow, usePopupStore } from '@src/pages/popup/PopupShadow';
import { createMockChromeApi, MockChrome } from './MockChrome';
import { fail } from 'assert/strict';

afterEach(() => {
  cleanup();
});

describe('Popup', () => {
  describe('Tablist', () => {
    const tabList: Tab[] = [
      { id: 1, title: 'Docs', url: 'https://docs.example.com/page', lastAccessed: 1000 },
      { id: 3, title: 'game', url: 'https://game.example.com/inbox', lastAccessed: 2000 },
    ];
    it('lists all tabs in all windows', async () => {
      const store = usePopupStore(createMockChromeApi(tabList));

      await renderAndWait(<Popup store={store} />);

      // Most recent tab (higher lastAccessed) should be listed first
      const items = await screen.findAllByRole('listitem') as HTMLLIElement[];
      await expectTabItem(items[0], 'game', 'game.example.com', store.getState().tabKeyMap.get(tabList[1].id)!);
      await expectTabItem(items[1], 'Docs', 'docs.example.com', store.getState().tabKeyMap.get(tabList[0].id)!);
    });

    it('selects the correct tab when a key is pressed', async () => {
      const store = usePopupStore(createMockChromeApi(tabList));

      await renderAndWait(<Popup store={store} />);
      const secondTabKey = store.getState().tabKeyMap.get(tabList[1].id);
      fireEvent.keyDown(document, { key: secondTabKey });
      const item = (await screen.findByText(tabList[1].title)).closest('li')!;
      expect(item.classList.contains('selected')).toBe(true);
    });

    it('Show correct guidance according to current state', async () => {
      const store = usePopupStore(createMockChromeApi(tabList));

      await renderAndWait(<Popup store={store} />);
      // Initially, the guidance should be "Press a key to select a tab"
      expect(await screen.findByText('Press a key to select a tab')).toBeTruthy();
      const state = store.getState();
      fireEvent.keyDown(document, { key: state.tabKeyMap.get(tabList[1].id)! });
      // After selecting a tab, the guidance should change
      expect(await screen.findByText('Select next action:')).toBeTruthy();
      const keyLabel = await screen.findByText((content, element) =>
        element?.tagName === 'SPAN' && element.textContent === ']'
      );
      const container = keyLabel.closest('li')!;
      expect(within(container).getByText(/Move tab to the right of current tab/)).toBeTruthy();
    });

    it('move selected tab to the right of current tab', async () => {
      await expectMoveSelectedTab(']', 'toTheRight');
    });

    it('move selected tab to the left of current tab', async () => {
      await expectMoveSelectedTab('[', 'toTheLeft');
    });

    async function expectMoveSelectedTab(
      actionKey: string,
      direction: 'toTheRight' | 'toTheLeft',
    ) {
      const _tabList: Tab[] = [...tabList,
        { id: 4, title: 'Music', url: 'https://music.example.com', lastAccessed: 1500 }
      ];
      const mockChrome = createMockChromeApi(_tabList);
      const store = usePopupStore(mockChrome);

      await renderAndWait(<Popup store={store} />);
      const state = store.getState();
      fireEvent.keyDown(document, { key: state.tabKeyMap.get(_tabList[2].id)! });
      fireEvent.keyDown(document, { key: actionKey });

      expect(mockChrome.tabs.moveTab).toHaveBeenCalledWith(direction, _tabList[2].id);
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

async function expectTabItem(item: HTMLLIElement, title: string, hostname: string, shortcut: string) {
  expect(within(item).getByText(title)).toBeTruthy();
  expect(within(item).getByText(hostname)).toBeTruthy();
  // Matcher requires the span's full text to equal the shortcut (not a substring).
  within(item).getByText((text, el) => el?.tagName === 'SPAN' && text === shortcut);
}
