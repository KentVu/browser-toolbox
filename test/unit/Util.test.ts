import { describe, expect, it } from 'vitest';
import { urlWithoutFragment } from '@src/lib/Util';

describe('urlWithoutFragment', () => {
  it('strips the fragment from a URL', () => {
    expect(urlWithoutFragment('https://example.com/path?q=1#section')).toBe(
      'https://example.com/path?q=1',
    );
  });

  it('returns the same URL when there is no fragment', () => {
    expect(urlWithoutFragment('https://example.com/path')).toBe(
      'https://example.com/path',
    );
  });

  it('returns undefined for invalid URLs', () => {
    expect(urlWithoutFragment('not a url')).toBeUndefined();
  });
});
