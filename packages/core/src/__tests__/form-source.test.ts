import { afterEach, describe, expect, it } from 'vitest';
import { createAskableContext, createAskableFormSource } from '../index.js';

function setForm(html: string) {
  document.body.innerHTML = `<form id="test-form">${html}</form>`;
  return document.querySelector<HTMLFormElement>('#test-form')!;
}

describe('createAskableFormSource', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('exposes state, summary, and all modes', () => {
    const form = setForm('<input name="email" type="email" />');
    const source = createAskableFormSource({ form });
    const ctx = createAskableContext();
    ctx.registerSource('form', source);
    expect(ctx.listSources()[0].modes).toEqual(['state', 'summary', 'all']);
    ctx.destroy();
  });

  it('resolves field names, types, and labels in summary mode', async () => {
    const form = setForm(`
      <label for="name">Full Name</label>
      <input id="name" name="name" type="text" required value="Alice" />
      <label for="email">Email</label>
      <input id="email" name="email" type="email" />
    `);
    const ctx = createAskableContext();
    ctx.registerSource('form', createAskableFormSource({ form }));

    const resolved = await ctx.resolveSource('form', { mode: 'summary' });
    expect(resolved.data).toMatchObject({
      fields: [
        { name: 'name', type: 'text', label: 'Full Name', required: true },
        { name: 'email', type: 'email', label: 'Email' },
      ],
      hasErrors: false,
      errorCount: 0,
    });
    ctx.destroy();
  });

  it('includes field values only in all mode', async () => {
    const form = setForm(`
      <input name="username" type="text" value="alice" />
      <input name="score" type="number" value="42" />
    `);
    const ctx = createAskableContext();
    ctx.registerSource('form', createAskableFormSource({ form }));

    const summary = await ctx.resolveSource('form', { mode: 'summary' });
    expect((summary.data as { fields: { value?: unknown }[] }).fields[0].value).toBeUndefined();

    const all = await ctx.resolveSource('form', { mode: 'all' });
    expect(all.data).toMatchObject({
      fields: [
        { name: 'username', value: 'alice' },
        { name: 'score', value: '42' },
      ],
    });
    ctx.destroy();
  });

  it('masks password fields by default', async () => {
    const form = setForm('<input name="password" type="password" value="s3cr3t" />');
    const ctx = createAskableContext();
    ctx.registerSource('form', createAskableFormSource({ form }));

    const resolved = await ctx.resolveSource('form', { mode: 'all' });
    expect((resolved.data as { fields: { value: string }[] }).fields[0].value).toBe('***');
    ctx.destroy();
  });

  it('does not mask passwords when maskPasswords is false', async () => {
    const form = setForm('<input name="password" type="password" value="s3cr3t" />');
    const ctx = createAskableContext();
    ctx.registerSource('form', createAskableFormSource({ form, maskPasswords: false }));

    const resolved = await ctx.resolveSource('form', { mode: 'all' });
    expect((resolved.data as { fields: { value: string }[] }).fields[0].value).toBe('s3cr3t');
    ctx.destroy();
  });

  it('omits fields in the omitFields list', async () => {
    const form = setForm(`
      <input name="email" type="email" value="x@y.com" />
      <input name="token" type="hidden" value="secret" />
    `);
    const ctx = createAskableContext();
    ctx.registerSource('form', createAskableFormSource({ form, omitFields: ['token'] }));

    const resolved = await ctx.resolveSource('form', { mode: 'all' });
    const fields = (resolved.data as { fields: { name: string }[] }).fields;
    expect(fields.map((f) => f.name)).toEqual(['email']);
    ctx.destroy();
  });

  it('reports validation errors from HTML5 constraint API', async () => {
    const form = setForm(`
      <input name="email" type="email" value="not-an-email" required />
    `);
    const emailEl = form.querySelector<HTMLInputElement>('input[name="email"]')!;
    // Trigger the HTML5 validation message
    emailEl.setCustomValidity('Please enter a valid email address');

    const ctx = createAskableContext();
    ctx.registerSource('form', createAskableFormSource({ form }));

    const resolved = await ctx.resolveSource('form', { mode: 'summary' });
    const data = resolved.data as { hasErrors: boolean; errorCount: number; errorFields: string[] };
    expect(data.hasErrors).toBe(true);
    expect(data.errorCount).toBe(1);
    expect(data.errorFields).toEqual(['email']);
    ctx.destroy();
  });

  it('reads checkbox checked state', async () => {
    const form = setForm('<input name="agree" type="checkbox" checked />');
    const ctx = createAskableContext();
    ctx.registerSource('form', createAskableFormSource({ form }));

    const resolved = await ctx.resolveSource('form', { mode: 'all' });
    expect((resolved.data as { fields: { value: boolean }[] }).fields[0].value).toBe(true);
    ctx.destroy();
  });

  it('reads multi-select values', async () => {
    const form = setForm(`
      <select name="colors" multiple>
        <option value="red" selected>Red</option>
        <option value="blue">Blue</option>
        <option value="green" selected>Green</option>
      </select>
    `);
    const ctx = createAskableContext();
    ctx.registerSource('form', createAskableFormSource({ form }));

    const resolved = await ctx.resolveSource('form', { mode: 'all' });
    expect((resolved.data as { fields: { value: string[] }[] }).fields[0].value).toEqual(['red', 'green']);
    ctx.destroy();
  });

  it('uses a CSS selector to locate the form', async () => {
    document.body.innerHTML = `
      <form id="checkout">
        <input name="card" type="text" value="4242" />
      </form>
    `;
    const ctx = createAskableContext();
    ctx.registerSource('form', createAskableFormSource({ form: '#checkout' }));

    const resolved = await ctx.resolveSource('form', { mode: 'all' });
    expect((resolved.data as { fields: { value: string }[] }).fields[0].value).toBe('4242');
    ctx.destroy();
  });

  it('applies sanitizeSnapshot to the resolved data', async () => {
    const form = setForm('<input name="name" type="text" value="Alice" />');
    const ctx = createAskableContext();
    ctx.registerSource(
      'form',
      createAskableFormSource({
        form,
        sanitizeSnapshot: (snap) => ({
          ...snap,
          fields: snap.fields.map((f) => ({ ...f, value: undefined })),
        }),
      }),
    );

    const resolved = await ctx.resolveSource('form', { mode: 'all' });
    expect((resolved.data as { fields: { value?: string }[] }).fields[0].value).toBeUndefined();
    ctx.destroy();
  });

  it('returns undefined state when no form is found', () => {
    document.body.innerHTML = '';
    const source = createAskableFormSource();
    expect(source.getState?.()).toBeUndefined();
  });

  it('returns state with fieldCount and hasErrors', () => {
    const form = setForm(`
      <input name="first" type="text" />
      <input name="last" type="text" />
    `);
    const source = createAskableFormSource({ form });
    const state = source.getState?.() as { fieldCount: number; hasErrors: boolean };
    expect(state.fieldCount).toBe(2);
    expect(state.hasErrors).toBe(false);
  });

  it('uses a function as the form resolver', async () => {
    const form = setForm('<input name="code" type="text" value="ABC" />');
    const ctx = createAskableContext();
    ctx.registerSource('form', createAskableFormSource({ form: () => form }));

    const resolved = await ctx.resolveSource('form', { mode: 'all' });
    expect((resolved.data as { fields: { value: string }[] }).fields[0].value).toBe('ABC');
    ctx.destroy();
  });
});
