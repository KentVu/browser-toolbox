import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Popup from '@pages/popup/Popup';
import type { Tab } from '@src/lib/Tab';
import { shortcutKeys } from '@src/lib/constants';
import { PopupShadow } from '@src/pages/popup/PopupShadow';
import { PopupShadowMock } from './PopupShadowMock';

describe('Popup', () => {
  it('lists all tabs in all windows', async () => {
    const tabList: Tab[] = [
      { id: 1, windowId: 1, title: 'Docs', url: 'https://docs.example.com/page' },
      //{ id: 2, windowId: 1, title: 'Mail', url: 'https://mail.example.com/inbox' },
      { id: 3, windowId: 2, title: 'game', url: 'https://game.example.com/inbox' },
      //{ id: 4, windowId: 2, title: 'music', url: 'https://music.example.com' },
    ];
    const popupShadow: PopupShadow = new PopupShadowMock(tabList);

    const keyMap: Map<number, string> = popupShadow.tabKeyMap(tabList.map(tab => tab.id));

    render(<Popup shadow={popupShadow} />);

    //expect(screen.getByText('Mail')).toBeTruthy();
    await expectTabItem('Docs', 'docs.example.com', keyMap.get(1)!);
    //expect(screen.getByText('mail.example.com')).toBeTruthy();
    await expectTabItem('game', 'game.example.com', keyMap.get(3)!);
  });
});

async function expectTabItem(title: string, hostname: string, shortcut: string) {
  const item = (await screen.findByText(title)).closest('li')!;
  expect(within(item).getByText(hostname)).toBeTruthy();
  // Matcher requires the span's full text to equal the shortcut (not a substring).
  within(item).getByText((text, el) => el?.tagName === 'SPAN' && text === shortcut);
}

