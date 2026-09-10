import { describe, expect, it, vi } from 'vitest';
import { Browser } from '@src/lib/Browser';

describe('BrowserAPI', () => {
  describe('clipboard', () => {
    it('writes text via the browser clipboard API', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });

      await Browser.clipboard.writeText('https://example.com');

      expect(writeText).toHaveBeenCalledWith('https://example.com');
    });
  });
});
