import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Popup from '@pages/popup/Popup';
import type { Tab } from '@src/lib/Tab';
import { PopupShadow } from '@src/pages/popup/PopupShadow';
import { MockChrome } from './MockChrome';
import { fail } from 'assert/strict';

afterEach(() => {
  cleanup();
});

describe('Popup', () => {
  describe('Tablist', () => {
    it('lists all tabs in all windows', async () => {
      const tabList: Tab[] = [
        { id: 1, title: 'Docs', url: 'https://docs.example.com/page', lastAccessed: 1000 },
        { id: 3, title: 'game', url: 'https://game.example.com/inbox', lastAccessed: 2000 },
      ];
      const popupShadow = new PopupShadow(new MockChrome(tabList));

      await renderAndWait(<Popup shadow={popupShadow} />);

      // Most recent tab (higher lastAccessed) should be listed first
      const items = await screen.findAllByRole('listitem') as HTMLLIElement[];
      await expectTabItem(items[0], 'game', 'game.example.com', popupShadow.keyForTab(tabList[1].id));
      await expectTabItem(items[1], 'Docs', 'docs.example.com', popupShadow.keyForTab(tabList[0].id));
    });

    it('selects the correct tab when a key is pressed', async () => {
      const tabList: Tab[] = [
        { id: 1, title: 'Docs', url: 'https://docs.example.com/page', lastAccessed: 1000 },
        { id: 3, title: 'game', url: 'https://game.example.com/inbox', lastAccessed: 2000 },
      ];
      const popupShadow = new PopupShadow(new MockChrome(tabList));

      await renderAndWait(<Popup shadow={popupShadow} />);
      const secondTabKey = popupShadow.keyForTab(tabList[1].id);
      fireEvent.keyDown(document, { key: secondTabKey });
      const item = (await screen.findByText(tabList[1].title)).closest('li')!;
      expect(item.classList.contains('selected')).toBe(true);
    });

    it('Show correct guidance according to current state', async () => {
      const tabList: Tab[] = [
        { id: 1, title: 'Docs', url: 'https://docs.example.com/page', lastAccessed: 1000 },
        { id: 3, title: 'game', url: 'https://game.example.com/inbox', lastAccessed: 2000 },
      ];
      const popupShadow = new PopupShadow(new MockChrome(tabList));

      await renderAndWait(<Popup shadow={popupShadow} />);
      // Initially, the guidance should be "Press a key to select a tab"
      expect(await screen.findByText('Press a key to select a tab')).toBeTruthy();
      fireEvent.keyDown(document, { key: popupShadow.keyForTab(tabList[1].id)! });
      // After selecting a tab, the guidance should change
      expect(await screen.findByText('Select next action:')).toBeTruthy();
      const keyLabel = await screen.findByText((content, element) =>
        element?.tagName === 'SPAN' && element.textContent === ']'
      );
      const container = keyLabel.closest('li')!;
      expect(within(container).getByText(/Move tab to the right of current tab/)).toBeTruthy();
    });
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
