import { onMount } from 'svelte';
import { createAskablePerformanceSource, rateMetric } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreatePerformanceSourceOptions,
  AskablePerformanceMetric,
  AskablePerformanceSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskablePerformanceMetric, AskablePerformanceSourceSnapshot };

export interface UseAskablePerformanceSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreatePerformanceSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "performance". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** Automatically collect navigation timing on mount. @default true */
  autoCollect?: boolean;
}

export interface UseAskablePerformanceSource extends UseAskableSource {
  readonly snapshot: AskablePerformanceSourceSnapshot | null;
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
 * Svelte 5 runes-based composable that collects Core Web Vitals and navigation
 * timing and exposes them to AI assistants so they can warn about performance issues.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskablePerformanceSource } from '@askable-ui/svelte/useAskablePerformanceSource.svelte';
 *   const { snapshot, addMetric } = useAskablePerformanceSource();
 * </script>
 * ```
 */
export function useAskablePerformanceSource(
  options: UseAskablePerformanceSourceOptions = {},
): UseAskablePerformanceSource {
  const {
    id = 'performance',
    autoCollect = true,
    ctx,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  let snapshot = $state<AskablePerformanceSourceSnapshot | null>(null);

  const perfSource = createAskablePerformanceSource({ describe, kind, getSnapshot: () => snapshot });
  const result = useAskableSource(id, { ...perfSource, ...ctxOptions, ctx, observe, enabled });

  function addMetric(metricName: string, value: number, rating?: AskablePerformanceMetric['rating']): void {
    const r = rating ?? rateMetric(metricName, value);
    const entry: AskablePerformanceMetric = { name: metricName, value, rating: r, recordedAt: new Date().toISOString() };
    const metrics = [...(snapshot?.metrics ?? []).filter((m) => m.name !== metricName), entry];
    snapshot = {
      navigation: snapshot?.navigation ?? { loadTime: null, ttfb: null, domContentLoaded: null, dnsTime: null, connectTime: null },
      metrics,
      hasPoorMetrics: metrics.some((m) => m.rating === 'poor'),
      hasWarningMetrics: metrics.some((m) => m.rating === 'needs-improvement'),
      memory: snapshot?.memory ?? null,
    };
    result.notifyChanged();
  }

  if (autoCollect) {
    onMount(() => {
      const nav = readNavigationTiming();
      const memory = readMemory();
      const metrics = snapshot?.metrics ?? [];
      snapshot = {
        navigation: nav,
        metrics,
        hasPoorMetrics: metrics.some((m) => m.rating === 'poor'),
        hasWarningMetrics: metrics.some((m) => m.rating === 'needs-improvement'),
        memory,
      };
      result.notifyChanged();
    });
  }

  return { ...result, addMetric, get snapshot() { return snapshot; } };
}
