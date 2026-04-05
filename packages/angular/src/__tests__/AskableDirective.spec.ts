import { describe, it, expect } from 'vitest';
import { AskableDirective } from '../AskableDirective.js';

// AskableDirective is a plain class — the decorator only adds metadata.
// We can test the core attribute logic by instantiating directly.

describe('AskableDirective', () => {
  function makeDirective(meta: Record<string, unknown> | string): AskableDirective {
    const d = new AskableDirective();
    d.meta = meta;
    return d;
  }

  it('serializes an object meta to JSON for data-askable', () => {
    const d = makeDirective({ metric: 'revenue', period: 'Q3' });
    expect(d.dataAskable).toBe('{"metric":"revenue","period":"Q3"}');
  });

  it('passes a string meta through as-is', () => {
    const d = makeDirective('main navigation');
    expect(d.dataAskable).toBe('main navigation');
  });

  it('serializes an empty object', () => {
    const d = makeDirective({});
    expect(d.dataAskable).toBe('{}');
  });

  it('serializes a nested object', () => {
    const d = makeDirective({ chart: { type: 'bar', data: [1, 2, 3] } });
    const parsed = JSON.parse(d.dataAskable);
    expect(parsed.chart.type).toBe('bar');
    expect(parsed.chart.data).toEqual([1, 2, 3]);
  });

  it('updates when meta changes (reactive via getter)', () => {
    const d = makeDirective({ step: 1 });
    expect(JSON.parse(d.dataAskable).step).toBe(1);

    d.meta = { step: 2 };
    expect(JSON.parse(d.dataAskable).step).toBe(2);
  });

  it('default meta is an empty string', () => {
    const d = new AskableDirective();
    expect(d.dataAskable).toBe('');
  });
});
