import { vi } from 'vitest';
import type { BrowserApi } from '@src/lib/Browser';

export function createMockBrowserApi(): BrowserApi {
  return {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    },
  };
}
