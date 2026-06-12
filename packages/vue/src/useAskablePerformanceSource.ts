import { ref, onMounted, type MaybeRef } from 'vue';
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
  autoCollect?: MaybeRef<boolean>;
  enabled?: MaybeRef<boolean>;
}

export interface UseAskablePerformanceSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof ref<AskablePerformanceSourceSnapshot | null>>;
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
 * Vue composable that collects Core Web Vitals and navigation timing and exposes
 * them to AI assistants so they can proactively warn about performance issues.
 *
 * @example
 * ```ts
 * const { snapshot, addMetric } = useAskablePerformanceSource();
 * // From web-vitals: onLCP(({ name, value, rating }) => addMetric(name, value, rating));
 * ```
 */
export function useAskablePerformanceSource(
  options: UseAskablePerformanceSourceOptions = {},
): UseAskablePerformanceSourceResult {
  const { id = 'performance', autoCollect = true, describe, kind, enabled, ctx, name, events } = options;

  const snapshot = ref<AskablePerformanceSourceSnapshot | null>(null);
  const source = createAskablePerformanceSource({ describe, kind, getSnapshot: () => snapshot.value });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function addMetric(metricName: string, value: number, rating?: AskablePerformanceMetric['rating']): void {
    const r = rating ?? rateMetric(metricName, value);
    const entry: AskablePerformanceMetric = { name: metricName, value, rating: r, recordedAt: new Date().toISOString() };
    const existing = snapshot.value?.metrics ?? [];
    const metrics = [...existing.filter((m) => m.name !== metricName), entry];
    snapshot.value = {
      navigation: snapshot.value?.navigation ?? { loadTime: null, ttfb: null, domContentLoaded: null, dnsTime: null, connectTime: null },
      metrics,
      hasPoorMetrics: metrics.some((m) => m.rating === 'poor'),
      hasWarningMetrics: metrics.some((m) => m.rating === 'needs-improvement'),
      memory: snapshot.value?.memory ?? null,
    };
    result.notifyChanged();
  }

  onMounted(() => {
    if (!autoCollect) return;
    const nav = readNavigationTiming();
    const memory = readMemory();
    const metrics = snapshot.value?.metrics ?? [];
    snapshot.value = {
      navigation: nav,
      metrics,
      hasPoorMetrics: metrics.some((m) => m.rating === 'poor'),
      hasWarningMetrics: metrics.some((m) => m.rating === 'needs-improvement'),
      memory,
    };
    result.notifyChanged();
  });

  return { ...result, snapshot, addMetric };
}
