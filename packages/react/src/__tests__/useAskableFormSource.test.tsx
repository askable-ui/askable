import { useRef } from 'react';
import { render, waitFor } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableFormSource } from '../useAskableFormSource.js';

function setForm(html: string) {
  const form = document.createElement('form');
  form.id = 'test-form';
  form.innerHTML = html;
  document.body.appendChild(form);
  return form;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useAskableFormSource', () => {
  it('registers a form source under the "form" id by default', async () => {
    setForm('<input name="email" type="email" value="hi@example.com" />');
    const ctx = createAskableContext();

    function Consumer() {
      useAskableFormSource({ ctx });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('form');
      expect(resolved.id).toBe('form');
      expect(resolved.kind).toBe('form');
    });

    ctx.destroy();
  });

  it('accepts a custom id', async () => {
    setForm('<input name="q" type="text" />');
    const ctx = createAskableContext();

    function Consumer() {
      useAskableFormSource({ ctx, id: 'search-form' });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('search-form');
      expect(resolved.id).toBe('search-form');
    });

    ctx.destroy();
  });

  it('unregisters the source on unmount', async () => {
    setForm('<input name="x" type="text" />');
    const ctx = createAskableContext();

    function Consumer() {
      useAskableFormSource({ ctx });
      return null;
    }

    const view = render(<Consumer />);

    await waitFor(async () => {
      await expect(ctx.resolveSource('form')).resolves.toMatchObject({ id: 'form' });
    });

    view.unmount();

    await expect(ctx.resolveSource('form')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('respects the enabled flag', async () => {
    setForm('<input name="x" type="text" />');
    const ctx = createAskableContext();

    function Consumer() {
      useAskableFormSource({ ctx, enabled: false });
      return null;
    }

    render(<Consumer />);

    await expect(ctx.resolveSource('form')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('reads field values in all mode', async () => {
    setForm(`<input name="username" type="text" value="alice" />`);
    const ctx = createAskableContext();

    function Consumer() {
      useAskableFormSource({ ctx });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('form', { mode: 'all' });
      const fields = (resolved.data as { fields: { name: string; value: string }[] }).fields;
      expect(fields[0]).toMatchObject({ name: 'username', value: 'alice' });
    });

    ctx.destroy();
  });

  it('uses a ref to locate the form element', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      const ref = useRef<HTMLFormElement>(null);
      useAskableFormSource({ ctx, ref });
      return (
        <form ref={ref}>
          <input name="city" type="text" defaultValue="London" />
        </form>
      );
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('form', { mode: 'all' });
      const fields = (resolved.data as { fields: { name: string; value: string }[] }).fields;
      expect(fields[0]).toMatchObject({ name: 'city', value: 'London' });
    });

    ctx.destroy();
  });

  it('omits password values by default', async () => {
    setForm('<input name="pass" type="password" value="secret" />');
    const ctx = createAskableContext();

    function Consumer() {
      useAskableFormSource({ ctx });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('form', { mode: 'all' });
      const fields = (resolved.data as { fields: { value: string }[] }).fields;
      expect(fields[0].value).toBe('***');
    });

    ctx.destroy();
  });

  it('omits fields listed in omitFields', async () => {
    setForm(`
      <input name="email" type="email" value="a@b.com" />
      <input name="csrf" type="hidden" value="tok" />
    `);
    const ctx = createAskableContext();

    function Consumer() {
      useAskableFormSource({ ctx, omitFields: ['csrf'] });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('form', { mode: 'all' });
      const fields = (resolved.data as { fields: { name: string }[] }).fields;
      expect(fields.map((f) => f.name)).toEqual(['email']);
    });

    ctx.destroy();
  });
});
