// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createAskableStore } from '../askable.js';

describe('createAskableStore SSR', () => {
  it('can be created without document', () => {
    expect(() => {
      const store = createAskableStore();
      expect(get(store.focus)).toBeNull();
      expect(get(store.promptContext)).toBe('No UI element is currently focused.');
      store.destroy();
    }).not.toThrow();
  });
});
