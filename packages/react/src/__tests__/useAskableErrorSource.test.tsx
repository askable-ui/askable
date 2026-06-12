import { useState } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableErrorSource } from '../useAskableErrorSource.js';
import type { AskableErrorEntry } from '../useAskableErrorSource.js';

describe('useAskableErrorSource', () => {
  it('registers under "errors" id by default', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableErrorSource({ ctx, errors: [] });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('errors');
      expect(resolved.id).toBe('errors');
      expect(resolved.kind).toBe('errors');
    });

    ctx.destroy();
  });

  it('accepts AskableErrorEntry array', async () => {
    const ctx = createAskableContext();
    const errors: AskableErrorEntry[] = [
      { key: 'email', message: 'Invalid email' },
      { key: 'phone', message: 'Required' },
    ];

    function Consumer() {
      useAskableErrorSource({ ctx, errors });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('errors');
      const data = resolved.data as { errors: AskableErrorEntry[]; total: number };
      expect(data.total).toBe(2);
      expect(data.errors[0].key).toBe('email');
    });

    ctx.destroy();
  });

  it('accepts a field-to-message Record (React Hook Form compatible)', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableErrorSource({
        ctx,
        errors: {
          email: 'Invalid email',
          password: 'Too short',
        },
      });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('errors');
      const data = resolved.data as { errors: AskableErrorEntry[] };
      expect(data.errors.map((e) => e.key).sort()).toEqual(['email', 'password']);
    });

    ctx.destroy();
  });

  it('accepts an Error instance', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableErrorSource({ ctx, errors: new Error('Network failure') });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('errors');
      const data = resolved.data as { errors: AskableErrorEntry[] };
      expect(data.errors[0].message).toBe('Network failure');
    });

    ctx.destroy();
  });

  it('reports hasErrors: false when errors is null', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableErrorSource({ ctx, errors: null });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('errors');
      const data = resolved.data as { hasErrors: boolean };
      expect(data.hasErrors).toBe(false);
    });

    ctx.destroy();
  });

  it('reflects updated errors after state change', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      const [err, setErr] = useState<Record<string, string>>({});
      useAskableErrorSource({ ctx, errors: err });
      return (
        <button
          data-testid="trigger"
          onClick={() => setErr({ email: 'Bad email' })}
        />
      );
    }

    const { getByTestId } = render(<Consumer />);

    await waitFor(async () => {
      const r = await ctx.resolveSource('errors');
      expect((r.data as { total: number }).total).toBe(0);
    });

    act(() => getByTestId('trigger').click());

    await waitFor(async () => {
      const r = await ctx.resolveSource('errors');
      expect((r.data as { total: number }).total).toBe(1);
    });

    ctx.destroy();
  });

  it('unregisters on unmount', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableErrorSource({ ctx, errors: [] });
      return null;
    }

    const view = render(<Consumer />);

    await waitFor(async () => {
      await expect(ctx.resolveSource('errors')).resolves.toMatchObject({ id: 'errors' });
    });

    view.unmount();
    await expect(ctx.resolveSource('errors')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('respects the enabled flag', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableErrorSource({ ctx, errors: [], enabled: false });
      return null;
    }

    render(<Consumer />);
    await expect(ctx.resolveSource('errors')).rejects.toThrow('not registered');
    ctx.destroy();
  });
});
