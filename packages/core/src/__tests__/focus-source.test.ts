import { describe, it, expect } from 'vitest';
import { createAskableFocusSource } from '../focus-source.js';
import { createAskableContext } from '../index.js';
import type { AskableFocusSourceSnapshot } from '../focus-source.js';

function makeSnapshot(overrides: Partial<AskableFocusSourceSnapshot> = {}): AskableFocusSourceSnapshot {
  return {
    focused: null,
    hasFocus: false,
    focusChangeCount: 0,
    lastChangedAt: null,
    ...overrides,
  };
}

function makeFocusedEl(overrides = {}) {
  return {
    tag: 'input',
    id: 'email',
    label: 'Email address',
    role: 'textbox',
    name: 'email',
    type: 'email',
    value: 'user@example.com',
    classes: [],
    isFormField: true,
    isInteractive: true,
    ...overrides,
  };
}

describe('createAskableFocusSource', () => {
  it('registers as kind "focus"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('focus', createAskableFocusSource({ getSnapshot: () => makeSnapshot() }));
    const resolved = await ctx.resolveSource('focus');
    expect(resolved.kind).toBe('focus');
    ctx.destroy();
  });

  it('returns null data when getSnapshot returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('focus', createAskableFocusSource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('focus');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('returns the full snapshot as data', async () => {
    const snap = makeSnapshot({ hasFocus: true, focused: makeFocusedEl(), focusChangeCount: 3 });
    const ctx = createAskableContext();
    ctx.registerSource('focus', createAskableFocusSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('focus');
    const data = resolved.data as AskableFocusSourceSnapshot;
    expect(data.hasFocus).toBe(true);
    expect(data.focused?.tag).toBe('input');
    expect(data.focusChangeCount).toBe(3);
    ctx.destroy();
  });

  it('state includes hasFocus, focusedTag, and isFormField', async () => {
    const snap = makeSnapshot({ hasFocus: true, focused: makeFocusedEl() });
    const ctx = createAskableContext();
    ctx.registerSource('focus', createAskableFocusSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('focus', { mode: 'state' });
    const state = resolved.state as { hasFocus: boolean; focusedTag: string; isFormField: boolean };
    expect(state.hasFocus).toBe(true);
    expect(state.focusedTag).toBe('input');
    expect(state.isFormField).toBe(true);
    ctx.destroy();
  });

  it('describe says "No element is focused" when nothing focused', async () => {
    const source = createAskableFocusSource({ getSnapshot: () => makeSnapshot() });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('No element');
  });

  it('describe includes focused element label and tag', async () => {
    const source = createAskableFocusSource({
      getSnapshot: () => makeSnapshot({ hasFocus: true, focused: makeFocusedEl() }),
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('Email address');
    expect(desc).toContain('input');
  });

  it('describe falls back to id when no label', async () => {
    const source = createAskableFocusSource({
      getSnapshot: () => makeSnapshot({ hasFocus: true, focused: makeFocusedEl({ label: null, name: null }) }),
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('#email');
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableFocusSource({
      getSnapshot: () => makeSnapshot(),
      describe: () => 'Custom focus description',
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toBe('Custom focus description');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('focus', createAskableFocusSource({
      getSnapshot: () => makeSnapshot(),
      kind: 'active-element',
    }));
    const resolved = await ctx.resolveSource('focus');
    expect(resolved.kind).toBe('active-element');
    ctx.destroy();
  });
});
