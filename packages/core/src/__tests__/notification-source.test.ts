import { describe, it, expect } from 'vitest';
import { createAskableNotificationSource } from '../notification-source.js';
import { createAskableContext } from '../index.js';
import type { AskableNotification } from '../notification-source.js';

const NOTIFICATIONS: AskableNotification[] = [
  { id: '1', message: 'File saved successfully', severity: 'success' },
  { id: '2', message: 'Low disk space', severity: 'warning' },
  { id: '3', message: 'Connection failed', severity: 'error' },
  { id: '4', message: 'New update available', severity: 'info' },
];

describe('createAskableNotificationSource', () => {
  it('registers as kind "notifications"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('notifs', createAskableNotificationSource({ getNotifications: () => [] }));

    const resolved = await ctx.resolveSource('notifs');
    expect(resolved.kind).toBe('notifications');
    ctx.destroy();
  });

  it('returns all notifications in data', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('notifs', createAskableNotificationSource({ getNotifications: () => NOTIFICATIONS }));

    const resolved = await ctx.resolveSource('notifs');
    const data = resolved.data as { notifications: AskableNotification[]; total: number };
    expect(data.total).toBe(4);
    expect(data.notifications[0].id).toBe('1');
    ctx.destroy();
  });

  it('groups notifications by severity', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('notifs', createAskableNotificationSource({ getNotifications: () => NOTIFICATIONS }));

    const resolved = await ctx.resolveSource('notifs');
    const data = resolved.data as {
      byLevel: { errors: AskableNotification[]; warnings: AskableNotification[]; successes: AskableNotification[] };
      hasErrors: boolean;
      hasWarnings: boolean;
    };
    expect(data.byLevel.errors).toHaveLength(1);
    expect(data.byLevel.warnings).toHaveLength(1);
    expect(data.byLevel.successes).toHaveLength(1);
    expect(data.hasErrors).toBe(true);
    expect(data.hasWarnings).toBe(true);
    ctx.destroy();
  });

  it('returns state with counts', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('notifs', createAskableNotificationSource({ getNotifications: () => NOTIFICATIONS }));

    const resolved = await ctx.resolveSource('notifs', { mode: 'state' });
    expect((resolved.state as { total: number }).total).toBe(4);
    ctx.destroy();
  });

  it('caps to maxNotifications', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('notifs', createAskableNotificationSource({
      getNotifications: () => NOTIFICATIONS,
      maxNotifications: 2,
    }));

    const resolved = await ctx.resolveSource('notifs');
    const data = resolved.data as { notifications: AskableNotification[] };
    expect(data.notifications).toHaveLength(2);
    ctx.destroy();
  });

  it('returns total: 0 when no notifications', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('notifs', createAskableNotificationSource({ getNotifications: () => [] }));

    const resolved = await ctx.resolveSource('notifs');
    const data = resolved.data as { total: number; hasErrors: boolean };
    expect(data.total).toBe(0);
    expect(data.hasErrors).toBe(false);
    ctx.destroy();
  });

  it('accepts a custom kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('toasts', createAskableNotificationSource({
      getNotifications: () => [],
      kind: 'toasts',
    }));

    const resolved = await ctx.resolveSource('toasts');
    expect(resolved.kind).toBe('toasts');
    ctx.destroy();
  });

  it('works with async getNotifications', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('notifs', createAskableNotificationSource({
      getNotifications: async () => [{ id: '1', message: 'Async notification' }],
    }));

    const resolved = await ctx.resolveSource('notifs');
    const data = resolved.data as { total: number };
    expect(data.total).toBe(1);
    ctx.destroy();
  });

  it('accepts a custom describe function', async () => {
    const source = createAskableNotificationSource({
      getNotifications: () => NOTIFICATIONS,
      describe: (s) => `${s.total} alerts active`,
    });
    const description = typeof source.describe === 'function'
      ? await source.describe()
      : source.describe ?? '';
    expect(description).toContain('4 alerts active');
  });
});
