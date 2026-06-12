import { describe, it, expect } from 'vitest';
import { createAskableClipboardSource } from '../clipboard-source.js';
import { createAskableContext } from '../index.js';
import type { AskableClipboardSourceSnapshot } from '../clipboard-source.js';

function makeSnapshot(text: string, total = 1): AskableClipboardSourceSnapshot {
  const entry = {
    text,
    copiedAt: '2025-01-01T00:00:00.000Z',
    source: 'copy-event' as const,
  };
  return {
    current: entry,
    history: [entry],
    total,
  };
}

describe('createAskableClipboardSource', () => {
  it('registers as kind "clipboard"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('cb', createAskableClipboardSource());

    const resolved = await ctx.resolveSource('cb');
    expect(resolved.kind).toBe('clipboard');
    ctx.destroy();
  });

  it('returns null data when clipboard is empty', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('cb', createAskableClipboardSource({ getSnapshot: () => null }));

    const resolved = await ctx.resolveSource('cb');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('returns snapshot data when clipboard has content', async () => {
    const snapshot = makeSnapshot('Hello, clipboard!');
    const ctx = createAskableContext();
    ctx.registerSource('cb', createAskableClipboardSource({ getSnapshot: () => snapshot }));

    const resolved = await ctx.resolveSource('cb');
    const data = resolved.data as AskableClipboardSourceSnapshot;
    expect(data.current?.text).toBe('Hello, clipboard!');
    expect(data.total).toBe(1);
    ctx.destroy();
  });

  it('state.hasContent is true when clipboard has content', async () => {
    const snapshot = makeSnapshot('some text');
    const ctx = createAskableContext();
    ctx.registerSource('cb', createAskableClipboardSource({ getSnapshot: () => snapshot }));

    const resolved = await ctx.resolveSource('cb', { mode: 'state' });
    const state = resolved.state as { hasContent: boolean; total: number };
    expect(state.hasContent).toBe(true);
    expect(state.total).toBe(1);
    ctx.destroy();
  });

  it('state.hasContent is false when clipboard is empty', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('cb', createAskableClipboardSource({ getSnapshot: () => null }));

    const resolved = await ctx.resolveSource('cb', { mode: 'state' });
    const state = resolved.state as { hasContent: boolean; total: number };
    expect(state.hasContent).toBe(false);
    expect(state.total).toBe(0);
    ctx.destroy();
  });

  it('describe returns "Clipboard is empty" when no content', async () => {
    const source = createAskableClipboardSource({ getSnapshot: () => null });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('Clipboard is empty');
  });

  it('describe returns clipboard text when content is present', async () => {
    const snapshot = makeSnapshot('copied text');
    const source = createAskableClipboardSource({ getSnapshot: () => snapshot });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('copied text');
  });

  it('accepts a custom describe function', async () => {
    const snapshot = makeSnapshot('important data');
    const source = createAskableClipboardSource({
      getSnapshot: () => snapshot,
      describe: (s) => `Copied: ${s.current?.text}`,
    });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toBe('Copied: important data');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('cb', createAskableClipboardSource({ kind: 'paste-buffer' }));

    const resolved = await ctx.resolveSource('cb');
    expect(resolved.kind).toBe('paste-buffer');
    ctx.destroy();
  });
});
