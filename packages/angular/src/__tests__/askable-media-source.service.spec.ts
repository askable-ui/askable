import { TestBed } from '@angular/core/testing';
import { AskableMediaSourceService } from '../askable-media-source.service.js';

function makeMockMedia(overrides: Partial<HTMLMediaElement> = {}): HTMLMediaElement {
  return {
    currentTime: 60,
    duration: 300,
    paused: false,
    ended: false,
    muted: false,
    volume: 1,
    playbackRate: 1,
    readyState: 4,
    title: '',
    src: 'https://example.com/audio/podcast.mp3',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as HTMLMediaElement;
}

describe('AskableMediaSourceService', () => {
  let service: AskableMediaSourceService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AskableMediaSourceService] });
    service = TestBed.inject(AskableMediaSourceService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('starts in unregistered state', () => {
    expect(service.isRegistered()).toBe(false);
  });

  it('registers under "media" id by default', async () => {
    const el = makeMockMedia();
    service.init({ getMedia: () => el });

    expect(service.isRegistered()).toBe(true);
    expect(service.sourceId).toBe('media');

    const resolved = await service.resolve();
    expect(resolved.id).toBe('media');
    expect(resolved.kind).toBe('media');
  });

  it('accepts a custom id', async () => {
    const el = makeMockMedia();
    service.init({ id: 'podcast-player', getMedia: () => el });

    expect(service.sourceId).toBe('podcast-player');
    const resolved = await service.resolve();
    expect(resolved.id).toBe('podcast-player');
  });

  it('returns snapshot data from media element', async () => {
    const el = makeMockMedia({ currentTime: 60, duration: 300 });
    service.init({ getMedia: () => el });

    const resolved = await service.resolve();
    const data = resolved.data as { currentTime: number; progressPercent: number };
    expect(data.currentTime).toBe(60);
    expect(data.progressPercent).toBe(20);
  });

  it('returns null data when media element is unavailable', async () => {
    service.init({ getMedia: () => null });

    const resolved = await service.resolve();
    expect(resolved.data).toBeNull();
  });

  it('attachListeners() registers media event listeners', () => {
    const el = makeMockMedia();
    service.init({ getMedia: () => el });
    service.attachListeners(el);

    expect(el.addEventListener).toHaveBeenCalled();
  });

  it('unregisters on unregister()', () => {
    service.init({ getMedia: () => makeMockMedia() });
    expect(service.isRegistered()).toBe(true);

    service.unregister();
    expect(service.isRegistered()).toBe(false);
  });

  it('re-registers when init() is called a second time', () => {
    service.init({ getMedia: () => makeMockMedia() });
    service.init({ id: 'audio', getMedia: () => makeMockMedia() });

    expect(service.sourceId).toBe('audio');
    expect(service.isRegistered()).toBe(true);
  });
});
