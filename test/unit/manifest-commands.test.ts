import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';

describe('manifest commands', () => {
  it('sets suggested_key default to Alt+O for _execute_action', () => {
    expect(manifest.commands._execute_action.suggested_key.default).toBe('Alt+O');
  });
});
