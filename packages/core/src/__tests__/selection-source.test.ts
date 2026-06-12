import { describe, it, expect, vi } from 'vitest';
import { createAskableSelectionSource } from '../selection-source.js';
import { createAskableContext } from '../index.js';

function makeSelection(text: string, anchorEl?: Partial<Element>): Selection {
  const range = {
    startOffset: 0,
    endOffset: text.length,
    commonAncestorContainer: { textContent: `before ${text} after`, nodeType: 3 },
    getRangeAt: undefined as unknown,
  };

  return {
    toString: () => text,
    rangeCount: 1,
    getRangeAt: () => range as unknown as Range,
    anchorNode: anchorEl
      ? { nodeType: Node.ELEMENT_NODE, ...anchorEl } as unknown as Node
      : { nodeType: Node.TEXT_NODE, parentElement: null } as unknown as Node,
  } as unknown as Selection;
}

describe('createAskableSelectionSource', () => {
  it('registers as kind "selection"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('sel', createAskableSelectionSource({
      getSelection: () => makeSelection('hello'),
    }));

    const resolved = await ctx.resolveSource('sel');
    expect(resolved.kind).toBe('selection');
    ctx.destroy();
  });

  it('returns selectedText and length', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('sel', createAskableSelectionSource({
      getSelection: () => makeSelection('Hello World'),
    }));

    const resolved = await ctx.resolveSource('sel');
    const data = resolved.data as { selectedText: string; length: number; hasSelection: boolean };
    expect(data.selectedText).toBe('Hello World');
    expect(data.length).toBe(11);
    expect(data.hasSelection).toBe(true);
    ctx.destroy();
  });

  it('returns null data when nothing is selected', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('sel', createAskableSelectionSource({
      getSelection: () => makeSelection(''),
    }));

    const resolved = await ctx.resolveSource('sel');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('state reflects hasSelection and length', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('sel', createAskableSelectionSource({
      getSelection: () => makeSelection('Selected'),
    }));

    const resolved = await ctx.resolveSource('sel', { mode: 'state' });
    const state = resolved.state as { hasSelection: boolean; length: number };
    expect(state.hasSelection).toBe(true);
    expect(state.length).toBe(8);
    ctx.destroy();
  });

  it('truncates selectedText to maxLength', async () => {
    const longText = 'a'.repeat(100);
    const ctx = createAskableContext();
    ctx.registerSource('sel', createAskableSelectionSource({
      getSelection: () => makeSelection(longText),
      maxLength: 50,
    }));

    const resolved = await ctx.resolveSource('sel');
    const data = resolved.data as { selectedText: string };
    expect(data.selectedText.length).toBeLessThanOrEqual(52); // 50 + '…'
    expect(data.selectedText.endsWith('…')).toBe(true);
    ctx.destroy();
  });

  it('exposes containerTag from anchor element', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('sel', createAskableSelectionSource({
      getSelection: () => makeSelection('text', {
        tagName: 'P',
        id: '',
      }),
    }));

    const resolved = await ctx.resolveSource('sel');
    const data = resolved.data as { containerTag: string };
    expect(data.containerTag).toBe('p');
    ctx.destroy();
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableSelectionSource({
      getSelection: () => makeSelection('Important text'),
      describe: (s) => `User highlighted: ${s.selectedText}`,
    });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('User highlighted: Important text');
  });

  it('describe returns "No text currently selected" when nothing is selected', async () => {
    const source = createAskableSelectionSource({
      getSelection: () => makeSelection(''),
    });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('No text currently selected');
  });

  it('uses a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('sel', createAskableSelectionSource({
      getSelection: () => makeSelection('test'),
      kind: 'highlight',
    }));

    const resolved = await ctx.resolveSource('sel');
    expect(resolved.kind).toBe('highlight');
    ctx.destroy();
  });
});
