import { describe, it, expect } from 'vitest';
import { createAskableContext } from '@askable-ui/core';

// Qwik hooks require a component context and jsdom environment.
// These tests exercise the underlying AskableContext API directly
// (the same API useAskable() wraps) to verify the integration contract.

describe('useAskable (Qwik) — contract tests', () => {
  it('createAskableContext() returns a valid context', () => {
    const ctx = createAskableContext();
    expect(ctx).toBeDefined();
    expect(typeof ctx.observe).toBe('function');
    expect(typeof ctx.on).toBe('function');
    expect(typeof ctx.toPromptContext).toBe('function');
    ctx.destroy();
  });

  it('focus event fires after push()', () => {
    const ctx = createAskableContext();
    const received: unknown[] = [];
    ctx.on('focus', (f) => received.push(f));
    ctx.push({ metric: 'revenue' }, 'Revenue');
    expect(received).toHaveLength(1);
    expect((received[0] as any).meta).toMatchObject({ metric: 'revenue' });
    ctx.destroy();
  });

  it('clear event fires after clear()', () => {
    const ctx = createAskableContext();
    ctx.push({ metric: 'revenue' }, 'Revenue');
    const clears: unknown[] = [];
    ctx.on('clear', () => clears.push(true));
    ctx.clear();
    expect(clears).toHaveLength(1);
    ctx.destroy();
  });

  it('toPromptContext() returns non-empty string after push()', () => {
    const ctx = createAskableContext();
    ctx.push({ metric: 'revenue', value: '$2.4M' }, 'Revenue');
    const prompt = ctx.toPromptContext();
    expect(prompt).toContain('revenue');
    ctx.destroy();
  });

  it('getFocus() returns null initially', () => {
    const ctx = createAskableContext();
    expect(ctx.getFocus()).toBeNull();
    ctx.destroy();
  });
});
