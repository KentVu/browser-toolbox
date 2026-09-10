/**
 * Thin wrapper around the web Clipboard API (`navigator.clipboard`).
 */
export interface ClipboardApi {
    writeText(text: string): Promise<void>;
    readText(): Promise<string>;
}

/**
 * Facade over general browser/web platform APIs (not Chrome extension APIs).
 *
 * Use this for things like clipboard access. Chrome-specific extension APIs
 * belong on {@link ChromeApi}.
 */
export interface BrowserApi {
    clipboard: ClipboardApi;
}

class DefaultClipboard implements ClipboardApi {
    async writeText(text: string): Promise<void> {
        await navigator.clipboard.writeText(text);
    }

    async readText(): Promise<string> {
        return navigator.clipboard.readText();
    }
}

class DefaultBrowser implements BrowserApi {
    clipboard: ClipboardApi;

    constructor() {
        this.clipboard = new DefaultClipboard();
    }
}

export const Browser = new DefaultBrowser();
