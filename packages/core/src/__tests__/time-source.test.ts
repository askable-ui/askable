import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAskableTimeSource, buildTimeSnapshot } from '../time-source.js';
import { createAskableContext } from '../index.js';
import type { AskableTimeSourceSnapshot } from '../time-source.js';

function makeSnapshot(overrides: Partial<AskableTimeSourceSnapshot> = {}): AskableTimeSourceSnapshot {
  return {
    now: new Date().toISOString(),
    timezone: 'America/New_York',
    utcOffsetMinutes: -300,
    utcOffsetLabel: 'UTC-5:00',
    dayOfWeek: 2,
    hour: 14,
    minute: 30,
    isBusinessHours: true,
    isWeekend: false,
    sessionSeconds: 120,
    ...overrides,
  };
}

describe('createAskableTimeSource', () => {
  it('registers as kind "time"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('time', createAskableTimeSource({ getSnapshot: () => makeSnapshot() }));
    const resolved = await ctx.resolveSource('time');
    expect(resolved.kind).toBe('time');
    ctx.destroy();
  });

  it('returns null data when getSnapshot returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('time', createAskableTimeSource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('time');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('returns the full snapshot as data', async () => {
    const snap = makeSnapshot({ timezone: 'Europe/London', hour: 9, minute: 0 });
    const ctx = createAskableContext();
    ctx.registerSource('time', createAskableTimeSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('time');
    const data = resolved.data as AskableTimeSourceSnapshot;
    expect(data.timezone).toBe('Europe/London');
    expect(data.hour).toBe(9);
    ctx.destroy();
  });

  it('state includes timezone, isBusinessHours, and sessionSeconds', async () => {
    const snap = makeSnapshot({ isBusinessHours: false, isWeekend: true, sessionSeconds: 600 });
    const ctx = createAskableContext();
    ctx.registerSource('time', createAskableTimeSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('time', { mode: 'state' });
    const state = resolved.state as { isBusinessHours: boolean; isWeekend: boolean; sessionSeconds: number };
    expect(state.isBusinessHours).toBe(false);
    expect(state.isWeekend).toBe(true);
    expect(state.sessionSeconds).toBe(600);
    ctx.destroy();
  });

  it('describe includes time and timezone', async () => {
    const source = createAskableTimeSource({ getSnapshot: () => makeSnapshot({ hour: 10, minute: 5 }) });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('10:05');
    expect(desc).toContain('UTC');
  });

  it('describe mentions business hours status', async () => {
    const source = createAskableTimeSource({ getSnapshot: () => makeSnapshot({ isBusinessHours: false, isWeekend: false }) });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('Outside business hours');
  });

  it('describe mentions weekend', async () => {
    const source = createAskableTimeSource({ getSnapshot: () => makeSnapshot({ isWeekend: true }) });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('weekend');
  });

  it('buildTimeSnapshot respects custom business hours config', () => {
    const sessionStart = Date.now() - 5000;
    const snap = buildTimeSnapshot({ startHour: 8, endHour: 18, workDays: [1, 2, 3, 4, 5] }, sessionStart);
    expect(snap.sessionSeconds).toBeGreaterThanOrEqual(5);
    expect(snap.timezone).toBeTruthy();
    expect(typeof snap.utcOffsetMinutes).toBe('number');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('time', createAskableTimeSource({
      getSnapshot: () => makeSnapshot(),
      kind: 'clock',
    }));
    const resolved = await ctx.resolveSource('time');
    expect(resolved.kind).toBe('clock');
    ctx.destroy();
  });
});
