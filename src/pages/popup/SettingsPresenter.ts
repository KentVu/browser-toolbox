import type { ChromeApi } from '@src/lib/Chrome';

export type PopupMode = 'tabManagement';

export const DEFAULT_MODE_KEY = 'defaultMode';
export const DEFAULT_MODE: PopupMode = 'tabManagement';

export type SettingsState = {
  defaultMode: PopupMode;
  errorMessage?: string;
};

function isPopupMode(value: unknown): value is PopupMode {
  return value === 'tabManagement';
}

export class SettingsPresenter {
  private state: SettingsState = { defaultMode: DEFAULT_MODE };
  private readonly listeners = new Set<() => void>();
  private loadPromise?: Promise<void>;

  constructor(private readonly chrome: ChromeApi) {}

  s = (): SettingsState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(state: Partial<SettingsState>): void {
    this.state = { ...this.state, ...state };
    for (const listener of this.listeners) {
      listener();
    }
  }

  load = (): Promise<void> => {
    if (!this.loadPromise) {
      this.loadPromise = this.chrome.storage.getLocal<unknown>(DEFAULT_MODE_KEY)
        .then(value => {
          this.setState({ defaultMode: isPopupMode(value) ? value : DEFAULT_MODE });
        })
        .catch(error => {
          const detail = error instanceof Error ? error.message : String(error);
          this.setState({ errorMessage: `Unable to load settings: ${detail}` });
        });
    }
    return this.loadPromise;
  };

  async setDefaultMode(value: string): Promise<void> {
    if (!isPopupMode(value)) {
      this.setState({ errorMessage: `Unknown default mode: ${value}` });
      return;
    }

    try {
      await this.chrome.storage.setLocal(DEFAULT_MODE_KEY, value);
      this.setState({ defaultMode: value, errorMessage: undefined });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.setState({ errorMessage: `Unable to save settings: ${detail}` });
    }
  }
}
