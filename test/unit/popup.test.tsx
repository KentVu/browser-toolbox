import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Popup from '@pages/popup/Popup';
import type { Tab } from '@src/lib/Tab';
import { PopupShadow } from '@src/pages/popup/PopupShadow';
import { MockChrome } from './MockChrome';

afterEach(() => {
  cleanup();
});

describe('Popup', () => {
  describe('Tablist', () => {
    it('lists all tabs in all windows', async () => {
      const tabList: Tab[] = [
        { id: 1, title: 'Docs', url: 'https://docs.example.com/page' },
        { id: 3, title: 'game', url: 'https://game.example.com/inbox' },
      ];
      const popupShadow = new PopupShadow(new MockChrome(tabList));

      const keyMap: Map<number, string> = popupShadow.tabKeyMap(tabList.map(tab => tab.id));

      render(<Popup shadow={popupShadow} />);

      await expectTabItem('Docs', 'docs.example.com', keyMap.get(1)!);
      await expectTabItem('game', 'game.example.com', keyMap.get(3)!);
    });

    it('selects the correct tab when a key is pressed', async () => {
      const tabList: Tab[] = [
        { id: 1, title: 'Docs', url: 'https://docs.example.com/page' },
        { id: 3, title: 'game', url: 'https://game.example.com/inbox' },
      ];
      const popupShadow = new PopupShadow(new MockChrome(tabList));
      const keyMap: Map<number, string> = popupShadow.tabKeyMap(tabList.map(tab => tab.id));

      render(<Popup shadow={popupShadow} />);
      // Wait for async tab load before handling keyboard selection.
      await screen.findByText('game');
      const secondTabKey = keyMap.get(tabList[1].id)!;
      fireEvent.keyDown(document, { key: secondTabKey });
      const item = (await screen.findByText('game')).closest('li')!;
      expect(item.classList.contains('selected')).toBe(true);
    });

    it('Show correct guidance according to current state', async () => {
      const tabList: Tab[] = [
        { id: 1, title: 'Docs', url: 'https://docs.example.com/page' },
        { id: 3, title: 'game', url: 'https://game.example.com/inbox' },
      ];
      const popupShadow = new PopupShadow(new MockChrome(tabList));
      const keyMap: Map<number, string> = popupShadow.tabKeyMap(tabList.map(tab => tab.id));

      render(<Popup shadow={popupShadow} />);
      // Wait for async tab load so key handlers see the populated list.
      await screen.findByText('game');
      // Initially, the guidance should be "Press a key to select a tab"
      expect(await screen.findByText('Press a key to select a tab')).toBeTruthy();
      fireEvent.keyDown(document, { key: keyMap.get(tabList[1].id)! });
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

async function expectTabItem(title: string, hostname: string, shortcut: string) {
  const item = (await screen.findByText(title)).closest('li')!;
  expect(within(item).getByText(hostname)).toBeTruthy();
  // Matcher requires the span's full text to equal the shortcut (not a substring).
  within(item).getByText((text, el) => el?.tagName === 'SPAN' && text === shortcut);
}

