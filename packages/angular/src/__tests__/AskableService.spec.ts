import { describe, it, expect, afterEach } from 'vitest';
import { AskableService } from '../AskableService.js';

// AskableService can be instantiated directly (without Angular DI / TestBed)
// because Angular signals are plain JS primitives and decorators are just metadata.

describe('AskableService', () => {
  const instances: AskableService[] = [];

  function makeService(options?: ConstructorParameters<typeof AskableService>[0]): AskableService {
    const svc = new AskableService(options);
    instances.push(svc);
    return svc;
  }

  afterEach(() => {
    instances.forEach((svc) => svc.ngOnDestroy());
    instances.length = 0;
  });

  it('focus signal is null initially', () => {
    const svc = makeService();
    expect(svc.focus()).toBeNull();
  });

  it('promptContext signal returns no-focus string initially', () => {
    const svc = makeService();
    expect(svc.promptContext()).toBe('No UI element is currently focused.');
  });

  it('focus signal updates when ctx.select() is called', () => {
    const svc = makeService();
    const el = document.createElement('div');
    el.setAttribute('data-askable', JSON.stringify({ metric: 'revenue' }));
    el.textContent = 'Revenue';
    document.body.appendChild(el);

    svc.ctx.select(el);

    expect(svc.focus()).not.toBeNull();
    expect((svc.focus()!.meta as Record<string, unknown>).metric).toBe('revenue');

    el.remove();
  });

  it('promptContext signal updates after focus changes', () => {
    const svc = makeService();
    const el = document.createElement('div');
    el.setAttribute('data-askable', JSON.stringify({ widget: 'chart' }));
    el.textContent = 'Chart';
    document.body.appendChild(el);

    expect(svc.promptContext()).toBe('No UI element is currently focused.');

    svc.ctx.select(el);
    expect(svc.promptContext()).toContain('widget');
    expect(svc.promptContext()).toContain('chart');

    el.remove();
  });

  it('focus signal resets to null after ctx.clear()', () => {
    const svc = makeService();
    const el = document.createElement('div');
    el.setAttribute('data-askable', '{}');
    document.body.appendChild(el);

    svc.ctx.select(el);
    expect(svc.focus()).not.toBeNull();

    svc.ctx.clear();
    expect(svc.focus()).toBeNull();

    el.remove();
  });

  it('ctx getter returns the underlying AskableContext', () => {
    const svc = makeService();
    expect(typeof svc.ctx.getFocus).toBe('function');
    expect(typeof svc.ctx.observe).toBe('function');
  });

  it('toPromptContext() delegates to the underlying context', () => {
    const svc = makeService();
    const result = svc.toPromptContext();
    expect(typeof result).toBe('string');
    expect(result).toBe('No UI element is currently focused.');
  });

  it('unobserve() and re-observe() work without throwing', () => {
    const svc = makeService();
    expect(() => svc.unobserve()).not.toThrow();
    expect(() => svc.observe(document)).not.toThrow();
  });

  it('ngOnDestroy() cleans up without throwing', () => {
    const svc = new AskableService(); // not tracked — we call destroy manually
    expect(() => svc.ngOnDestroy()).not.toThrow();
  });

  it('accepts textExtractor option', () => {
    const svc = makeService({
      textExtractor: (el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
    });
    const el = document.createElement('button');
    el.setAttribute('data-askable', '{}');
    el.setAttribute('aria-label', 'Open menu');
    el.textContent = 'ignored';
    document.body.appendChild(el);

    svc.ctx.select(el);
    expect(svc.focus()?.text).toBe('Open menu');

    el.remove();
  });
});
