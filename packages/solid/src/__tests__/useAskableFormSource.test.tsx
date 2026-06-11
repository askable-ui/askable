import { describe, it, expect, afterEach } from 'vitest';
import { createAskableContext } from '@askable-ui/core';
import { useAskableFormSource } from '../useAskableFormSource.js';
import { renderHook } from '@solidjs/testing-library';

function setForm(html: string) {
  const form = document.createElement('form');
  form.id = 'test-form';
  form.innerHTML = html;
  document.body.appendChild(form);
  return form;
}

afterEach(() => {
  document.body.querySelectorAll('form').forEach((el) => el.remove());
});

describe('useAskableFormSource (SolidJS)', () => {
  it('registers a form source under the "form" id by default', () => {
    setForm('<input name="email" type="email" value="a@b.com" />');
    const ctx = createAskableContext();

    const { result, cleanup } = renderHook(() => useAskableFormSource({ ctx }));

    expect(ctx.hasSource('form')).toBe(true);
    expect(result.sourceId).toBe('form');

    cleanup();
    ctx.destroy();
  });

  it('accepts a custom id', () => {
    setForm('<input name="q" type="text" />');
    const ctx = createAskableContext();

    const { result, cleanup } = renderHook(() =>
      useAskableFormSource({ ctx, id: 'checkout' }),
    );

    expect(ctx.hasSource('checkout')).toBe(true);
    expect(result.sourceId).toBe('checkout');

    cleanup();
    ctx.destroy();
  });

  it('unregisters the source on cleanup', () => {
    setForm('<input name="x" type="text" />');
    const ctx = createAskableContext();

    const { cleanup } = renderHook(() => useAskableFormSource({ ctx }));

    expect(ctx.hasSource('form')).toBe(true);
    cleanup();
    expect(ctx.hasSource('form')).toBe(false);
    ctx.destroy();
  });

  it('respects the enabled flag', () => {
    setForm('<input name="x" type="text" />');
    const ctx = createAskableContext();

    const { cleanup } = renderHook(() =>
      useAskableFormSource({ ctx, enabled: false }),
    );

    expect(ctx.hasSource('form')).toBe(false);
    cleanup();
    ctx.destroy();
  });

  it('reads field values in all mode', async () => {
    setForm('<input name="username" type="text" value="alice" />');
    const ctx = createAskableContext();

    const { result, cleanup } = renderHook(() => useAskableFormSource({ ctx }));

    const resolved = await result.resolve({ mode: 'all' });
    const fields = (resolved.data as { fields: { name: string; value: string }[] }).fields;
    expect(fields[0]).toMatchObject({ name: 'username', value: 'alice' });

    cleanup();
    ctx.destroy();
  });

  it('masks passwords by default', async () => {
    setForm('<input name="pass" type="password" value="secret" />');
    const ctx = createAskableContext();

    const { result, cleanup } = renderHook(() => useAskableFormSource({ ctx }));

    const resolved = await result.resolve({ mode: 'all' });
    const fields = (resolved.data as { fields: { value: string }[] }).fields;
    expect(fields[0].value).toBe('***');

    cleanup();
    ctx.destroy();
  });

  it('uses a formRef accessor to locate the form', async () => {
    const form = setForm('<input name="city" type="text" value="Berlin" />');
    const ctx = createAskableContext();

    const { result, cleanup } = renderHook(() =>
      useAskableFormSource({ ctx, formRef: () => form }),
    );

    const resolved = await result.resolve({ mode: 'all' });
    const fields = (resolved.data as { fields: { name: string; value: string }[] }).fields;
    expect(fields[0]).toMatchObject({ name: 'city', value: 'Berlin' });

    cleanup();
    ctx.destroy();
  });
});
