import { render, act } from '@testing-library/react';
import { useState } from 'react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableNotificationSource } from '../useAskableNotificationSource.js';
import type { UseAskableNotificationSourceResult, AskableNotification } from '../useAskableNotificationSource.js';

let hookRef: UseAskableNotificationSourceResult | undefined;

function NotifConsumer({
  ctx,
  ...rest
}: Parameters<typeof useAskableNotificationSource>[0] & {
  ctx: ReturnType<typeof createAskableContext>;
}) {
  hookRef = useAskableNotificationSource({ ctx, ...rest });
  return null;
}

describe('useAskableNotificationSource', () => {
  afterEach(() => {
    hookRef = undefined;
  });

  it('registers under "notifications" id by default', () => {
    const ctx = createAskableContext();
    render(<NotifConsumer ctx={ctx} />);

    expect(ctx.hasSource('notifications')).toBe(true);
    expect(hookRef!.sourceId).toBe('notifications');
    ctx.destroy();
  });

  it('returns notifications data', async () => {
    const ctx = createAskableContext();
    const notifs: AskableNotification[] = [
      { id: '1', message: 'Saved', severity: 'success' },
      { id: '2', message: 'Failed', severity: 'error' },
    ];

    render(<NotifConsumer ctx={ctx} notifications={notifs} />);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { total: number; hasErrors: boolean };
    expect(data.total).toBe(2);
    expect(data.hasErrors).toBe(true);
    ctx.destroy();
  });

  it('returns total: 0 when empty', async () => {
    const ctx = createAskableContext();
    render(<NotifConsumer ctx={ctx} notifications={[]} />);

    const resolved = await hookRef!.resolve();
    const data = resolved.data as { total: number };
    expect(data.total).toBe(0);
    ctx.destroy();
  });

  it('auto-notifies when notifications array changes', async () => {
    const ctx = createAskableContext();

    function TestWrapper() {
      const [notifs, setNotifs] = useState<AskableNotification[]>([]);
      hookRef = useAskableNotificationSource({ ctx, notifications: notifs });

      return (
        <button onClick={() => setNotifs([{ id: '1', message: 'New toast', severity: 'info' }])}>
          Add
        </button>
      );
    }

    const { getByText } = render(<TestWrapper />);

    const before = await hookRef!.resolve();
    expect((before.data as { total: number }).total).toBe(0);

    await act(async () => {
      getByText('Add').click();
    });

    const after = await hookRef!.resolve();
    expect((after.data as { total: number }).total).toBe(1);
    ctx.destroy();
  });

  it('accepts a custom id', () => {
    const ctx = createAskableContext();
    render(<NotifConsumer ctx={ctx} id="toasts" />);

    expect(ctx.hasSource('toasts')).toBe(true);
    ctx.destroy();
  });

  it('unregisters on unmount', () => {
    const ctx = createAskableContext();
    const { unmount } = render(<NotifConsumer ctx={ctx} />);

    expect(ctx.hasSource('notifications')).toBe(true);
    unmount();
    expect(ctx.hasSource('notifications')).toBe(false);
    ctx.destroy();
  });
});
