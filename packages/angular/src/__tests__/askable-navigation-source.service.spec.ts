import { TestBed } from '@angular/core/testing';
import { AskableNavigationSourceService } from '../askable-navigation-source.service.js';

describe('AskableNavigationSourceService', () => {
  let service: AskableNavigationSourceService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AskableNavigationSourceService] });
    service = TestBed.inject(AskableNavigationSourceService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('starts in unregistered state', () => {
    expect(service.isRegistered()).toBe(false);
  });

  it('registers under "navigation" id by default', async () => {
    service.init();

    expect(service.isRegistered()).toBe(true);
    expect(service.sourceId).toBe('navigation');

    const resolved = await service.resolve();
    expect(resolved.id).toBe('navigation');
    expect(resolved.kind).toBe('navigation');
  });

  it('accepts a custom id', async () => {
    service.init({ id: 'router' });

    expect(service.sourceId).toBe('router');
    const resolved = await service.resolve();
    expect(resolved.id).toBe('router');
  });

  it('returns path from getPath callback', async () => {
    service.init({ getPath: () => '/dashboard?tab=stats', getTitle: () => 'Dashboard' });

    const resolved = await service.resolve();
    const data = resolved.data as { currentPath: string; currentTitle: string; query: Record<string, string> };
    expect(data.currentPath).toBe('/dashboard?tab=stats');
    expect(data.currentTitle).toBe('Dashboard');
    expect(data.query.tab).toBe('stats');
  });

  it('returns route params from getParams callback', async () => {
    service.init({
      getPath: () => '/users/42',
      getParams: () => ({ userId: '42' }),
    });

    const resolved = await service.resolve();
    const data = resolved.data as { params: Record<string, string> };
    expect(data.params).toEqual({ userId: '42' });
  });

  it('accumulates navigation history across notifyChanged calls', async () => {
    let currentPath = '/home';
    service.init({ getPath: () => currentPath });

    await service.resolve();

    currentPath = '/about';
    service.notifyChanged();
    await service.resolve();

    currentPath = '/contact';
    service.notifyChanged();
    const resolved = await service.resolve();
    const data = resolved.data as { history: { path: string }[] };
    expect(data.history).toHaveLength(3);
    expect(data.history[0].path).toBe('/contact');
  });

  it('unregisters on unregister()', () => {
    service.init();
    expect(service.isRegistered()).toBe(true);

    service.unregister();
    expect(service.isRegistered()).toBe(false);
  });

  it('re-registers when init() is called a second time', () => {
    service.init();
    service.init({ id: 'app-router' });

    expect(service.sourceId).toBe('app-router');
    expect(service.isRegistered()).toBe(true);
  });
});
