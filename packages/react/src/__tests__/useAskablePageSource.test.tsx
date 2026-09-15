import { render, waitFor } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskablePageSource, type UseAskablePageSourceOptions } from '../useAskablePageSource.js';

describe('useAskablePageSource', () => {
  it('registers a page source under the "page" id by default', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskablePageSource({ ctx });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('page');
      expect(resolved.id).toBe('page');
      expect(resolved.kind).toBe('page');
    });

    ctx.destroy();
  });

  it('accepts a custom id', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskablePageSource({ ctx, id: 'current-page' });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('current-page');
      expect(resolved.id).toBe('current-page');
    });

    ctx.destroy();
  });

  it('unregisters the source on unmount', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskablePageSource({ ctx });
      return null;
    }

    const view = render(<Consumer />);

    await waitFor(async () => {
      await expect(ctx.resolveSource('page')).resolves.toMatchObject({ id: 'page' });
    });

    view.unmount();

    await expect(ctx.resolveSource('page')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('respects the enabled flag', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskablePageSource({ ctx, enabled: false });
      return null;
    }

    render(<Consumer />);

    await expect(ctx.resolveSource('page')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('passes includeLinks option through to the page source', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskablePageSource({ ctx, includeLinks: true });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('page');
      expect(resolved.kind).toBe('page');
    });

    ctx.destroy();
  });

  it('accepts custom describe and kind options', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskablePageSource({ ctx, describe: 'App viewport', kind: 'viewport' });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('page');
      expect(resolved.kind).toBe('viewport');
    });

    ctx.destroy();
  });

  it('uses a replacement sanitizer without leaking synthetic text or re-registering', async () => {
    const ctx = createAskableContext();
    const register = vi.spyOn(ctx, 'registerSource');
    const secret = 'synthetic-page-secret';
    const textExtractor = () => secret;

    function Consumer({ sanitizeText }: Pick<UseAskablePageSourceOptions, 'sanitizeText'>) {
      useAskablePageSource({ ctx, sanitizeText, textExtractor });
      return <h1>{secret}</h1>;
    }

    const view = render(<Consumer sanitizeText={(text) => text} />);
    expect((await ctx.resolveSource('page', { mode: 'all' })).data).toMatchObject({ text: secret });

    view.rerender(<Consumer sanitizeText={() => '[redacted]'} />);
    const resolved = await ctx.resolveSource('page', { mode: 'all' });
    expect(resolved.data).toMatchObject({ text: '[redacted]', headings: [{ level: 1, text: '[redacted]' }] });
    expect(JSON.stringify(resolved)).not.toContain(secret);
    const prompt = await ctx.toPromptContextAsync({ sources: [{ id: 'page', mode: 'all' }] });
    expect(prompt).toContain('[redacted]');
    expect(prompt).not.toContain(secret);
    expect(register).toHaveBeenCalledTimes(1);

    view.unmount();
    await expect(ctx.resolveSource('page')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it.each([
    {
      option: 'describe',
      initial: { describe: () => 'Initial page' },
      replacement: { describe: async () => 'Updated page' },
      initialExpected: { description: 'Initial page' },
      replacementExpected: { description: 'Updated page' },
    },
    {
      option: 'textExtractor',
      initial: { textExtractor: () => 'Initial text' },
      replacement: { textExtractor: () => 'Updated text' },
      initialExpected: { data: { text: 'Initial text' } },
      replacementExpected: { data: { text: 'Updated text' } },
    },
    {
      option: 'sanitizeText',
      initial: { sanitizeText: () => '[redacted]' },
      replacement: { sanitizeText: () => '' },
      initialExpected: { data: { text: '[redacted]' } },
      replacementExpected: { data: { text: '' } },
    },
  ])('supports adding, replacing, and removing $option without re-registering', async ({
    initial, replacement, initialExpected, replacementExpected,
  }) => {
    const ctx = createAskableContext();
    const register = vi.spyOn(ctx, 'registerSource');

    function Consumer(options: Pick<UseAskablePageSourceOptions, 'describe' | 'textExtractor' | 'sanitizeText'>) {
      useAskablePageSource({ ctx, ...options });
      return <p>Default page text</p>;
    }

    const view = render(<Consumer />);
    view.rerender(<Consumer {...initial} />);
    expect(await ctx.resolveSource('page', { mode: 'all' })).toMatchObject(initialExpected);

    view.rerender(<Consumer {...replacement} />);
    expect(await ctx.resolveSource('page', { mode: 'all' })).toMatchObject(replacementExpected);

    view.rerender(<Consumer />);
    expect(await ctx.resolveSource('page', { mode: 'all' })).toMatchObject({
      description: 'Current page', data: { text: 'Default page text' },
    });
    expect(register).toHaveBeenCalledTimes(1);

    view.unmount();
    ctx.destroy();
  });
});
