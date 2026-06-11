import { render, waitFor } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskablePageSource } from '../useAskablePageSource.js';

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
});
