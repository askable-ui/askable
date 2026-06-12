import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskablePerformanceSource, rateMetric } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreatePerformanceSourceOptions,
  AskablePerformanceMetric,
  AskablePerformanceSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskablePerformanceMetric, AskablePerformanceSourceSnapshot };

export interface AskablePerformanceSourceServiceOptions
  extends Omit<AskableCreatePerformanceSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "performance". */
  id?: string;
  /**
   * Automatically collect navigation timing on init.
   * @default true
   */
  autoCollect?: boolean;
}

function readNavigationTiming(): AskablePerformanceSourceSnapshot['navigation'] {
  if (typeof performance === 'undefined') {
    return { loadTime: null, ttfb: null, domContentLoaded: null, dnsTime: null, connectTime: null };
  }
  const entries = performance.getEntriesByType?.('navigation') as PerformanceNavigationTiming[] | undefined;
  const nav = entries?.[0];
  if (!nav) {
    return { loadTime: null, ttfb: null, domContentLoaded: null, dnsTime: null, connectTime: null };
  }
  return {
    loadTime: Math.round(nav.loadEventEnd - nav.startTime),
    ttfb: Math.round(nav.responseStart - nav.requestStart),
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
    dnsTime: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
    connectTime: Math.round(nav.connectEnd - nav.connectStart),
  };
}

function readMemory(): AskablePerformanceSourceSnapshot['memory'] {
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (!mem) return null;
  return {
    usedMB: Math.round(mem.usedJSHeapSize / 1024 / 1024),
    totalMB: Math.round(mem.totalJSHeapSize / 1024 / 1024),
    limitMB: Math.round(mem.jsHeapSizeLimit / 1024 / 1024),
  };
}

/**
 * Angular service that collects Core Web Vitals and navigation timing and exposes
 * them to AI assistants so they can proactively warn about performance issues.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskablePerformanceSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly perfSource = inject(AskablePerformanceSourceService);
 *   ngOnInit() { this.perfSource.init(); }
 *   // From web-vitals library:
 *   // onLCP(({ name, value, rating }) => this.perfSource.addMetric(name, value, rating));
 * }
 * ```
 */
@Injectable()
export class AskablePerformanceSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'performance';
  private _snapshot: AskablePerformanceSourceSnapshot | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }
  get snapshot(): AskablePerformanceSourceSnapshot | null { return this._snapshot; }

  init(options: AskablePerformanceSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'performance', autoCollect = true, describe, kind } = options;
    this._sourceId = id;

    const source = createAskablePerformanceSource({ describe, kind, getSnapshot: () => this._snapshot });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    if (autoCollect) {
      const collect = () => {
        const nav = readNavigationTiming();
        const memory = readMemory();
        const metrics = this._snapshot?.metrics ?? [];
        this._snapshot = {
          navigation: nav,
          metrics,
          hasPoorMetrics: metrics.some((m) => m.rating === 'poor'),
          hasWarningMetrics: metrics.some((m) => m.rating === 'needs-improvement'),
          memory,
        };
        this.notifyChanged();
      };

      if (typeof document !== 'undefined' && document.readyState === 'complete') {
        collect();
      } else if (typeof window !== 'undefined') {
        window.addEventListener('load', collect, { once: true });
      }
    }
  }

  addMetric(metricName: string, value: number, rating?: AskablePerformanceMetric['rating']): void {
    const r = rating ?? rateMetric(metricName, value);
    const entry: AskablePerformanceMetric = { name: metricName, value, rating: r, recordedAt: new Date().toISOString() };
    const metrics = [...(this._snapshot?.metrics ?? []).filter((m) => m.name !== metricName), entry];
    this._snapshot = {
      navigation: this._snapshot?.navigation ?? { loadTime: null, ttfb: null, domContentLoaded: null, dnsTime: null, connectTime: null },
      metrics,
      hasPoorMetrics: metrics.some((m) => m.rating === 'poor'),
      hasWarningMetrics: metrics.some((m) => m.rating === 'needs-improvement'),
      memory: this._snapshot?.memory ?? null,
    };
    this.notifyChanged();
  }

  resolve(request?: { mode?: string }): Promise<AskableResolvedContextSource> {
    return this.ctx.resolveSource(this._sourceId, request);
  }

  async toPromptContext(options?: { mode?: string; maxTokens?: number }): Promise<string> {
    return this.ctx.toPromptContextAsync({ sources: [{ id: this._sourceId, ...options }] });
  }

  notifyChanged(): void { this.handle?.notifyChanged(); }

  unregister(): void {
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void { this.unregister(); }
}
