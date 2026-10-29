import type { BrowserApi } from '@src/lib/Browser';
import type { ChromeApi } from '@src/lib/Chrome';
import type { Tab } from '@src/lib/Tab';
import { useEffect, useState } from 'preact/hooks';
import {
  TabManagementPresenter,
  type PopupState,
} from './TabManagementPresenter';
import {
  DEFAULT_MODE,
  SettingsPresenter,
  type PopupMode,
} from './SettingsPresenter';

export {
  LAST_TAB_LIST_KEY,
  PopupState,
  findNextTabMatch,
  findTabMatch,
  genTabKeyMap,
  pageCount,
  resolveShortcutAction,
  visibleTabs,
} from './TabManagementPresenter';
export type { CachedTabList, ShortcutAction } from './TabManagementPresenter';
export { DEFAULT_MODE, DEFAULT_MODE_KEY, SettingsPresenter } from './SettingsPresenter';
export type { PopupMode, SettingsState } from './SettingsPresenter';

export type PopupPage = 'home' | 'tabManagement' | 'settings';

export type PopupNavigationState = {
  page: PopupPage;
};

export class PopupPresenter {
  readonly tabManagementPresenter: TabManagementPresenter;
  readonly settingsPresenter: SettingsPresenter;
  private navigationState: PopupNavigationState = { page: DEFAULT_MODE };
  private readonly listeners = new Set<() => void>();
  private initialLoad?: Promise<void>;

  constructor(chrome: ChromeApi, browser: BrowserApi) {
    this.tabManagementPresenter = new TabManagementPresenter(chrome, browser);
    this.settingsPresenter = new SettingsPresenter(chrome);
  }

  navigation = (): PopupNavigationState => this.navigationState;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  useNavigationState = (): PopupNavigationState =>
    useSyncExternalStore(this.subscribe, this.navigation);

  openPage(page: PopupPage): void {
    if (this.navigationState.page === page) {
      return;
    }
    this.navigationState = { page };
    for (const listener of this.listeners) {
      listener();
    }
  }

  goUpOneLevel(): void {
    if (this.navigationState.page !== 'home') {
      this.openPage('home');
    }
  }

  async onKeyPress(key: string): Promise<void> {
    if (
      key === 'u'
      && (this.navigationState.page !== 'tabManagement' || this.s().searchQuery === undefined)
    ) {
      this.goUpOneLevel();
      return;
    }
    if (this.navigationState.page === 'home') {
      if (key === '1') {
        this.openPage('tabManagement');
      } else if (key === '2') {
        this.openPage('settings');
      }
      return;
    }
    if (this.navigationState.page === 'tabManagement') {
      await this.tabManagementPresenter.onKeyPress(key);
    }
  }

  ensureTabListLoaded = (): Promise<void> => {
    if (!this.initialLoad) {
      this.initialLoad = Promise.all([
        this.tabManagementPresenter.ensureTabListLoaded(),
        this.settingsPresenter.load(),
      ]).then(() => {
        this.openPage(this.settingsPresenter.s().defaultMode);
      });
    }
    return this.initialLoad;
  };

  s = (): PopupState => this.tabManagementPresenter.s();

  setState = (state: Partial<PopupState>): void => {
    this.tabManagementPresenter.setState(state);
  };

  usePopupState = (): PopupState => this.tabManagementPresenter.usePopupState();

  refreshVimModeState(): Promise<void> {
    return this.tabManagementPresenter.refreshVimModeState();
  }

  fetchTabList(options?: { preservePage?: boolean }): Promise<void> {
    return this.tabManagementPresenter.fetchTabList(options);
  }

  selectSearchMatch(match: Tab | undefined, extra?: Partial<PopupState>): void {
    this.tabManagementPresenter.selectSearchMatch(match, extra);
  }

  moveSelection(delta: number): void {
    this.tabManagementPresenter.moveSelection(delta);
  }

  jumpToPageEdgeOrChangePage(edge: 'first' | 'last'): void {
    this.tabManagementPresenter.jumpToPageEdgeOrChangePage(edge);
  }

  changePage(delta: number): void {
    this.tabManagementPresenter.changePage(delta);
  }

  tabIdForKey(key: string): number | undefined {
    return this.tabManagementPresenter.tabIdForKey(key);
  }
}

function useSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
): T {
  const [snapshot, setSnapshot] = useState(getSnapshot);
  useEffect(() => {
    setSnapshot(getSnapshot());
    return subscribe(() => setSnapshot(getSnapshot()));
  }, [subscribe, getSnapshot]);
  return snapshot;
}
