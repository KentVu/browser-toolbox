import type { Tab } from '@src/lib/Tab';

export function sortByLastAccessed(tabs: Tab[]): Tab[] {
  return [...tabs].sort(
    (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0),
  );
}

/** Returns an absolute http(s) URL, or undefined when the text is not pasteable. */
export function tryParseHttpUrl(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    return url.href;
  } catch {
    return undefined;
  }
}
