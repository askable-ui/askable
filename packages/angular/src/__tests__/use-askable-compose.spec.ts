import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { useAskableCompose } from '../use-askable-compose.js';
import type { AskableContextSection } from '../use-askable-compose.js';

describe('useAskableCompose', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('joins non-empty sections with labels', () => {
    const sections = signal<AskableContextSection[]>([
      { label: 'Focus', value: 'Revenue card' },
      { label: 'Viewport', value: 'KPI grid' },
    ]);
    const { promptContext } = TestBed.runInInjectionContext(() => useAskableCompose(sections));
    expect(promptContext()).toBe('Focus:\nRevenue card\n\nViewport:\nKPI grid');
  });

  it('omits null/empty sections', () => {
    const sections = signal<AskableContextSection[]>([
      { label: 'Focus', value: null },
      { label: 'Viewport', value: '  ' },
      { label: 'History', value: 'Page A' },
    ]);
    const { promptContext } = TestBed.runInInjectionContext(() => useAskableCompose(sections));
    expect(promptContext()).toBe('History:\nPage A');
  });

  it('returns emptyFallback when all sections are empty', () => {
    const sections = signal<AskableContextSection[]>([
      { label: 'Focus', value: null },
    ]);
    const { promptContext } = TestBed.runInInjectionContext(() =>
      useAskableCompose(sections, { emptyFallback: 'Nothing selected.' }),
    );
    expect(promptContext()).toBe('Nothing selected.');
  });

  it('uses custom separator', () => {
    const sections = signal<AskableContextSection[]>([
      { label: 'A', value: 'x' },
      { label: 'B', value: 'y' },
    ]);
    const { promptContext } = TestBed.runInInjectionContext(() =>
      useAskableCompose(sections, { separator: '\n---\n' }),
    );
    expect(promptContext()).toBe('A:\nx\n---\nB:\ny');
  });

  it('reacts to signal updates', () => {
    const sections = signal<AskableContextSection[]>([
      { label: 'Focus', value: 'Revenue' },
    ]);
    const { promptContext } = TestBed.runInInjectionContext(() => useAskableCompose(sections));
    expect(promptContext()).toContain('Revenue');
    sections.set([{ label: 'Focus', value: 'Deals table' }]);
    expect(promptContext()).toContain('Deals table');
  });
});
