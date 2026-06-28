import { describe, it, expect } from 'vitest';
import {
  WEB_CONTEXT_PROTOCOL,
  WEB_CONTEXT_VERSION,
  createWebContextPacket,
  isWebContextPacket,
  webContextPacketSchema,
} from '../index.js';

describe('createWebContextPacket', () => {
  it('applies protocol, version, and privacy/provenance defaults', () => {
    const packet = createWebContextPacket({ capture: { mode: 'element-focus' } });
    expect(packet.protocol).toBe(WEB_CONTEXT_PROTOCOL);
    expect(packet.version).toBe(WEB_CONTEXT_VERSION);
    expect(packet.privacy).toEqual({ redacted: false, consent: 'implicit' });
    expect(packet.provenance).toEqual({ producer: 'askable-ui', method: 'app' });
    expect(typeof packet.source.timestamp).toBe('string');
  });

  it('lets callers override defaults', () => {
    const packet = createWebContextPacket({
      capture: { mode: 'region', gesture: 'drag' },
      privacy: { redacted: true, consent: 'explicit' },
      provenance: { producer: 'my-app', method: 'extension' },
    });
    expect(packet.privacy.redacted).toBe(true);
    expect(packet.provenance.method).toBe('extension');
  });

  it('produces packets that pass the type guard', () => {
    const packet = createWebContextPacket({ capture: { mode: 'viewport' } });
    expect(isWebContextPacket(packet)).toBe(true);
  });
});

describe('isWebContextPacket', () => {
  const base = createWebContextPacket({ capture: { mode: 'element-focus', gesture: 'click' } });

  it('accepts a valid packet', () => {
    expect(isWebContextPacket(base)).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(isWebContextPacket(null)).toBe(false);
    expect(isWebContextPacket('packet')).toBe(false);
    expect(isWebContextPacket([base])).toBe(false);
  });

  it('rejects wrong protocol/version', () => {
    expect(isWebContextPacket({ ...base, protocol: 'other' })).toBe(false);
    expect(isWebContextPacket({ ...base, version: '9.9' })).toBe(false);
  });

  it('rejects an invalid capture.mode (enum enforced, not just typeof string)', () => {
    expect(isWebContextPacket({ ...base, capture: { mode: 'not-a-mode' } })).toBe(false);
  });

  it('rejects an invalid capture.gesture when present', () => {
    expect(isWebContextPacket({ ...base, capture: { mode: 'region', gesture: 'wiggle' } })).toBe(false);
  });

  it('allows a missing optional capture.gesture', () => {
    expect(isWebContextPacket({ ...base, capture: { mode: 'region' } })).toBe(true);
  });

  it('rejects an invalid privacy.consent', () => {
    expect(isWebContextPacket({ ...base, privacy: { redacted: false, consent: 'maybe' } })).toBe(false);
  });

  it('rejects an invalid provenance.method (enum enforced, not just typeof string)', () => {
    expect(
      isWebContextPacket({ ...base, provenance: { producer: 'x', method: 'telepathy' } }),
    ).toBe(false);
  });
});

describe('guard / schema agreement', () => {
  it('guard enum sets are sourced from the schema', () => {
    // Every schema-allowed capture mode must be accepted by the guard.
    for (const mode of webContextPacketSchema.properties.capture.properties.mode.enum) {
      const packet = createWebContextPacket({ capture: { mode } });
      expect(isWebContextPacket(packet)).toBe(true);
    }
    for (const method of webContextPacketSchema.properties.provenance.properties.method.enum) {
      const packet = createWebContextPacket({
        capture: { mode: 'custom' },
        provenance: { producer: 'x', method },
      });
      expect(isWebContextPacket(packet)).toBe(true);
    }
  });
});
