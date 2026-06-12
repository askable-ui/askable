import { render, act } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableNavigationSource } from '../useAskableNavigationSource.js';
import type { UseAskableNavigationSourceResult } from '../useAskableNavigationSource.js';

let hookRef: UseAskableNavigationSourceResult | undefined;

function NavConsumer({
  ctx,
  ...rest
}: Parameters<typeof useAskableNavigationSource>[0] & {
  ctx: ReturnType<typeof createAskableContext>;
}) {
  hookRef = useAskableNavigationSource({ ctx, ...rest });
  return null;
}

describe('useAskableNavigationSource', () => {
  afterEach(() => {
    hookRef = undefined;
  });

  it('registers under "navigation" id by default', () => {
    const ctx = createAskableContext();
    render(<NavConsumer ctx={ctx} />);

    expect(ctx.hasSource('navigation')).toBe(true);
    expect(hookRef!.sourceId).toBe('navigation');
    ctx.destroy();
  });

  it('accepts a custom id', () => {
    const ctx = createAskableContext();
    render(<NavConsumer ctx={ctx} id="router" />);

    expect(ctx.hasSource('router')).toBe(true);
    expect(hookRef!.sourceId).toBe('router');
    ctx.destroy();
  });

  it('returns navigation data from getPath', async () => {
    const ctx = createAskableContext();
    render(
      <NavConsumer
        ctx={ctx}
        getPath={() => '/dashboard?tab=overview'}
        getTitle={() => 'Dashboard'}
      />,
    );

    const resolved = await hookRef!.resolve();
    const data = resolved.data as {
      currentPath: string;
      currentTitle: string;
      query: Record<string, string>;
    };
    expect(data.currentPath).toBe('/dashboard?tab=overview');
    expect(data.currentTitle).toBe('Dashboard');
    expect(data.query.tab).toBe('overview');
    ctx.destroy();
  });

  it('includes route params when getParams is provided', async () => {
    const ctx = createAskableContext();
    render(
      <NavConsumer
        ctx={ctx}
        getPath={() => '/users/42'}
        getParams={() => ({ userId: '42' })}
      />,
    );

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { params: Record<string, string> };
    expect(data.params).toEqual({ userId: '42' });
    ctx.destroy();
  });

  it('auto-notifies when pathname prop changes', async () => {
    const ctx = createAskableContext();
    let currentPath = '/home';

    const { rerender } = render(
      <NavConsumer ctx={ctx} pathname={currentPath} getPath={() => currentPath} />,
    );

    const before = await hookRef!.resolve();
    expect((before.data as { currentPath: string }).currentPath).toBe('/home');

    currentPath = '/about';
    await act(async () => {
      rerender(
        <NavConsumer ctx={ctx} pathname={currentPath} getPath={() => currentPath} />,
      );
    });

    const after = await hookRef!.resolve();
    expect((after.data as { currentPath: string }).currentPath).toBe('/about');
    ctx.destroy();
  });

  it('unregisters on unmount', () => {
    const ctx = createAskableContext();
    const { unmount } = render(<NavConsumer ctx={ctx} />);

    expect(ctx.hasSource('navigation')).toBe(true);
    unmount();
    expect(ctx.hasSource('navigation')).toBe(false);
    ctx.destroy();
  });
});
