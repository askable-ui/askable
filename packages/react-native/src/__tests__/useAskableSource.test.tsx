import React, { useMemo } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createAskableContext } from '@askable-ui/core';
import type { AskableContextSource, AskableResolvedContextSource } from '@askable-ui/core';
import { useAskableSource } from '../useAskableSource.js';

function waitForAsyncContext() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('useAskableSource (React Native)', () => {
  it('registers a source and unregisters it on unmount', async () => {
    const ctx = createAskableContext();

    function SourceConsumer() {
      useAskableSource('accounts', {
        kind: 'collection',
        resolve: () => ({ count: 2 }),
      }, { ctx });
      return null;
    }

    let view: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(<SourceConsumer />);
    });

    await expect(ctx.resolveSource('accounts')).resolves.toMatchObject({
      id: 'accounts',
      kind: 'collection',
      data: { count: 2 },
    });

    act(() => {
      view.unmount();
    });

    await expect(ctx.resolveSource('accounts')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('uses the latest source implementation without re-registering', async () => {
    const ctx = createAskableContext();
    const results: AskableResolvedContextSource[] = [];

    function SourceConsumer({ count }: { count: number }) {
      useAskableSource('accounts', {
        resolve: () => ({ count }),
      }, { ctx });
      return null;
    }

    let view: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(<SourceConsumer count={1} />);
    });

    results.push(await ctx.resolveSource('accounts'));

    act(() => {
      view.update(<SourceConsumer count={2} />);
    });

    results.push(await ctx.resolveSource('accounts'));

    expect(results.map((source) => source.data)).toEqual([
      { count: 1 },
      { count: 2 },
    ]);

    act(() => {
      view.unmount();
    });
    ctx.destroy();
  });

  it('returns helpers for resolving and serializing the registered source', async () => {
    const ctx = createAskableContext();
    const prompts: string[] = [];
    const resolved: AskableResolvedContextSource[] = [];

    function SourceConsumer() {
      const source = useMemo<AskableContextSource>(() => ({
        kind: 'document',
        resolve: ({ mode }) => ({ mode, title: 'Mobile brief' }),
      }), []);
      const documentSource = useAskableSource('document', source, { ctx });

      React.useEffect(() => {
        documentSource.resolve({ mode: 'summary' }).then((value) => {
          resolved.push(value);
        });
        documentSource.toPromptContext({
          source: { mode: 'summary' },
        }).then((prompt) => {
          prompts.push(prompt);
        });
      }, [documentSource]);

      return null;
    }

    await act(async () => {
      TestRenderer.create(<SourceConsumer />);
      await Promise.resolve();
    });

    expect(resolved[0]).toMatchObject({
      id: 'document',
      kind: 'document',
      data: { mode: 'summary', title: 'Mobile brief' },
    });
    expect(prompts[0]).toContain('Mobile brief');

    ctx.destroy();
  });

  it('notifies async subscribers when source data changes', async () => {
    const ctx = createAskableContext();
    const updates: string[] = [];
    let count = 1;
    let accounts: ReturnType<typeof useAskableSource> | undefined;

    function SourceConsumer() {
      accounts = useAskableSource('accounts', {
        resolve: () => ({ count }),
      }, { ctx });
      return null;
    }

    act(() => {
      TestRenderer.create(<SourceConsumer />);
    });

    const unsubscribe = ctx.subscribeAsync((context) => {
      updates.push(context);
    }, {
      sources: ['accounts'],
      emitInitial: true,
    });

    await waitForAsyncContext();
    count = 2;

    act(() => {
      accounts!.notifyChanged();
    });
    await waitForAsyncContext();

    expect(updates.at(-1)).toContain('count":2');

    unsubscribe();
    ctx.destroy();
  });

  it('does not register while disabled', async () => {
    const ctx = createAskableContext();

    function SourceConsumer() {
      useAskableSource('accounts', {
        resolve: () => ({ count: 1 }),
      }, { ctx, enabled: false });
      return null;
    }

    act(() => {
      TestRenderer.create(<SourceConsumer />);
    });

    await expect(ctx.resolveSource('accounts')).rejects.toThrow('not registered');
    ctx.destroy();
  });
});
