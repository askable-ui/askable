import { TestBed } from '@angular/core/testing';
import { AskableUserSourceService } from '../askable-user-source.service.js';
import type { AskableUserProfile } from '../askable-user-source.service.js';

const ALICE: AskableUserProfile = {
  name: 'Alice',
  email: 'alice@example.com',
  role: 'admin',
  plan: 'pro',
};

describe('AskableUserSourceService', () => {
  let service: AskableUserSourceService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AskableUserSourceService] });
    service = TestBed.inject(AskableUserSourceService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('starts in unregistered state', () => {
    expect(service.isRegistered()).toBe(false);
  });

  it('registers under "user" id by default', async () => {
    service.init({ getUser: () => ALICE });

    expect(service.isRegistered()).toBe(true);
    expect(service.sourceId).toBe('user');

    const resolved = await service.resolve();
    expect(resolved.id).toBe('user');
    expect(resolved.kind).toBe('user');
  });

  it('accepts a custom id', async () => {
    service.init({ id: 'current-user', getUser: () => ALICE });

    expect(service.sourceId).toBe('current-user');
    const resolved = await service.resolve();
    expect(resolved.id).toBe('current-user');
  });

  it('returns user profile data', async () => {
    service.init({ getUser: () => ALICE });

    const resolved = await service.resolve();
    const data = resolved.data as AskableUserProfile;
    expect(data.name).toBe('Alice');
    expect(data.role).toBe('admin');
  });

  it('returns authenticated: false when getUser returns null', async () => {
    service.init({ getUser: () => null });

    const resolved = await service.resolve();
    const state = resolved.state as { authenticated: boolean };
    expect(state.authenticated).toBe(false);
  });

  it('omits fields listed in omitFields', async () => {
    service.init({ getUser: () => ALICE, omitFields: ['email'] });

    const resolved = await service.resolve();
    const data = resolved.data as Record<string, unknown>;
    expect(data.email).toBeUndefined();
    expect(data.name).toBe('Alice');
  });

  it('notifyChanged() triggers re-resolution', async () => {
    let currentUser: AskableUserProfile | null = null;
    service.init({ getUser: () => currentUser });

    const before = await service.resolve();
    expect((before.state as { authenticated: boolean }).authenticated).toBe(false);

    currentUser = ALICE;
    service.notifyChanged();

    const after = await service.resolve();
    expect((after.state as { authenticated: boolean }).authenticated).toBe(true);
  });

  it('unregisters on unregister()', () => {
    service.init({ getUser: () => ALICE });
    expect(service.isRegistered()).toBe(true);

    service.unregister();
    expect(service.isRegistered()).toBe(false);
  });

  it('re-registers when init() is called a second time', () => {
    service.init({ getUser: () => ALICE });
    service.init({ id: 'viewer', getUser: () => null });

    expect(service.sourceId).toBe('viewer');
    expect(service.isRegistered()).toBe(true);
  });
});
