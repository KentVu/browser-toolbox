import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Popup from '@pages/popup/Popup';
import { shortcutKeys } from '@src/lib/constants';
import { PopupPresenter } from '@src/pages/popup/PopupPresenter';
import { createMockBrowserApi } from './MockBrowser';
import { createMockChromeApi } from './MockChrome';

afterEach(() => {
  cleanup();
});

describe('Popup navigation', () => {
  it('starts in the default Tab Management mode and reserves u for going up', async () => {
    const tabs = Array.from({ length: 15 }, (_, index) => ({
      id: index + 1,
      title: `Tab ${index + 1}`,
      url: `https://example.com/${index + 1}`,
      lastAccessed: 1000 - index,
    }));
    const chrome = createMockChromeApi(tabs);
    await chrome.storage.setLocal('defaultMode', 'tabManagement');
    const getLocal = vi.spyOn(chrome.storage, 'getLocal');
    const presenter = new PopupPresenter(chrome, createMockBrowserApi());

    await presenter.ensureTabListLoaded();
    render(<Popup presenter={presenter} />);
    await screen.findByText('TAB LIST');

    expect(screen.getByText('Tab management')).toBeTruthy();
    expect(presenter.navigation().page).toBe('tabManagement');
    expect(getLocal).toHaveBeenCalledWith('defaultMode');
    expect(shortcutKeys).not.toContain('u');
    expect([...presenter.s().tabKeyMap.values()]).not.toContain('u');
  });

  it('navigates from the default mode up to Home, then routes 1 and 2', async () => {
    const tabs = [{
      id: 1,
      title: 'Docs',
      url: 'https://docs.example.com',
      lastAccessed: 1000,
    }];
    const presenter = new PopupPresenter(createMockChromeApi(tabs), createMockBrowserApi());

    await presenter.ensureTabListLoaded();
    render(<Popup presenter={presenter} />);
    await screen.findByText('TAB LIST');

    fireEvent.keyDown(document, { key: 'u' });

    await screen.findByRole('button', { name: /Tab Management/ });
    expect(screen.getByRole('button', { name: '2 Settings' })).toBeTruthy();

    fireEvent.keyDown(document, { key: '1' });
    expect(await screen.findByText('TAB LIST')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'u' });
    await screen.findByRole('button', { name: '2 Settings' });
    fireEvent.keyDown(document, { key: '2' });

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
    const defaultMode = screen.getByRole('combobox', { name: 'Default mode' });

    fireEvent.keyDown(defaultMode, { key: 'u', bubbles: true });
    const settingsButton = await screen.findByRole('button', { name: /Settings/ });
    fireEvent.click(settingsButton);
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
  });

  it('loads the default mode preference and persists a Settings change', async () => {
    const chrome = createMockChromeApi([{
      id: 1,
      title: 'Docs',
      url: 'https://docs.example.com',
      lastAccessed: 1000,
    }]);
    const setLocal = vi.spyOn(chrome.storage, 'setLocal');
    const presenter = new PopupPresenter(chrome, createMockBrowserApi());

    await presenter.ensureTabListLoaded();
    render(<Popup presenter={presenter} />);
    await screen.findByText('TAB LIST');
    fireEvent.keyDown(document, { key: 'u' });
    await screen.findByRole('button', { name: '2 Settings' });
    fireEvent.keyDown(document, { key: '2' });

    const defaultMode = await screen.findByRole('combobox', { name: 'Default mode' }) as HTMLSelectElement;
    expect(defaultMode.value).toBe('tabManagement');
    fireEvent.change(defaultMode, { target: { value: 'tabManagement' } });

    expect(setLocal).toHaveBeenCalledWith('defaultMode', 'tabManagement');
  });

  it('reports a failed default mode save in Settings', async () => {
    const chrome = createMockChromeApi([{
      id: 1,
      title: 'Docs',
      url: 'https://docs.example.com',
      lastAccessed: 1000,
    }]);
    vi.spyOn(chrome.storage, 'setLocal').mockRejectedValue(new Error('Storage unavailable'));
    const presenter = new PopupPresenter(chrome, createMockBrowserApi());

    await presenter.ensureTabListLoaded();
    render(<Popup presenter={presenter} />);
    await screen.findByText('TAB LIST');
    fireEvent.keyDown(document, { key: 'u' });
    await screen.findByRole('button', { name: /Settings/ });
    fireEvent.keyDown(document, { key: '2' });

    const defaultMode = await screen.findByRole('combobox', { name: 'Default mode' }) as HTMLSelectElement;
    fireEvent.change(defaultMode, { target: { value: 'tabManagement' } });

    expect((await screen.findByRole('alert')).textContent).toContain('Storage unavailable');
  });
});
