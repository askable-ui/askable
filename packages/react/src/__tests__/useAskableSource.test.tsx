import { render, waitFor } from '@testing-library/react';
import { useEffect, useMemo } from 'react';
import { createAskableContext } from '@askable-ui/core';
import type { AskableContextSource, AskableResolvedContextSource } from '@askable-ui/core';
import { useAskableSource } from '../useAskableSource.js';

describe('useAskableSource', () => {
  it('registers a source and unregisters it on unmount', async () => {
    const ctx = createAskableContext();

    function SourceConsumer() {
      useAskableSource('accounts', {
        kind: 'collection',
        getState: () => ({ totalCount: 2 }),
        resolve: () => ({ rows: [{ company: 'Acme' }] }),
      }, { ctx });
      return null;
    }

    const view = render(<SourceConsumer />);

    await waitFor(async () => {
      await expect(ctx.resolveSource('accounts')).resolves.toMatchObject({
        id: 'accounts',
        kind: 'collection',
        state: { totalCount: 2 },
        data: { rows: [{ company: 'Acme' }] },
      });
    });

    view.unmount();

    await expect(ctx.resolveSource('accounts')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('uses the latest source implementation without re-registering', async () => {
    const ctx = createAskableContext();
    const results: AskableResolvedContextSource[] = [];

    function SourceConsumer({ count }: { count: number }) {
      useAskableSource('accounts', {
        getState: () => ({ count }),
        resolve: () => ({ count }),
      }, { ctx });

      useEffect(() => {
        ctx.resolveSource('accounts').then((source) => {
          results.push(source);
        });
      }, [count]);

      return null;
    }

    const view = render(<SourceConsumer count={1} />);
    await waitFor(() => expect(results).toHaveLength(1));

    view.rerender(<SourceConsumer count={2} />);
    await waitFor(() => expect(results).toHaveLength(2));

    expect(results[0].state).toEqual({ count: 1 });
    expect(results[1].state).toEqual({ count: 2 });

    view.unmount();
    ctx.destroy();
  });

  it('returns helpers for resolving and serializing the registered source', async () => {
    const ctx = createAskableContext();
    let prompt = '';

    function SourceConsumer() {
      const source = useMemo<AskableContextSource>(() => ({
        kind: 'collection',
        resolve: ({ mode }) => ({ mode, total: 12 }),
      }), []);
      const accounts = useAskableSource('accounts', source, { ctx });

      useEffect(() => {
        accounts.toPromptContext({
          source: { mode: 'summary' },
        }).then((value) => {
          prompt = value;
        });
      }, [accounts]);

      return null;
    }

    render(<SourceConsumer />);

    await waitFor(() => expect(prompt).toContain('accounts'));
    expect(prompt).toContain('"total":12');

    ctx.destroy();
  });

  it('notifies async subscribers when source data changes', async () => {
    const ctx = createAskableContext();
    let total = 1;
    let accounts: ReturnType<typeof useAskableSource> | undefined;

    function SourceConsumer() {
      accounts = useAskableSource('accounts', {
        resolve: () => ({ total }),
      }, { ctx });
      return null;
    }

    render(<SourceConsumer />);

    await waitFor(async () => {
      await expect(ctx.resolveSource('accounts')).resolves.toMatchObject({
        data: { total: 1 },
      });
    });

    const received: string[] = [];
    ctx.subscribeAsync((context) => {
      received.push(context);
    }, {
      emitInitial: true,
      sources: ['accounts'],
    });

    await waitFor(() => expect(received).toHaveLength(1));
    total = 2;
    accounts?.notifyChanged();

    await waitFor(() => {
      expect(received).toHaveLength(2);
      expect(received[1]).toContain('"total":2');
    });

    ctx.destroy();
  });

  it('can disable registration', async () => {
    const ctx = createAskableContext();

    function SourceConsumer() {
      useAskableSource('accounts', {
        resolve: () => ({ total: 1 }),
      }, { ctx, enabled: false });
      return null;
    }

    render(<SourceConsumer />);

    await expect(ctx.resolveSource('accounts')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('normalizes whitespace around ids', async () => {
    const ctx = createAskableContext();

    function SourceConsumer() {
      useAskableSource(' accounts ', {
        resolve: () => ({ total: 1 }),
      }, { ctx });
      return null;
    }

    render(<SourceConsumer />);

    await waitFor(async () => {
      await expect(ctx.resolveSource('accounts')).resolves.toMatchObject({
        id: 'accounts',
        data: { total: 1 },
      });
    });

    ctx.destroy();
  });
});
