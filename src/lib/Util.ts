import type { Tab } from '@src/lib/Tab';

export function sortByLastAccessed(tabs: Tab[]): Tab[] {
  return [...tabs].sort(
    (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0),
  );
}
