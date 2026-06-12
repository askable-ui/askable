import { TestBed } from '@angular/core/testing';
import { AskableErrorSourceService } from '../askable-error-source.service.js';
import type { AskableErrorEntry } from '../askable-error-source.service.js';

describe('AskableErrorSourceService', () => {
  let service: AskableErrorSourceService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AskableErrorSourceService] });
    service = TestBed.inject(AskableErrorSourceService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('starts in unregistered state', () => {
    expect(service.isRegistered()).toBe(false);
  });

  it('registers under "errors" id by default', async () => {
    service.init();

    expect(service.isRegistered()).toBe(true);
    expect(service.sourceId).toBe('errors');

    const resolved = await service.resolve();
    expect(resolved.id).toBe('errors');
    expect(resolved.kind).toBe('errors');
  });

  it('accepts a custom id', async () => {
    service.init({ id: 'form-errors' });

    expect(service.sourceId).toBe('form-errors');
    const resolved = await service.resolve();
    expect(resolved.id).toBe('form-errors');
  });

  it('returns errors from getErrors callback', async () => {
    const errors: AskableErrorEntry[] = [
      { key: 'email', message: 'Invalid email' },
      { key: 'password', message: 'Too short' },
    ];
    service.init({ getErrors: () => errors });

    const resolved = await service.resolve();
    const data = resolved.data as { errors: AskableErrorEntry[]; total: number };
    expect(data.total).toBe(2);
    expect(data.errors[0].key).toBe('email');
  });

  it('returns zero errors by default', async () => {
    service.init();

    const resolved = await service.resolve();
    const data = resolved.data as { total: number; hasErrors: boolean };
    expect(data.total).toBe(0);
    expect(data.hasErrors).toBe(false);
  });

  it('notifyChanged() triggers re-resolution', async () => {
    let errors: AskableErrorEntry[] = [];
    service.init({ getErrors: () => errors });

    const before = await service.resolve();
    expect((before.data as { total: number }).total).toBe(0);

    errors = [{ key: 'name', message: 'Required' }];
    service.notifyChanged();

    const after = await service.resolve();
    expect((after.data as { total: number }).total).toBe(1);
  });

  it('unregisters on unregister()', () => {
    service.init();
    expect(service.isRegistered()).toBe(true);

    service.unregister();
    expect(service.isRegistered()).toBe(false);
  });

  it('re-registers when init() is called a second time', () => {
    service.init();
    service.init({ id: 'validation-errors' });

    expect(service.sourceId).toBe('validation-errors');
    expect(service.isRegistered()).toBe(true);
  });
});
