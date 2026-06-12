import { createEffect, createSignal, onCleanup } from 'solid-js';
import { createAskablePerformanceSource, rateMetric } from '@askable-ui/core';
import type {
  AskableCreatePerformanceSourceOptions,
  AskablePerformanceMetric,
  AskablePerformanceSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskablePerformanceMetric, AskablePerformanceSourceSnapshot };

export interface UseAskablePerformanceSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreatePerformanceSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "performance". */
  id?: string;
  /** Automatically collect navigation timing on mount. @default true */
  autoCollect?: boolean;
}

export interface UseAskablePerformanceSourceResult extends UseAskableSourceResult {
  snapshot: () => AskablePerformanceSourceSnapshot | null;
  addMetric: (name: string, value: number, rating?: AskablePerformanceMetric['rating']) => void;
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
 * SolidJS primitive that collects Core Web Vitals and navigation timing and
 * exposes them to AI assistants so they can proactively warn about performance issues.
 *
 * @example
 * ```tsx
 * const { snapshot, addMetric } = useAskablePerformanceSource();
 * ```
 */
export function useAskablePerformanceSource(
  options: UseAskablePerformanceSourceOptions = {},
): UseAskablePerformanceSourceResult {
  const { id = 'performance', autoCollect = true, describe, kind, enabled, ctx, name, events } = options;

  const [snapshot, setSnapshot] = createSignal<AskablePerformanceSourceSnapshot | null>(null);
  const source = createAskablePerformanceSource({ describe, kind, getSnapshot: snapshot });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function addMetric(metricName: string, value: number, rating?: AskablePerformanceMetric['rating']): void {
    const r = rating ?? rateMetric(metricName, value);
    const entry: AskablePerformanceMetric = { name: metricName, value, rating: r, recordedAt: new Date().toISOString() };
    setSnapshot((prev) => {
      const metrics = [...(prev?.metrics ?? []).filter((m) => m.name !== metricName), entry];
      return {
        navigation: prev?.navigation ?? { loadTime: null, ttfb: null, domContentLoaded: null, dnsTime: null, connectTime: null },
        metrics,
        hasPoorMetrics: metrics.some((m) => m.rating === 'poor'),
        hasWarningMetrics: metrics.some((m) => m.rating === 'needs-improvement'),
        memory: prev?.memory ?? null,
      };
    });
    result.notifyChanged();
  }

  if (autoCollect) {
    createEffect(() => {
      const collect = () => {
        const nav = readNavigationTiming();
        const memory = readMemory();
        setSnapshot((prev) => {
          const metrics = prev?.metrics ?? [];
          return {
            navigation: nav,
            metrics,
            hasPoorMetrics: metrics.some((m) => m.rating === 'poor'),
            hasWarningMetrics: metrics.some((m) => m.rating === 'needs-improvement'),
            memory,
          };
        });
        result.notifyChanged();
      };

      if (document.readyState === 'complete') {
        collect();
      } else {
        window.addEventListener('load', collect, { once: true });
        onCleanup(() => window.removeEventListener('load', collect));
      }
    });
  }

  return { ...result, snapshot, addMetric };
}
