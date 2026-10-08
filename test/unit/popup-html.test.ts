import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const popupHtml = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../src/pages/popup/index.html'),
  'utf8',
);

function inlineStyle(tag: string): string {
  const match = popupHtml.match(new RegExp(`<${tag}\\b[^>]*\\sstyle="([^"]*)"`, 'i'));
  return match?.[1] ?? '';
}

describe('popup HTML', () => {
  it('declares size and background on html and body so Chrome can show the window before JS', () => {
    for (const tag of ['html', 'body']) {
      const style = inlineStyle(tag);
      expect(style, `${tag} style`).toMatch(/width:\s*360px/);
      expect(style, `${tag} style`).toMatch(/height:\s*480px/);
      expect(style.toLowerCase(), `${tag} style`).toContain('#111113');
    }
  });
});
