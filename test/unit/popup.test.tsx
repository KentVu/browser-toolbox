import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Popup from '@pages/popup/Popup';
import type { Tab } from '@src/lib/Tab';
import { PopupShadow } from '@src/pages/popup/PopupShadow';
import { MockChrome } from './MockChrome';

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
      // Simulate pressing the key for the second tab
      const secondTabKey = keyMap.get(tabList[1].id)!;
      fireEvent.keyDown(document, { key: secondTabKey });
      const item = (await screen.findByText('game')).closest('li')!;
      expect(item.classList.contains('selected')).toBe(true);
    });
  });
});

async function expectTabItem(title: string, hostname: string, shortcut: string) {
  const item = (await screen.findByText(title)).closest('li')!;
  expect(within(item).getByText(hostname)).toBeTruthy();
  // Matcher requires the span's full text to equal the shortcut (not a substring).
  within(item).getByText((text, el) => el?.tagName === 'SPAN' && text === shortcut);
}

