import type { BrowserApi } from '@src/lib/Browser';
import { Browser } from '@src/lib/Browser';

const HINT_KEYS = 'asdfghjklqwertyuiopzxcvbnm';
const CLICKABLE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[onclick]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type Hint = {
  element: HTMLElement;
  label: string;
  badge: HTMLSpanElement;
};

export class VimMode {
  private active = false;
  private hintsVisible = false;
  private typedLabel = '';
  private host: HTMLDivElement | undefined;
  private hintContainer: HTMLDivElement | undefined;
  private statusButton: HTMLButtonElement | undefined;
  private hints: Hint[] = [];

  constructor(
    private readonly page: Document,
    private readonly browser: BrowserApi = Browser,
  ) {}

  enable(): void {
    if (!this.active) {
      this.active = true;
      this.createOverlay();
      this.page.addEventListener('keydown', this.onKeyDown, true);
    }
    this.showHints();
  }

  toggle(): boolean {
    if (this.active) {
      this.disable();
      return false;
    }
    this.enable();
    return true;
  }

  isActive(): boolean {
    return this.active;
  }

  private createOverlay(): void {
    const host = this.page.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        #overlay { position: fixed; inset: 0; pointer-events: none; }
        #hints { position: fixed; inset: 0; }
        .hint {
          position: fixed; padding: 2px 5px; border: 1px solid #9a6700;
          border-radius: 4px; background: #facc15; color: #111;
          font: 700 12px/16px monospace; box-shadow: 0 1px 4px #0008;
        }
        #status {
          position: fixed; top: 12px; right: 12px; pointer-events: auto;
          border: 1px solid #22d3ee; border-radius: 6px; padding: 7px 10px;
          background: #111827; color: #cffafe; cursor: pointer;
          font: 600 12px/16px system-ui, sans-serif; box-shadow: 0 2px 8px #0008;
        }
      </style>
      <div id="overlay">
        <div id="hints"></div>
        <button id="status" type="button" aria-label="Disable Vim mode"></button>
      </div>`;
    this.page.documentElement.appendChild(host);
    this.host = host;
    this.hintContainer = shadow.querySelector<HTMLDivElement>('#hints')!;
    this.statusButton = shadow.querySelector<HTMLButtonElement>('#status')!;
    this.statusButton.addEventListener('click', event => {
      event.stopPropagation();
      this.disable();
    });
    this.updateStatus();
  }

  private disable(): void {
    this.active = false;
    this.hintsVisible = false;
    this.typedLabel = '';
    this.hints = [];
    this.page.removeEventListener('keydown', this.onKeyDown, true);
    this.page.removeEventListener('scroll', this.updateHintPositions, true);
    this.page.defaultView?.removeEventListener('resize', this.updateHintPositions);
    this.host?.remove();
    this.host = undefined;
    this.hintContainer = undefined;
    this.statusButton = undefined;
  }

  private showHints(): void {
    if (!this.active || !this.hintContainer) {
      return;
    }
    this.hintsVisible = true;
    this.typedLabel = '';
    this.hintContainer.replaceChildren();
    this.hints = [...this.page.querySelectorAll<HTMLElement>(CLICKABLE_SELECTOR)]
      .filter(element => this.isVisible(element) && !this.host?.contains(element))
      .map((element, index) => {
        const badge = this.page.createElement('span');
        badge.className = 'hint';
        const label = this.labelFor(index);
        badge.textContent = label;
        this.hintContainer?.appendChild(badge);
        return { element, label, badge };
      });
    this.updateHintPositions();
    this.page.addEventListener('scroll', this.updateHintPositions, true);
    this.page.defaultView?.addEventListener('resize', this.updateHintPositions);
    this.updateStatus();
  }

  private hideHints(): void {
    this.hintsVisible = false;
    this.typedLabel = '';
    this.hints = [];
    this.hintContainer?.replaceChildren();
    this.page.removeEventListener('scroll', this.updateHintPositions, true);
    this.page.defaultView?.removeEventListener('resize', this.updateHintPositions);
    this.updateStatus();
  }

  private updateStatus(): void {
    if (!this.statusButton) {
      return;
    }
    this.statusButton.textContent = this.hintsVisible
      ? 'Vim mode · type a hint + Enter or Ctrl-C · Esc to hide'
      : 'Vim mode ON · f for links · click to turn off';
  }

  private updateHintPositions = (): void => {
    for (const hint of this.hints) {
      const rect = hint.element.getBoundingClientRect();
      hint.badge.style.left = `${Math.max(0, rect.left)}px`;
      hint.badge.style.top = `${Math.max(0, rect.top)}px`;
    }
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.active) {
      return;
    }
    if (this.host && event.composedPath().includes(this.host)) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (this.hintsVisible) {
        this.hideHints();
      } else {
        this.disable();
      }
      return;
    }
    if (this.isEditable(event.target)) {
      return;
    }
    if (!this.hintsVisible) {
      if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.showHints();
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.selectedHint()?.element.click();
      this.hideHints();
      return;
    }
    if (this.isCopyShortcut(event)) {
      const selected = this.selectedHint();
      if (!selected) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const text = this.textToCopy(selected.element);
      if (text) {
        void this.browser.clipboard.writeText(text).catch(() => undefined);
      }
      return;
    }
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.typedLabel += event.key.toLowerCase();
    const possibleHints = this.hints.filter(hint => hint.label.startsWith(this.typedLabel));
    if (possibleHints.length === 0) {
      this.typedLabel = '';
      return;
    }
    for (const hint of this.hints) {
      hint.badge.style.opacity = hint.label.startsWith(this.typedLabel) ? '1' : '0.35';
    }
  };

  private selectedHint(): Hint | undefined {
    if (!this.typedLabel) {
      return undefined;
    }
    return this.hints.find(hint => hint.label === this.typedLabel);
  }

  private isCopyShortcut(event: KeyboardEvent): boolean {
    return event.key.toLowerCase() === 'c' && event.ctrlKey && !event.metaKey && !event.altKey;
  }

  private textToCopy(element: HTMLElement): string {
    const view = this.page.defaultView;
    if (view && element instanceof view.HTMLAnchorElement) {
      return element.href;
    }
    return (element.textContent ?? '').trim();
  }

  private isEditable(target: EventTarget | null): boolean {
    if (!(target instanceof this.page.defaultView!.HTMLElement)) {
      return false;
    }
    return target.isContentEditable
      || target.closest('input, textarea, select, [contenteditable="true"]') !== null;
  }

  private isVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const style = this.page.defaultView?.getComputedStyle(element);
    return rect.width > 0
      && rect.height > 0
      && style?.visibility !== 'hidden'
      && style?.display !== 'none'
      && !element.hasAttribute('disabled')
      && element.getAttribute('aria-disabled') !== 'true';
  }

  private labelFor(index: number): string {
    if (index < HINT_KEYS.length) {
      return HINT_KEYS[index];
    }
    let remainder = index - HINT_KEYS.length;
    let label = '';
    do {
      label = HINT_KEYS[remainder % HINT_KEYS.length] + label;
      remainder = Math.floor(remainder / HINT_KEYS.length) - 1;
    } while (remainder >= 0);
    return label;
  }
}
