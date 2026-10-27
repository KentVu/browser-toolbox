import { afterEach, describe, expect, it, vi } from 'vitest';
import { VimMode } from '@pages/content/VimMode';
import { createMockBrowserApi } from './MockBrowser';

afterEach(() => {
  document.body.replaceChildren();
  document.querySelectorAll('html > div').forEach(element => {
    if (element.shadowRoot) {
      element.shadowRoot.querySelector<HTMLButtonElement>('#status')?.click();
      element.remove();
    }
  });
});

function visibleElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.getBoundingClientRect = () => ({
    width: 80,
    height: 20,
    top: 10,
    left: 10,
    right: 90,
    bottom: 30,
    x: 10,
    y: 10,
    toJSON: () => ({}),
  });
  return element;
}

describe('VimMode', () => {
  it('toggles Vim mode off when called while already active', () => {
    const mode = new VimMode(document);

    expect(mode.toggle()).toBe(true);
    expect(mode.toggle()).toBe(false);
    expect(document.querySelector('html > div')).toBeNull();
  });

  it('keeps hints and its mode indicator alive until page-side dismissal', () => {
    const link = document.createElement('a');
    link.href = '#destination';
    link.textContent = 'Destination';
    link.getBoundingClientRect = () => ({
      width: 80,
      height: 20,
      top: 10,
      left: 10,
      right: 90,
      bottom: 30,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    });
    document.body.appendChild(link);
    const clicked = vi.spyOn(link, 'click');
    const mode = new VimMode(document);

    mode.enable();

    const host = document.querySelector('html > div') as HTMLDivElement;
    const shadow = host.shadowRoot!;
    expect(shadow.querySelector('.hint')?.textContent).toBe('a');
    expect(shadow.querySelector('#status')?.textContent).toContain('type a hint');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(clicked).toHaveBeenCalledOnce();
    expect(shadow.querySelector('#status')?.textContent).toContain('Vim mode ON');
    expect(shadow.querySelector('.hint')).toBeNull();
    expect(document.querySelector('html > div')).toBe(host);

    shadow.querySelector<HTMLButtonElement>('#status')!.click();
    expect(document.querySelector('html > div')).toBeNull();
  });

  it('copies the selected link URL when Ctrl-C is pressed without clicking it', () => {
    const link = visibleElement('a');
    link.href = 'https://example.com/destination';
    link.textContent = 'Destination';
    document.body.appendChild(link);
    const clicked = vi.spyOn(link, 'click');
    const browser = createMockBrowserApi();
    const mode = new VimMode(document, browser);

    mode.enable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));

    expect(browser.clipboard.writeText).toHaveBeenCalledWith('https://example.com/destination');
    expect(clicked).not.toHaveBeenCalled();
  });

  it('copies the selected button text when Ctrl-C is pressed', () => {
    const button = visibleElement('button');
    button.textContent = 'Save draft';
    document.body.appendChild(button);
    const browser = createMockBrowserApi();
    const mode = new VimMode(document, browser);

    mode.enable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));

    expect(browser.clipboard.writeText).toHaveBeenCalledWith('Save draft');
  });

  it('does not copy when no clickable element is selected', () => {
    const link = visibleElement('a');
    link.href = 'https://example.com/destination';
    document.body.appendChild(link);
    const browser = createMockBrowserApi();
    const mode = new VimMode(document, browser);

    mode.enable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));

    expect(browser.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('dismisses hints with Escape but leaves the mode enabled', () => {
    const mode = new VimMode(document);
    mode.enable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    const host = document.querySelector('html > div') as HTMLDivElement;
    expect(host.shadowRoot?.querySelector('#status')?.textContent).toContain('Vim mode ON');
    expect(host.shadowRoot?.querySelector('.hint')).toBeNull();
  });
});
