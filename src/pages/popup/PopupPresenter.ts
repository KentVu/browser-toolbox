import type { BrowserApi } from '@src/lib/Browser';
import type { ChromeApi } from '@src/lib/Chrome';
import { useEffect, useState } from 'preact/hooks';
import { TabManagementPresenter } from './TabManagementPresenter';
import {
  DEFAULT_MODE,
  SettingsPresenter,
} from './SettingsPresenter';

export {
  LAST_TAB_LIST_KEY,
  TabManagementState,
  findNextTabMatch,
  findTabMatch,
  genTabKeyMap,
  pageCount,
  resolveShortcutAction,
  visibleTabs,
} from './TabManagementPresenter';
export type { CachedTabList, ShortcutAction } from './TabManagementPresenter';
export { DEFAULT_MODE, DEFAULT_MODE_KEY, START_IN_SEARCH_MODE_KEY, SettingsPresenter } from './SettingsPresenter';
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
  private hasNavigated = false;

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
    this.hasNavigated = true;
    this.setPage(page);
    if (page === 'tabManagement') {
      this.enterSearchIfPreferred();
    }
  }

  /** Empty search prompt when the preference is on and Tab Management is still showing. */
  private enterSearchIfPreferred(): void {
    if (this.navigationState.page !== 'tabManagement' || !this.settingsPresenter.s().startInSearchMode) {
      return;
    }
    if (this.tabManagementPresenter.s().searchQuery !== undefined) {
      return;
    }
    this.tabManagementPresenter.enterSearch();
  }

  private setPage(page: PopupPage): void {
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
      && (this.navigationState.page !== 'tabManagement' || this.tabManagementPresenter.s().searchQuery === undefined)
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
        if (!this.hasNavigated) {
          this.setPage(this.settingsPresenter.s().defaultMode);
        }
        this.enterSearchIfPreferred();
      });
    }
    return this.initialLoad;
  };
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
