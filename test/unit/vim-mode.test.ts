import { afterEach, describe, expect, it, vi } from 'vitest';
import { VimMode } from '@pages/content/VimMode';
import { createMockBrowserApi } from './MockBrowser';

const initialInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
const initialInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.querySelectorAll('html > div').forEach(element => {
    if (element.shadowRoot) {
      element.shadowRoot.querySelector<HTMLButtonElement>('#status')?.click();
      element.remove();
    }
  });
  if (initialInnerHeight) {
    Object.defineProperty(window, 'innerHeight', initialInnerHeight);
  } else {
    Reflect.deleteProperty(window, 'innerHeight');
  }
  if (initialInnerWidth) {
    Object.defineProperty(window, 'innerWidth', initialInnerWidth);
  } else {
    Reflect.deleteProperty(window, 'innerWidth');
  }
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

function scrollableElement(): HTMLDivElement {
  const element = visibleElement('div');
  element.style.overflowY = 'auto';
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 600 });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 200 });
  element.scrollBy = vi.fn();
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
    const link = visibleElement('a');
    link.href = '#destination';
    link.textContent = 'Destination';
    document.body.appendChild(link);
    const clicked = vi.spyOn(link, 'click');
    const mode = new VimMode(document);

    mode.enable();

    const host = document.querySelector('html > div') as HTMLDivElement;
    const shadow = host.shadowRoot!;
    expect(shadow.querySelector('.hint')).toBeNull();
    expect(shadow.querySelector('#status')?.textContent).toContain('Vim mode ON');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
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
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
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
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));

    expect(browser.clipboard.writeText).toHaveBeenCalledWith('Save draft');
  });

  it('assigns unique labels when there are more than 26 clickable elements', () => {
    for (let index = 0; index < 27; index += 1) {
      document.body.appendChild(visibleElement('button'));
    }
    const mode = new VimMode(document);

    mode.enable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));

    const host = document.querySelector('html > div') as HTMLDivElement;
    const labels = [...host.shadowRoot!.querySelectorAll('.hint')].map(hint => hint.textContent);
    expect(labels).toHaveLength(27);
    expect(new Set(labels).size).toBe(27);
    expect(labels[26]).toBe('aa');
  });

  it('activates a clickable element whose label follows the first 26', () => {
    const buttons = Array.from({ length: 27 }, () => visibleElement('button'));
    buttons.forEach(button => document.body.appendChild(button));
    const clicked = buttons.map(button => vi.spyOn(button, 'click'));
    const mode = new VimMode(document);

    mode.enable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(clicked[0]).not.toHaveBeenCalled();
    expect(clicked[26]).toHaveBeenCalledOnce();
  });

  it('copies a clickable element whose label follows the first 26', () => {
    const links = Array.from({ length: 27 }, (_, index) => {
      const link = visibleElement('a');
      link.href = `https://example.com/${index}`;
      document.body.appendChild(link);
      return link;
    });
    const browser = createMockBrowserApi();
    const mode = new VimMode(document, browser);

    mode.enable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));

    expect(browser.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(browser.clipboard.writeText).toHaveBeenCalledWith('https://example.com/26');
  });

  it('restores all hint badges after an invalid label key', () => {
    document.body.appendChild(visibleElement('button'));
    document.body.appendChild(visibleElement('button'));
    const mode = new VimMode(document);

    mode.enable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

    const host = document.querySelector('html > div') as HTMLDivElement;
    const badges = [...host.shadowRoot!.querySelectorAll<HTMLElement>('.hint')];
    expect(badges.map(badge => badge.style.opacity)).toEqual(['1', '0.35']);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));

    expect(badges.map(badge => badge.style.opacity)).toEqual(['1', '1']);
  });

  it('does not copy when no clickable element is selected', () => {
    const link = visibleElement('a');
    link.href = 'https://example.com/destination';
    document.body.appendChild(link);
    const browser = createMockBrowserApi();
    const mode = new VimMode(document, browser);

    mode.enable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));

    expect(browser.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('dismisses hints with Escape but leaves the mode enabled', () => {
    const mode = new VimMode(document);
    mode.enable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    const host = document.querySelector('html > div') as HTMLDivElement;
    expect(host.shadowRoot?.querySelector('#status')?.textContent).toContain('Vim mode ON');
    expect(host.shadowRoot?.querySelector('.hint')).toBeNull();
  });

  it('scrolls down half a page when d is pressed with hints hidden', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const mode = new VimMode(document);
    mode.enable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));

    expect(scrollBy).toHaveBeenCalledWith(0, 400);
    const host = document.querySelector('html > div') as HTMLDivElement;
    expect(host.shadowRoot?.querySelector('#status')?.textContent).toContain('half a page');
  });

  it('scrolls up half a page when u is pressed with hints hidden', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const mode = new VimMode(document);
    mode.enable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true }));

    expect(scrollBy).toHaveBeenCalledWith(0, -400);
  });

  it('scrolls left half a page when h is pressed with hints hidden', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const mode = new VimMode(document);
    mode.enable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));

    expect(scrollBy).toHaveBeenCalledWith(-400, 0);
  });

  it('scrolls right half a page when l is pressed with hints hidden', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const mode = new VimMode(document);
    mode.enable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));

    expect(scrollBy).toHaveBeenCalledWith(400, 0);
  });

  it('scrolls down one step when j is pressed with hints hidden', () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const mode = new VimMode(document);
    mode.enable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));

    expect(scrollBy).toHaveBeenCalledWith(0, 40);
  });

  it('scrolls up one step when k is pressed with hints hidden', () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const mode = new VimMode(document);
    mode.enable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));

    expect(scrollBy).toHaveBeenCalledWith(0, -40);
  });

  it('shows a label for the viewport and each visible scrollable element when w is pressed', () => {
    const scrollable = scrollableElement();
    const notScrollable = visibleElement('div');
    const hiddenScrollable = scrollableElement();
    hiddenScrollable.style.display = 'none';
    document.body.append(scrollable, notScrollable, hiddenScrollable);
    const mode = new VimMode(document);
    mode.enable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));

    const host = document.querySelector('html > div') as HTMLDivElement;
    const labels = [...host.shadowRoot!.querySelectorAll('.hint')].map(hint => hint.textContent);
    expect(labels).toEqual(['a', 's']);
  });

  it('selects a scrollable element as the target as soon as its label is typed', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const scrollable = scrollableElement();
    document.body.appendChild(scrollable);
    const windowScrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const mode = new VimMode(document);
    mode.enable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));

    expect(scrollable.scrollBy).toHaveBeenCalledWith(0, 100);
    expect(windowScrollBy).not.toHaveBeenCalled();
  });

  it('allows selecting the viewport as a scroll target without pressing Enter', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const mode = new VimMode(document);
    mode.enable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));

    const host = document.querySelector('html > div') as HTMLDivElement;
    expect(host.shadowRoot!.querySelectorAll('.hint')).toHaveLength(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(host.shadowRoot!.querySelector('.hint')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));

    expect(scrollBy).toHaveBeenCalledWith(0, 400);
  });

  it('does not scroll when d types a hint', () => {
    const link = visibleElement('a');
    link.href = '#destination';
    document.body.appendChild(link);
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const mode = new VimMode(document);
    mode.enable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));

    expect(scrollBy).not.toHaveBeenCalled();
    const host = document.querySelector('html > div') as HTMLDivElement;
    expect(host.shadowRoot?.querySelector('.hint')?.textContent).toBe('a');
  });

  it('does not scroll when d is pressed in an editable field', () => {
    const input = visibleElement('input');
    document.body.appendChild(input);
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const mode = new VimMode(document);
    mode.enable();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));

    expect(scrollBy).not.toHaveBeenCalled();
  });
});
