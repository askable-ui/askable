import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAskableThemeSource } from '../theme-source.js';
import { createAskableContext } from '../index.js';

describe('createAskableThemeSource', () => {
  beforeEach(() => {
    // Mock matchMedia — jsdom doesn't support it
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it('registers as kind "theme"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('theme', createAskableThemeSource());

    const resolved = await ctx.resolveSource('theme');
    expect(resolved.kind).toBe('theme');
    ctx.destroy();
  });

  it('returns colorScheme: "dark" when dark media query matches', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('theme', createAskableThemeSource());

    const resolved = await ctx.resolveSource('theme');
    const data = resolved.data as { colorScheme: string; isDark: boolean };
    expect(data.colorScheme).toBe('dark');
    expect(data.isDark).toBe(true);
    ctx.destroy();
  });

  it('returns colorScheme: "light" when light media query matches', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('light') && !query.includes('dark'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    const ctx = createAskableContext();
    ctx.registerSource('theme', createAskableThemeSource());

    const resolved = await ctx.resolveSource('theme');
    const data = resolved.data as { colorScheme: string; isLight: boolean; isDark: boolean };
    expect(data.colorScheme).toBe('light');
    expect(data.isLight).toBe(true);
    expect(data.isDark).toBe(false);
    ctx.destroy();
  });

  it('state includes colorScheme and isDark', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('theme', createAskableThemeSource());

    const resolved = await ctx.resolveSource('theme', { mode: 'state' });
    const state = resolved.state as { colorScheme: string; isDark: boolean };
    expect(typeof state.colorScheme).toBe('string');
    expect(typeof state.isDark).toBe('boolean');
    ctx.destroy();
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableThemeSource({
      describe: (s) => `Mode: ${s.colorScheme}`,
    });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('Mode: dark');
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('theme', createAskableThemeSource({ kind: 'appearance' }));

    const resolved = await ctx.resolveSource('theme');
    expect(resolved.kind).toBe('appearance');
    ctx.destroy();
  });

  it('describe output contains color scheme info', async () => {
    const source = createAskableThemeSource();
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('Color scheme:');
  });
});
