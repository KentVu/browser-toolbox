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

  it('does not override Home navigation when the default mode loads late', async () => {
    let resolveDefaultMode!: (mode: string) => void;
    const defaultMode = new Promise<string>(resolve => {
      resolveDefaultMode = resolve;
    });
    const chrome = createMockChromeApi([{
      id: 1,
      title: 'Docs',
      url: 'https://docs.example.com',
      lastAccessed: 1000,
    }]);
    const originalGetLocal = chrome.storage.getLocal.bind(chrome.storage);
    chrome.storage.getLocal = async <T,>(key: string): Promise<T | undefined> => {
      if (key === 'defaultMode') {
        return await defaultMode as T;
      }
      return originalGetLocal<T>(key);
    };
    const presenter = new PopupPresenter(chrome, createMockBrowserApi());

    const initialLoad = presenter.ensureTabListLoaded();
    render(<Popup presenter={presenter} />);
    fireEvent.keyDown(document, { key: 'u' });
    await screen.findByRole('button', { name: /Tab Management/ });

    resolveDefaultMode('tabManagement');
    await initialLoad;

    expect(presenter.navigation().page).toBe('home');
    expect(screen.getByRole('button', { name: /Settings/ })).toBeTruthy();
  });
});

describe('Start Tab Management in search mode', () => {
  const docsTab = {
    id: 1,
    title: 'Docs',
    url: 'https://docs.example.com',
    lastAccessed: 1000,
  };

  async function openPopup(chrome = createMockChromeApi([docsTab])) {
    const presenter = new PopupPresenter(chrome, createMockBrowserApi());
    await presenter.ensureTabListLoaded();
    render(<Popup presenter={presenter} />);
    await screen.findByText('TAB LIST');
    return presenter;
  }

  it('starts Tab Management in search mode when the preference is enabled', async () => {
    const chrome = createMockChromeApi([docsTab]);
    await chrome.storage.setLocal('startInSearchMode', true);
    const presenter = await openPopup(chrome);

    expect(screen.getByLabelText('Search').textContent).toBe('/');

    fireEvent.keyDown(document, { key: 'x' });

    expect(screen.getByLabelText('Search').textContent).toBe('/x');
    expect(screen.getByText('Docs')).toBeTruthy();
    expect(presenter.navigation().page).toBe('tabManagement');
  });

  it('types u into the query instead of leaving Tab Management', async () => {
    const chrome = createMockChromeApi([docsTab]);
    await chrome.storage.setLocal('startInSearchMode', true);
    const presenter = await openPopup(chrome);

    fireEvent.keyDown(document, { key: 'u' });

    expect(screen.getByLabelText('Search').textContent).toBe('/u');
    expect(presenter.navigation().page).toBe('tabManagement');
  });

  it('stays out of search mode after Escape until Tab Management is opened again', async () => {
    const chrome = createMockChromeApi([docsTab]);
    await chrome.storage.setLocal('startInSearchMode', true);
    const presenter = await openPopup(chrome);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByLabelText('Search')).toBeNull();
    expect(presenter.s().searchQuery).toBeUndefined();

    fireEvent.keyDown(document, { key: 'u' });
    await screen.findByRole('button', { name: /Tab Management/ });
    fireEvent.keyDown(document, { key: '1' });

    expect((await screen.findByLabelText('Search')).textContent).toBe('/');
    expect(presenter.navigation().page).toBe('tabManagement');
  });

  it('enters search mode when the preference arrives while Tab Management is still open', async () => {
    let resolveStartInSearch!: (enabled: boolean) => void;
    const startInSearch = new Promise<boolean>(resolve => {
      resolveStartInSearch = resolve;
    });
    const chrome = createMockChromeApi([docsTab]);
    const originalGetLocal = chrome.storage.getLocal.bind(chrome.storage);
    chrome.storage.getLocal = async <T,>(key: string): Promise<T | undefined> => {
      if (key === 'startInSearchMode') {
        return await startInSearch as T;
      }
      return originalGetLocal<T>(key);
    };
    const presenter = new PopupPresenter(chrome, createMockBrowserApi());

    const initialLoad = presenter.ensureTabListLoaded();
    render(<Popup presenter={presenter} />);
    await screen.findByText('TAB LIST');
    expect(screen.queryByLabelText('Search')).toBeNull();

    resolveStartInSearch(true);
    await initialLoad;

    expect(presenter.s().searchQuery).toBe('');
    expect((await screen.findByLabelText('Search')).textContent).toBe('/');
  });

  it('does not enter search mode when the preference arrives after leaving Tab Management', async () => {
    let resolveStartInSearch!: (enabled: boolean) => void;
    const startInSearch = new Promise<boolean>(resolve => {
      resolveStartInSearch = resolve;
    });
    const chrome = createMockChromeApi([docsTab]);
    const originalGetLocal = chrome.storage.getLocal.bind(chrome.storage);
    chrome.storage.getLocal = async <T,>(key: string): Promise<T | undefined> => {
      if (key === 'startInSearchMode') {
        return await startInSearch as T;
      }
      return originalGetLocal<T>(key);
    };
    const presenter = new PopupPresenter(chrome, createMockBrowserApi());

    const initialLoad = presenter.ensureTabListLoaded();
    render(<Popup presenter={presenter} />);
    fireEvent.keyDown(document, { key: 'u' });
    await screen.findByRole('button', { name: /Tab Management/ });

    resolveStartInSearch(true);
    await initialLoad;

    expect(presenter.navigation().page).toBe('home');
    expect(presenter.s().searchQuery).toBeUndefined();
    expect(screen.queryByLabelText('Search')).toBeNull();
  });

  it('loads the start-in-search preference and persists a Settings change', async () => {
    const chrome = createMockChromeApi([docsTab]);
    await chrome.storage.setLocal('startInSearchMode', true);
    const setLocal = vi.spyOn(chrome.storage, 'setLocal');
    const presenter = await openPopup(chrome);

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'u' });
    await screen.findByRole('button', { name: '2 Settings' });
    fireEvent.keyDown(document, { key: '2' });

    const startInSearch = await screen.findByRole('checkbox', { name: 'Start Tab Management in search mode' }) as HTMLInputElement;
    expect(startInSearch.checked).toBe(true);

    fireEvent.click(startInSearch);

    expect(setLocal).toHaveBeenCalledWith('startInSearchMode', false);
    expect(presenter.settingsPresenter.s().startInSearchMode).toBe(false);
  });

  it('shows an unchecked start-in-search preference when none is stored', async () => {
    await openPopup();
    fireEvent.keyDown(document, { key: 'u' });
    await screen.findByRole('button', { name: '2 Settings' });
    fireEvent.keyDown(document, { key: '2' });

    const startInSearch = await screen.findByRole('checkbox', { name: 'Start Tab Management in search mode' }) as HTMLInputElement;
    expect(startInSearch.checked).toBe(false);
  });

  it('reports a failed start-in-search save in Settings', async () => {
    const chrome = createMockChromeApi([docsTab]);
    vi.spyOn(chrome.storage, 'setLocal').mockRejectedValue(new Error('Storage unavailable'));
    await openPopup(chrome);

    fireEvent.keyDown(document, { key: 'u' });
    await screen.findByRole('button', { name: /Settings/ });
    fireEvent.keyDown(document, { key: '2' });

    const startInSearch = await screen.findByRole('checkbox', { name: 'Start Tab Management in search mode' }) as HTMLInputElement;
    fireEvent.click(startInSearch);

    expect((await screen.findByRole('alert')).textContent).toContain('Storage unavailable');
    expect(startInSearch.checked).toBe(false);
  });
});
