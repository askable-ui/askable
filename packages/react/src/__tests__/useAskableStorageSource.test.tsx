import { render } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableStorageSource } from '../useAskableStorageSource.js';
import type { UseAskableStorageSourceResult } from '../useAskableStorageSource.js';

let hookRef: UseAskableStorageSourceResult | undefined;

function StorageConsumer({
  ctx,
  ...rest
}: Parameters<typeof useAskableStorageSource>[0] & {
  ctx: ReturnType<typeof createAskableContext>;
}) {
  hookRef = useAskableStorageSource({ ctx, ...rest });
  return null;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  hookRef = undefined;
  localStorage.clear();
  sessionStorage.clear();
});

describe('useAskableStorageSource', () => {
  it('registers under "storage" id by default', () => {
    const ctx = createAskableContext();
    render(<StorageConsumer ctx={ctx} />);

    expect(ctx.hasSource('storage')).toBe(true);
    expect(hookRef!.sourceId).toBe('storage');
    ctx.destroy();
  });

  it('reads localStorage items', async () => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('locale', 'en');

    const ctx = createAskableContext();
    render(<StorageConsumer ctx={ctx} />);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { items: Record<string, unknown>; count: number };
    expect(data.count).toBe(2);
    expect(data.items.theme).toBe('dark');
    ctx.destroy();
  });

  it('filters to specified keys', async () => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('secret', 'abc');

    const ctx = createAskableContext();
    render(<StorageConsumer ctx={ctx} keys={['theme']} />);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { items: Record<string, unknown>; count: number };
    expect(data.count).toBe(1);
    expect(data.items.secret).toBeUndefined();
    ctx.destroy();
  });

  it('excludes omitKeys', async () => {
    localStorage.setItem('token', 'secret');
    localStorage.setItem('locale', 'fr');

    const ctx = createAskableContext();
    render(<StorageConsumer ctx={ctx} omitKeys={['token']} />);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { items: Record<string, unknown> };
    expect(data.items.token).toBeUndefined();
    expect(data.items.locale).toBe('fr');
    ctx.destroy();
  });

  it('masks values for maskKeys', async () => {
    localStorage.setItem('csrfToken', 'secret');
    localStorage.setItem('theme', 'light');

    const ctx = createAskableContext();
    render(<StorageConsumer ctx={ctx} maskKeys={['csrfToken']} />);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { items: Record<string, unknown> };
    expect(data.items.csrfToken).toBe('***');
    expect(data.items.theme).toBe('light');
    ctx.destroy();
  });

  it('accepts a custom id', () => {
    const ctx = createAskableContext();
    render(<StorageConsumer ctx={ctx} id="prefs" />);

    expect(ctx.hasSource('prefs')).toBe(true);
    ctx.destroy();
  });

  it('unregisters on unmount', () => {
    const ctx = createAskableContext();
    const { unmount } = render(<StorageConsumer ctx={ctx} />);

    expect(ctx.hasSource('storage')).toBe(true);
    unmount();
    expect(ctx.hasSource('storage')).toBe(false);
    ctx.destroy();
  });
});
