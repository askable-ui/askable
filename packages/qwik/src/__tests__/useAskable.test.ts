import { afterEach, describe, it, expect, vi } from 'vitest';
import { createAskableContext } from '@askable-ui/core';
import { useAskable } from '../useAskable.js';

const { cleanups } = vi.hoisted(() => ({ cleanups: [] as Array<() => void> }));

vi.mock('@builder.io/qwik', () => ({
  useSignal: <T>(value: T) => ({ value }),
  useVisibleTask$: (task: (args: { cleanup(callback: () => void): void }) => void) => {
    task({ cleanup: (callback) => cleanups.push(callback) });
  },
}));

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!();
});

// The Qwik primitives are mocked so adapter lifecycle and context-sharing
// behavior can be exercised without a rendered Qwik component.

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

  it.each([false, true])(
    'isolates an unnamed sanitizeSource context when sanitized hook starts first=%s',
    (sanitizedFirst) => {
      const first = sanitizedFirst
        ? useAskable({ sanitizeSource: (source) => source })
        : useAskable();
      const second = sanitizedFirst
        ? useAskable()
        : useAskable({ sanitizeSource: (source) => source });

      expect(first.ctx).not.toBe(second.ctx);
    }
  );

  it.each([
    ['maxHistory', { maxHistory: 0 }],
    ['sanitizeMeta', { sanitizeMeta: (meta: Record<string, unknown>) => meta }],
    ['sanitizeText', { sanitizeText: (text: string) => text }],
    ['sanitizeSource', { sanitizeSource: (source: any) => source }],
    ['textExtractor', { textExtractor: (element: Element) => element.textContent ?? '' }],
  ] as const)('isolates unnamed %s configuration', (_label, privateOptions) => {
    expect(useAskable().ctx).not.toBe(useAskable(privateOptions).ctx);
  });

  it.each([false, true])(
    'retains explicit named sharing when sanitized hook starts first=%s',
    (sanitizedFirst) => {
      const first = sanitizedFirst
        ? useAskable({ name: 'shared', sanitizeSource: (source) => source })
        : useAskable({ name: 'shared' });
      const second = sanitizedFirst
        ? useAskable({ name: 'shared' })
        : useAskable({ name: 'shared', sanitizeSource: (source) => source });

      expect(first.ctx).toBe(second.ctx);
    }
  );

  it('owns named contexts independently for different event configurations', () => {
    const click = useAskable({ name: 'region', events: ['click'] });
    const focus = useAskable({ name: 'region', events: ['focus'] });
    expect(click.ctx).not.toBe(focus.ctx);

    const focusDestroy = vi.spyOn(focus.ctx, 'destroy');
    cleanups.shift()!();
    expect(focusDestroy).not.toHaveBeenCalled();
    cleanups.shift()!();
    expect(focusDestroy).toHaveBeenCalledTimes(1);
  });

  it('isolates viewport-aware shared contexts', () => {
    expect(useAskable().ctx).not.toBe(useAskable({ viewport: true }).ctx);
  });
});
