import { TestBed } from '@angular/core/testing';
import { AskableHistoryService } from '../askable-history.service.js';
import type { AskableFocus } from '@askable-ui/core';

function makeFocus(text: string, meta?: Record<string, unknown>): AskableFocus {
  return { text, meta: meta ?? {}, source: 'push', timestamp: Date.now() } as AskableFocus;
}

describe('AskableHistoryService', () => {
  let service: AskableHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AskableHistoryService] });
    service = TestBed.inject(AskableHistoryService);
  });

  it('starts empty', () => {
    expect(service.history()).toHaveLength(0);
    expect(service.current()).toBeNull();
  });

  it('push() adds entries most-recent first', () => {
    service.push(makeFocus('Page A'));
    service.push(makeFocus('Page B'));
    expect(service.history()[0].text).toBe('Page B');
    expect(service.history()[1].text).toBe('Page A');
  });

  it('deduplicates consecutive identical text by default', () => {
    service.push(makeFocus('Page A'));
    service.push(makeFocus('Page A'));
    expect(service.history()).toHaveLength(1);
  });

  it('respects maxEntries cap via init()', () => {
    const mockCtx = { on: () => {}, off: () => {} } as any;
    service.init(mockCtx, { maxEntries: 3 });
    for (let i = 0; i < 5; i++) service.push(makeFocus(`Page ${i}`));
    expect(service.history()).toHaveLength(3);
  });

  it('clear() empties history', () => {
    service.push(makeFocus('Page A'));
    service.clear();
    expect(service.history()).toHaveLength(0);
  });

  it('promptContext formats entries', () => {
    service.push(makeFocus('KPI card'));
    expect(service.promptContext()).toContain('KPI card');
    expect(service.promptContext()).toContain('most recent first');
  });

  it('promptContext shows fallback when empty', () => {
    expect(service.promptContext()).toBe('No navigation history.');
  });
});
