import { describe, expect, it } from 'vitest';
import { hostnameOf, urlWithoutFragment } from '@src/lib/Util';

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

describe('hostnameOf', () => {
  it('returns the hostname for a valid URL', () => {
    expect(hostnameOf('https://docs.example.com/path?q=1#hash')).toBe('docs.example.com');
  });

  it('returns an empty string for missing or invalid URLs', () => {
    expect(hostnameOf(undefined)).toBe('');
    expect(hostnameOf('not a url')).toBe('');
  });
});
