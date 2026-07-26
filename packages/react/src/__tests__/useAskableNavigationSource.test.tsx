import { Suspense, startTransition } from 'react';
import { render, act } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableNavigationSource } from '../useAskableNavigationSource.js';
import type {
  AskableNavigationEntry,
  UseAskableNavigationSourceResult,
} from '../useAskableNavigationSource.js';

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

  it('uses the latest router closures without registering another source', async () => {
    const ctx = createAskableContext();
    const registerSpy = vi.spyOn(ctx, 'registerSource');

    function RouterConsumer({
      path,
      title,
      params,
    }: {
      path: string;
      title: string;
      params: Record<string, string>;
    }) {
      hookRef = useAskableNavigationSource({
        ctx,
        pathname: path,
        getPath: () => path,
        getTitle: () => title,
        getParams: () => params,
      });
      return null;
    }

    const { rerender } = render(
      <RouterConsumer path="/first" title="First" params={{ slug: 'first' }} />,
    );

    await hookRef!.resolve();
    rerender(<RouterConsumer path="/second" title="Second" params={{ slug: 'second' }} />);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as {
      currentPath: string;
      currentTitle: string;
      params: Record<string, string>;
      history: AskableNavigationEntry[];
    };
    expect(data.currentPath).toBe('/second');
    expect(data.currentTitle).toBe('Second');
    expect(data.params).toEqual({ slug: 'second' });
    expect(data.history.map((entry) => entry.path)).toEqual(['/second', '/first']);
    expect(registerSpy).toHaveBeenCalledTimes(1);
    ctx.destroy();
  });

  it('does not expose router callbacks from an uncommitted suspended render', async () => {
    const ctx = createAskableContext();
    const never = new Promise<void>(() => {});

    function ConcurrentConsumer({ path, suspend }: { path: string; suspend: boolean }) {
      useAskableNavigationSource({
        ctx,
        pathname: path,
        getPath: () => path,
      });
      if (suspend) throw never;
      return null;
    }

    const view = render(
      <Suspense fallback={null}>
        <ConcurrentConsumer path="/committed" suspend={false} />
      </Suspense>,
    );
    expect(
      ((await ctx.resolveSource('navigation')).data as { currentPath: string }).currentPath,
    ).toBe('/committed');

    act(() => {
      startTransition(() => {
        view.rerender(
          <Suspense fallback={null}>
            <ConcurrentConsumer path="/aborted" suspend />
          </Suspense>,
        );
      });
    });

    expect(
      ((await ctx.resolveSource('navigation')).data as { currentPath: string }).currentPath,
    ).toBe('/committed');
    view.unmount();
    ctx.destroy();
  });

  it('uses the latest Next.js pathname and search params closures', async () => {
    const ctx = createAskableContext();

    function NextConsumer({ pathname, search }: { pathname: string; search: string }) {
      hookRef = useAskableNavigationSource({
        ctx,
        pathname,
        getPath: () => pathname + (search ? `?${search}` : ''),
      });
      return null;
    }

    const { rerender } = render(<NextConsumer pathname="/products" search="page=1" />);
    expect(
      ((await hookRef!.resolve()).data as { currentPath: string }).currentPath,
    ).toBe('/products?page=1');

    rerender(<NextConsumer pathname="/products/42" search="ref=home" />);
    expect(
      ((await hookRef!.resolve()).data as { currentPath: string }).currentPath,
    ).toBe('/products/42?ref=home');
    ctx.destroy();
  });

  it('uses updated description, kind, and history limit options', async () => {
    const ctx = createAskableContext();
    const registerSpy = vi.spyOn(ctx, 'registerSource');

    function RouterConsumer({
      path,
      description,
      kind,
      maxHistory,
    }: {
      path: string;
      description: string;
      kind: string;
      maxHistory: number;
    }) {
      hookRef = useAskableNavigationSource({
        ctx,
        pathname: path,
        getPath: () => path,
        describe: () => description,
        kind,
        maxHistory,
      });
      return null;
    }

    const { rerender } = render(
      <RouterConsumer path="/first" description="First description" kind="route" maxHistory={3} />,
    );
    expect((await hookRef!.resolve()).description).toBe('First description');

    rerender(
      <RouterConsumer path="/second" description="Second description" kind="route" maxHistory={3} />,
    );
    await hookRef!.resolve();

    rerender(
      <RouterConsumer path="/third" description="Third description" kind="router" maxHistory={2} />,
    );
    const resolved = await hookRef!.resolve();
    expect(resolved.kind).toBe('router');
    expect(resolved.description).toBe('Third description');
    expect(
      (resolved.data as { history: AskableNavigationEntry[] }).history.map((entry) => entry.path),
    ).toEqual(['/third', '/second']);
    expect(registerSpy).toHaveBeenCalledTimes(1);
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
