import { afterEach, describe, expect, it } from 'vitest';
import { MockChrome } from './MockChrome';

describe('ChromeAPI', () => {
  describe('tabs', () => {
    it('getByLastAccessed', async () => {
      const tabs = await new MockChrome([
        { id: 1, title: 'Docs', url: 'https://docs.example.com/page', lastAccessed: 1000 },
        { id: 3, title: 'game', url: 'https://game.example.com/inbox', lastAccessed: 2000 },
      ]).tabs.getByLastAccessed();
      expect(tabs).toEqual([
        { id: 3, title: 'game', url: 'https://game.example.com/inbox', lastAccessed: 2000 },
        { id: 1, title: 'Docs', url: 'https://docs.example.com/page', lastAccessed: 1000 },
      ]);
    });
  });
});