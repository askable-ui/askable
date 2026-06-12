import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export interface AskablePerformanceMetric {
  /** Metric name (e.g. "LCP", "FID", "CLS", "TTFB", "FCP"). */
  name: string;
  /** Metric value. Unit depends on the metric (ms for timing, unitless for CLS). */
  value: number;
  /** Performance rating: "good", "needs-improvement", or "poor". */
  rating: 'good' | 'needs-improvement' | 'poor';
  /** ISO timestamp when the metric was recorded. */
  recordedAt: string;
}

export interface AskablePerformanceSourceSnapshot {
  /** Navigation timing metrics (page load). */
  navigation: {
    /** Total page load time in ms (loadEventEnd - startTime). */
    loadTime: number | null;
    /** Time to first byte in ms (responseStart - requestStart). */
    ttfb: number | null;
    /** DOM content loaded time in ms. */
    domContentLoaded: number | null;
    /** DNS lookup time in ms. */
    dnsTime: number | null;
    /** Connection time in ms. */
    connectTime: number | null;
  };
  /** Core Web Vitals and custom metrics supplied via `addMetric`. */
  metrics: AskablePerformanceMetric[];
  /** Whether any metric is rated "poor". */
  hasPoorMetrics: boolean;
  /** Whether any metric is rated "needs-improvement". */
  hasWarningMetrics: boolean;
  /** Memory usage info (Chrome only). */
  memory: {
    /** Used JS heap size in MB. */
    usedMB: number | null;
    /** Total allocated JS heap size in MB. */
    totalMB: number | null;
    /** JS heap size limit in MB. */
    limitMB: number | null;
  } | null;
}

export interface AskableCreatePerformanceSourceOptions {
  /**
   * Returns the current performance snapshot. Called on each resolve.
   * Framework hooks manage metric collection; this getter reads the result.
   */
  getSnapshot: () => AskablePerformanceSourceSnapshot | null;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskablePerformanceSourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "performance". */
  kind?: string;
}

function rateMs(value: number, goodThreshold: number, poorThreshold: number): AskablePerformanceMetric['rating'] {
  if (value <= goodThreshold) return 'good';
  if (value <= poorThreshold) return 'needs-improvement';
  return 'poor';
}

export function rateMetric(name: string, value: number): AskablePerformanceMetric['rating'] {
  const upper = name.toUpperCase();
  if (upper === 'LCP') return rateMs(value, 2500, 4000);
  if (upper === 'FID' || upper === 'INP') return rateMs(value, 100, 300);
  if (upper === 'TTFB') return rateMs(value, 800, 1800);
  if (upper === 'FCP') return rateMs(value, 1800, 3000);
  if (upper === 'CLS') {
    if (value <= 0.1) return 'good';
    if (value <= 0.25) return 'needs-improvement';
    return 'poor';
  }
  return 'good';
}

function defaultDescribe(snap: AskablePerformanceSourceSnapshot): string {
  const parts: string[] = [];

  if (snap.navigation.loadTime != null) {
    parts.push(`Page load: ${snap.navigation.loadTime}ms`);
  }
  if (snap.navigation.ttfb != null) {
    parts.push(`TTFB: ${snap.navigation.ttfb}ms`);
  }

  const poor = snap.metrics.filter((m) => m.rating === 'poor');
  const warn = snap.metrics.filter((m) => m.rating === 'needs-improvement');

  if (poor.length > 0) {
    parts.push(`Poor metrics: ${poor.map((m) => `${m.name} (${m.value})`).join(', ')}`);
  }
  if (warn.length > 0) {
    parts.push(`Needs improvement: ${warn.map((m) => `${m.name} (${m.value})`).join(', ')}`);
  }
  if (poor.length === 0 && warn.length === 0 && snap.metrics.length > 0) {
    parts.push('All metrics within acceptable thresholds.');
  }

  if (snap.memory?.usedMB != null) {
    parts.push(`Memory: ${snap.memory.usedMB}MB used`);
  }

  return parts.length > 0 ? parts.join('\n') : 'Performance data unavailable.';
}

/**
 * Creates a performance context source that exposes Core Web Vitals,
 * navigation timing, and memory usage to AI assistants — enabling them to
 * proactively warn about slow page loads and diagnose performance issues.
 *
 * @example
 * ```ts
 * // AI: "Your page took 4.2 seconds to load (LCP: 3800ms, rated poor).
 * //      This may affect user engagement. Consider lazy-loading images."
 * ```
 */
export function createAskablePerformanceSource(
  options: AskableCreatePerformanceSourceOptions,
): AskableContextSource {
  return createAskableSource({
    kind: options.kind ?? 'performance',
    describe: options.describe
      ? async () => {
          const snap = options.getSnapshot();
          if (!snap) return 'Performance data unavailable.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = options.getSnapshot();
          return snap ? defaultDescribe(snap) : 'Performance data unavailable.';
        },
    state: () => {
      const snap = options.getSnapshot();
      return {
        loadTime: snap?.navigation.loadTime ?? null,
        ttfb: snap?.navigation.ttfb ?? null,
        hasPoorMetrics: snap?.hasPoorMetrics ?? false,
        hasWarningMetrics: snap?.hasWarningMetrics ?? false,
        metricCount: snap?.metrics.length ?? 0,
      };
    },
    data: () => options.getSnapshot(),
  });
}
