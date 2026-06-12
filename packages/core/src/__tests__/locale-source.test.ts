import { describe, it, expect } from 'vitest';
import { createAskableLocaleSource } from '../locale-source.js';
import { createAskableContext } from '../index.js';

describe('createAskableLocaleSource', () => {
  it('registers as kind "locale"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('locale', createAskableLocaleSource({ locale: 'en-US', timezone: 'UTC' }));

    const resolved = await ctx.resolveSource('locale');
    expect(resolved.kind).toBe('locale');
    ctx.destroy();
  });

  it('parses locale into language and region', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('locale', createAskableLocaleSource({ locale: 'en-US', timezone: 'UTC' }));

    const resolved = await ctx.resolveSource('locale');
    const data = resolved.data as { language: string; region: string | null; locale: string };
    expect(data.locale).toBe('en-US');
    expect(data.language).toBe('en');
    expect(data.region).toBe('US');
    ctx.destroy();
  });

  it('handles locale without region', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('locale', createAskableLocaleSource({ locale: 'fr', timezone: 'UTC' }));

    const resolved = await ctx.resolveSource('locale');
    const data = resolved.data as { language: string; region: string | null };
    expect(data.language).toBe('fr');
    expect(data.region).toBeNull();
    ctx.destroy();
  });

  it('maps region to currency', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('locale', createAskableLocaleSource({ locale: 'en-US', timezone: 'UTC' }));

    const resolved = await ctx.resolveSource('locale');
    const data = resolved.data as { currency: string | null };
    expect(data.currency).toBe('USD');
    ctx.destroy();
  });

  it('sets isRTL for Arabic locale', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('locale', createAskableLocaleSource({ locale: 'ar-SA', timezone: 'UTC' }));

    const resolved = await ctx.resolveSource('locale');
    const data = resolved.data as { isRTL: boolean };
    expect(data.isRTL).toBe(true);
    ctx.destroy();
  });

  it('sets isRTL to false for LTR locales', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('locale', createAskableLocaleSource({ locale: 'de-DE', timezone: 'UTC' }));

    const resolved = await ctx.resolveSource('locale');
    const data = resolved.data as { isRTL: boolean };
    expect(data.isRTL).toBe(false);
    ctx.destroy();
  });

  it('state includes locale, timezone, and language', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('locale', createAskableLocaleSource({ locale: 'ja-JP', timezone: 'Asia/Tokyo' }));

    const resolved = await ctx.resolveSource('locale', { mode: 'state' });
    const state = resolved.state as { locale: string; timezone: string; language: string };
    expect(state.locale).toBe('ja-JP');
    expect(state.timezone).toBe('Asia/Tokyo');
    expect(state.language).toBe('ja');
    ctx.destroy();
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableLocaleSource({
      locale: 'pt-BR',
      timezone: 'America/Sao_Paulo',
      describe: (s) => `User is in ${s.timezone} speaking ${s.language}`,
    });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('America/Sao_Paulo');
    expect(description).toContain('pt');
  });

  it('describe output contains locale and timezone', async () => {
    const source = createAskableLocaleSource({ locale: 'en-GB', timezone: 'Europe/London' });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('en-GB');
    expect(description).toContain('Europe/London');
  });
});
