import { describe, it, expect } from 'vitest';
import { createAskableMultistepSource, buildMultistepSnapshot } from '../multistep-source.js';
import { createAskableContext } from '../index.js';
import type { AskableMultistepSourceSnapshot } from '../multistep-source.js';

function makeSnapshot(overrides: Partial<AskableMultistepSourceSnapshot> = {}): AskableMultistepSourceSnapshot {
  return {
    steps: [],
    currentIndex: 0,
    totalSteps: 3,
    completedCount: 0,
    progressPercent: 0,
    isFirstStep: true,
    isLastStep: false,
    isComplete: false,
    startedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

function makeSteps() {
  return [
    { id: 'account', label: 'Account details', completed: true, active: false },
    { id: 'payment', label: 'Payment', completed: false, active: true },
    { id: 'review', label: 'Review', completed: false, active: false },
  ];
}

describe('createAskableMultistepSource', () => {
  it('registers as kind "multistep"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('wizard', createAskableMultistepSource({ getSnapshot: () => makeSnapshot() }));
    const resolved = await ctx.resolveSource('wizard');
    expect(resolved.kind).toBe('multistep');
    ctx.destroy();
  });

  it('returns null data when getSnapshot returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('wizard', createAskableMultistepSource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('wizard');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('buildMultistepSnapshot calculates progress correctly', () => {
    const snap = buildMultistepSnapshot(makeSteps());
    expect(snap.currentIndex).toBe(1);
    expect(snap.completedCount).toBe(1);
    expect(snap.progressPercent).toBe(33);
    expect(snap.isFirstStep).toBe(false);
    expect(snap.isLastStep).toBe(false);
  });

  it('state includes currentIndex, totalSteps, and progressPercent', async () => {
    const snap = makeSnapshot({ currentIndex: 1, totalSteps: 3, progressPercent: 33, completedCount: 1 });
    const ctx = createAskableContext();
    ctx.registerSource('wizard', createAskableMultistepSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('wizard', { mode: 'state' });
    const state = resolved.state as { currentIndex: number; totalSteps: number; progressPercent: number };
    expect(state.currentIndex).toBe(1);
    expect(state.totalSteps).toBe(3);
    expect(state.progressPercent).toBe(33);
    ctx.destroy();
  });

  it('describe mentions current step and total', async () => {
    const steps = makeSteps();
    const snap = buildMultistepSnapshot(steps);
    const source = createAskableMultistepSource({ getSnapshot: () => snap });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('2 of 3');
    expect(desc).toContain('Payment');
  });

  it('describe says "Flow complete" when all steps done', async () => {
    const snap = makeSnapshot({ isComplete: true, totalSteps: 3, completedCount: 3 });
    const source = createAskableMultistepSource({ getSnapshot: () => snap });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('complete');
  });

  it('describe includes step error when present', async () => {
    const steps = makeSteps();
    steps[1].error = 'Card number is invalid';
    const snap = buildMultistepSnapshot(steps);
    const source = createAskableMultistepSource({ getSnapshot: () => snap });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('Card number is invalid');
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableMultistepSource({
      getSnapshot: () => makeSnapshot(),
      describe: () => 'Custom wizard description',
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toBe('Custom wizard description');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('wizard', createAskableMultistepSource({
      getSnapshot: () => makeSnapshot(),
      kind: 'checkout',
    }));
    const resolved = await ctx.resolveSource('wizard');
    expect(resolved.kind).toBe('checkout');
    ctx.destroy();
  });
});
