import { describe, it, expect } from 'vitest';
import { createAskableBatterySource, getBatteryStatus, formatDuration } from '../battery-source.js';
import { createAskableContext } from '../index.js';
import type { AskableBatterySourceSnapshot } from '../battery-source.js';

function makeSnapshot(overrides: Partial<AskableBatterySourceSnapshot> = {}): AskableBatterySourceSnapshot {
  return {
    level: 80,
    charging: false,
    chargingTime: null,
    dischargingTime: 7200,
    chargingTimeLabel: null,
    dischargingTimeLabel: '~2h 0min remaining',
    status: 'high',
    ...overrides,
  };
}

describe('createAskableBatterySource', () => {
  it('registers as kind "battery"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('battery', createAskableBatterySource({ getSnapshot: () => makeSnapshot() }));
    const resolved = await ctx.resolveSource('battery');
    expect(resolved.kind).toBe('battery');
    ctx.destroy();
  });

  it('returns null data when getSnapshot returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('battery', createAskableBatterySource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('battery');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('returns the full snapshot as data', async () => {
    const snap = makeSnapshot({ level: 45, charging: true, status: 'medium' });
    const ctx = createAskableContext();
    ctx.registerSource('battery', createAskableBatterySource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('battery');
    const data = resolved.data as AskableBatterySourceSnapshot;
    expect(data.level).toBe(45);
    expect(data.charging).toBe(true);
    expect(data.status).toBe('medium');
    ctx.destroy();
  });

  it('state includes level, charging, and status', async () => {
    const snap = makeSnapshot({ level: 12, charging: false, status: 'critical' });
    const ctx = createAskableContext();
    ctx.registerSource('battery', createAskableBatterySource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('battery', { mode: 'state' });
    const state = resolved.state as { level: number; charging: boolean; status: string };
    expect(state.level).toBe(12);
    expect(state.charging).toBe(false);
    expect(state.status).toBe('critical');
    ctx.destroy();
  });

  it('describe mentions charging state and level', async () => {
    const source = createAskableBatterySource({ getSnapshot: () => makeSnapshot({ level: 75, charging: true }) });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('charging');
    expect(desc).toContain('75');
  });

  it('describe mentions discharging time when not charging', async () => {
    const source = createAskableBatterySource({
      getSnapshot: () => makeSnapshot({ level: 20, charging: false, dischargingTimeLabel: '~30 min remaining', status: 'low' }),
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('20');
    expect(desc).toContain('30 min');
  });

  it('getBatteryStatus returns correct status', () => {
    expect(getBatteryStatus(null)).toBe('unknown');
    expect(getBatteryStatus(100)).toBe('full');
    expect(getBatteryStatus(80)).toBe('high');
    expect(getBatteryStatus(40)).toBe('medium');
    expect(getBatteryStatus(20)).toBe('low');
    expect(getBatteryStatus(10)).toBe('critical');
  });

  it('formatDuration formats hours and minutes', () => {
    expect(formatDuration(7200)).toBe('~2h 0min remaining');
    expect(formatDuration(2700)).toBe('~45 min remaining');
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(Infinity)).toBeNull();
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('battery', createAskableBatterySource({
      getSnapshot: () => makeSnapshot(),
      kind: 'device-battery',
    }));
    const resolved = await ctx.resolveSource('battery');
    expect(resolved.kind).toBe('device-battery');
    ctx.destroy();
  });
});
