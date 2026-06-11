import { describe, expect, it, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import { createAskableContext } from '@askable-ui/core';
import { useAskableFormSource } from '../useAskableFormSource.js';
import { track } from './helpers.js';

async function flushAll() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

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

describe('useAskableFormSource (Vue)', () => {
  it('registers a form source under the "form" id by default', async () => {
    setForm('<input name="email" type="email" value="hi@test.com" />');
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() { useAskableFormSource({ ctx }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('form');
    expect(resolved.id).toBe('form');
    expect(resolved.kind).toBe('form');
    ctx.destroy();
  });

  it('accepts a custom id', async () => {
    setForm('<input name="q" type="text" />');
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() { useAskableFormSource({ ctx, id: 'search-form' }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('search-form');
    expect(resolved.id).toBe('search-form');
    ctx.destroy();
  });

  it('unregisters on unmount', async () => {
    setForm('<input name="x" type="text" />');
    const ctx = createAskableContext();

    const wrapper = track(mount(defineComponent({
      setup() { useAskableFormSource({ ctx }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();
    await expect(ctx.resolveSource('form')).resolves.toMatchObject({ id: 'form' });

    wrapper.unmount();
    await expect(ctx.resolveSource('form')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('respects the enabled flag', async () => {
    setForm('<input name="x" type="text" />');
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() { useAskableFormSource({ ctx, enabled: false }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();
    await expect(ctx.resolveSource('form')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('reads field values in all mode via selector', async () => {
    setForm('<input name="city" type="text" value="Paris" />');
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() { useAskableFormSource({ ctx, selector: '#test-form' }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('form', { mode: 'all' });
    const fields = (resolved.data as { fields: { name: string; value: string }[] }).fields;
    expect(fields[0]).toMatchObject({ name: 'city', value: 'Paris' });
    ctx.destroy();
  });

  it('uses a template ref to locate the form element', async () => {
    const ctx = createAskableContext();

    const Consumer = defineComponent({
      setup() {
        const formRef = ref<HTMLFormElement>();
        useAskableFormSource({ ctx, formRef });
        return { formRef };
      },
      template: `<form ref="formRef"><input name="role" type="text" value="admin" /></form>`,
    });

    track(mount(Consumer, { attachTo: document.body }));
    await flushAll();

    const resolved = await ctx.resolveSource('form', { mode: 'all' });
    const fields = (resolved.data as { fields: { name: string; value: string }[] }).fields;
    expect(fields[0]).toMatchObject({ name: 'role', value: 'admin' });
    ctx.destroy();
  });

  it('masks passwords by default', async () => {
    setForm('<input name="pass" type="password" value="secret" />');
    const ctx = createAskableContext();

    track(mount(defineComponent({
      setup() { useAskableFormSource({ ctx }); return {}; },
      template: '<div />',
    }), { attachTo: document.body }));

    await flushAll();

    const resolved = await ctx.resolveSource('form', { mode: 'all' });
    const fields = (resolved.data as { fields: { value: string }[] }).fields;
    expect(fields[0].value).toBe('***');
    ctx.destroy();
  });
});
