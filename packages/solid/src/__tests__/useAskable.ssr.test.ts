// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createAskableContext } from '@askable-ui/core';

describe('useAskable SSR', () => {
  it('createAskableContext works without document', () => {
    // In SSR (node env) document is undefined — context must not throw on creation
    expect(() => {
      const ctx = createAskableContext();
      expect(ctx.getFocus()).toBeNull();
      expect(ctx.toPromptContext()).toBeTruthy();
      ctx.destroy();
    }).not.toThrow();
  });

  it('imports resolve without touching DOM', async () => {
    // The module must be importable in a node environment
    const mod = await import('../useAskable.js');
    expect(typeof mod.useAskable).toBe('function');
  });
});
