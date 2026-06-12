import { TestBed } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { AskableFormSourceService } from '../askable-form-source.service.js';

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

describe('AskableFormSourceService', () => {
  let service: AskableFormSourceService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AskableFormSourceService] });
    service = TestBed.inject(AskableFormSourceService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('starts in unregistered state', () => {
    expect(service.isRegistered()).toBe(false);
  });

  it('registers under "form" id by default', async () => {
    setForm('<input name="email" type="email" value="a@b.com" />');
    service.init();

    expect(service.isRegistered()).toBe(true);
    expect(service.sourceId).toBe('form');

    const resolved = await service.resolve();
    expect(resolved.id).toBe('form');
    expect(resolved.kind).toBe('form');
  });

  it('accepts a custom id', async () => {
    setForm('<input name="q" type="text" />');
    service.init({ id: 'search-form' });

    expect(service.sourceId).toBe('search-form');
    const resolved = await service.resolve();
    expect(resolved.id).toBe('search-form');
  });

  it('reads field values in all mode', async () => {
    setForm('<input name="username" type="text" value="alice" />');
    service.init();

    const resolved = await service.resolve({ mode: 'all' });
    const fields = (resolved.data as { fields: { name: string; value: string }[] }).fields;
    expect(fields[0]).toMatchObject({ name: 'username', value: 'alice' });
  });

  it('uses an ElementRef to locate the form', async () => {
    const form = setForm('<input name="city" type="text" value="Tokyo" />');
    const formRef = new ElementRef<HTMLFormElement>(form);
    service.init({ formRef });

    const resolved = await service.resolve({ mode: 'all' });
    const fields = (resolved.data as { fields: { name: string; value: string }[] }).fields;
    expect(fields[0]).toMatchObject({ name: 'city', value: 'Tokyo' });
  });

  it('masks passwords by default', async () => {
    setForm('<input name="pass" type="password" value="secret" />');
    service.init();

    const resolved = await service.resolve({ mode: 'all' });
    const fields = (resolved.data as { fields: { value: string }[] }).fields;
    expect(fields[0].value).toBe('***');
  });

  it('omits fields in omitFields', async () => {
    setForm(`
      <input name="email" type="email" value="a@b.com" />
      <input name="token" type="hidden" value="secret-token" />
    `);
    service.init({ omitFields: ['token'] });

    const resolved = await service.resolve({ mode: 'all' });
    const fields = (resolved.data as { fields: { name: string }[] }).fields;
    expect(fields.map((f) => f.name)).toEqual(['email']);
  });

  it('unregisters on unregister()', () => {
    setForm('<input name="x" type="text" />');
    service.init();
    expect(service.isRegistered()).toBe(true);

    service.unregister();
    expect(service.isRegistered()).toBe(false);
  });

  it('re-registers when init() is called a second time', async () => {
    setForm('<input name="a" type="text" value="first" />');
    service.init();
    expect(service.isRegistered()).toBe(true);

    service.init({ id: 'new-form' });
    expect(service.sourceId).toBe('new-form');
    expect(service.isRegistered()).toBe(true);
  });
});
