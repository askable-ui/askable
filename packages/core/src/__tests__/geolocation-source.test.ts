import { describe, it, expect } from 'vitest';
import { createAskableGeolocationSource } from '../geolocation-source.js';
import { createAskableContext } from '../index.js';
import type { AskableGeolocationSourceSnapshot } from '../geolocation-source.js';

function makeSnapshot(overrides: Partial<AskableGeolocationSourceSnapshot> = {}): AskableGeolocationSourceSnapshot {
  return {
    coords: null,
    timestamp: null,
    hasPosition: false,
    isLoading: false,
    error: null,
    permissionState: 'unknown',
    ...overrides,
  };
}

function makeCoords() {
  return {
    latitude: 40.7128,
    longitude: -74.006,
    altitude: null,
    accuracy: 50,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  };
}

describe('createAskableGeolocationSource', () => {
  it('registers as kind "geolocation"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('geo', createAskableGeolocationSource({ getSnapshot: () => makeSnapshot() }));
    const resolved = await ctx.resolveSource('geo');
    expect(resolved.kind).toBe('geolocation');
    ctx.destroy();
  });

  it('returns null data when getSnapshot returns null', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('geo', createAskableGeolocationSource({ getSnapshot: () => null }));
    const resolved = await ctx.resolveSource('geo');
    expect(resolved.data).toBeNull();
    ctx.destroy();
  });

  it('returns snapshot with coordinates', async () => {
    const snap = makeSnapshot({ coords: makeCoords(), hasPosition: true, permissionState: 'granted' });
    const ctx = createAskableContext();
    ctx.registerSource('geo', createAskableGeolocationSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('geo');
    const data = resolved.data as AskableGeolocationSourceSnapshot;
    expect(data.coords?.latitude).toBe(40.7128);
    expect(data.hasPosition).toBe(true);
    ctx.destroy();
  });

  it('state includes hasPosition, isLoading, and permissionState', async () => {
    const snap = makeSnapshot({ hasPosition: false, isLoading: true, permissionState: 'prompt' });
    const ctx = createAskableContext();
    ctx.registerSource('geo', createAskableGeolocationSource({ getSnapshot: () => snap }));
    const resolved = await ctx.resolveSource('geo', { mode: 'state' });
    const state = resolved.state as { hasPosition: boolean; isLoading: boolean; permissionState: string };
    expect(state.hasPosition).toBe(false);
    expect(state.isLoading).toBe(true);
    expect(state.permissionState).toBe('prompt');
    ctx.destroy();
  });

  it('describe includes coordinates when available', async () => {
    const source = createAskableGeolocationSource({
      getSnapshot: () => makeSnapshot({ coords: makeCoords(), hasPosition: true }),
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('40.7128');
    expect(desc).toContain('-74.0060');
  });

  it('describe mentions error when acquisition fails', async () => {
    const source = createAskableGeolocationSource({
      getSnapshot: () => makeSnapshot({ error: 'User denied the request for Geolocation.' }),
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('error');
  });

  it('describe says "denied" when permission denied', async () => {
    const source = createAskableGeolocationSource({
      getSnapshot: () => makeSnapshot({ permissionState: 'denied' }),
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toContain('denied');
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableGeolocationSource({
      getSnapshot: () => makeSnapshot(),
      describe: () => 'Custom location description',
    });
    const desc = typeof source.describe === 'function' ? await source.describe() : source.describe ?? '';
    expect(desc).toBe('Custom location description');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('geo', createAskableGeolocationSource({
      getSnapshot: () => makeSnapshot(),
      kind: 'gps',
    }));
    const resolved = await ctx.resolveSource('geo');
    expect(resolved.kind).toBe('gps');
    ctx.destroy();
  });
});
