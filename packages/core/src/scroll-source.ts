import { createAskableSource } from './sources.js';
import type { AskableContextSource } from './types.js';

export interface AskableScrollState {
  /** Vertical scroll position in pixels. */
  scrollTop: number;
  /** Horizontal scroll position in pixels. */
  scrollLeft: number;
  /** Total scrollable height in pixels. */
  scrollHeight: number;
  /** Total scrollable width in pixels. */
  scrollWidth: number;
  /** Visible height of the container in pixels. */
  clientHeight: number;
  /** Visible width of the container in pixels. */
  clientWidth: number;
  /** Vertical scroll progress 0-100. */
  scrollPercent: number;
  /** Horizontal scroll progress 0-100. */
  scrollPercentX: number;
  /** True when scrolled to the top. */
  isAtTop: boolean;
  /** True when scrolled to the bottom. */
  isAtBottom: boolean;
  /** True when scrolled to the left edge. */
  isAtLeft: boolean;
  /** True when scrolled to the right edge. */
  isAtRight: boolean;
}

export interface AskableScrollSourceSnapshot extends AskableScrollState {
  /** Currently visible section heading, if provided via `getActiveSection`. */
  activeSection: string | null;
}

export interface AskableCreateScrollSourceOptions {
  /**
   * Returns the scrollable element.
   * Defaults to `document.documentElement` (the page itself).
   */
  getElement?: () => Element | null | undefined;
  /**
   * Returns the name of the section currently visible in the viewport.
   * Use this to tell the AI which heading or chapter the user is reading.
   */
  getActiveSection?: () => string | null;
  /** Custom describe function. */
  describe?: (snapshot: AskableScrollSourceSnapshot) => string;
  /** Source category. Defaults to "scroll". */
  kind?: string;
}

function getScrollMetrics(el: Element): AskableScrollState {
  const scrollTop = el.scrollTop;
  const scrollLeft = el.scrollLeft;
  const scrollHeight = el.scrollHeight;
  const scrollWidth = el.scrollWidth;
  const clientHeight = el.clientHeight;
  const clientWidth = el.clientWidth;

  const maxScrollTop = scrollHeight - clientHeight;
  const maxScrollLeft = scrollWidth - clientWidth;

  const scrollPercent = maxScrollTop > 0 ? Math.round((scrollTop / maxScrollTop) * 100) : 0;
  const scrollPercentX = maxScrollLeft > 0 ? Math.round((scrollLeft / maxScrollLeft) * 100) : 0;

  return {
    scrollTop,
    scrollLeft,
    scrollHeight,
    scrollWidth,
    clientHeight,
    clientWidth,
    scrollPercent,
    scrollPercentX,
    isAtTop: scrollTop <= 0,
    isAtBottom: maxScrollTop > 0 && scrollTop >= maxScrollTop - 1,
    isAtLeft: scrollLeft <= 0,
    isAtRight: maxScrollLeft > 0 && scrollLeft >= maxScrollLeft - 1,
  };
}

function buildSnapshot(
  el: Element,
  options: AskableCreateScrollSourceOptions,
): AskableScrollSourceSnapshot {
  return {
    ...getScrollMetrics(el),
    activeSection: options.getActiveSection?.() ?? null,
  };
}

function defaultDescribe(snapshot: AskableScrollSourceSnapshot): string {
  const lines: string[] = [];

  if (snapshot.activeSection) {
    lines.push(`Reading: ${snapshot.activeSection}`);
  }

  lines.push(`Scroll position: ${snapshot.scrollPercent}% down the page`);

  if (snapshot.isAtTop) lines.push('Position: at the top');
  else if (snapshot.isAtBottom) lines.push('Position: at the bottom');

  if (snapshot.scrollPercentX > 0) {
    lines.push(`Horizontal scroll: ${snapshot.scrollPercentX}%`);
  }

  return lines.join('\n');
}

/**
 * Creates a scroll position context source that exposes how far the user has
 * scrolled on the page (or inside a container), what percentage they have read,
 * and which section heading is currently visible — so AI assistants can reference
 * the exact content the user is looking at.
 *
 * @example
 * ```ts
 * // Page-level scroll
 * const source = createAskableScrollSource({
 *   getActiveSection: () => visibleHeading,
 * });
 * ctx.registerSource('scroll', source);
 *
 * // Container scroll
 * const source = createAskableScrollSource({
 *   getElement: () => containerRef.current,
 * });
 * ```
 */
export function createAskableScrollSource(
  options: AskableCreateScrollSourceOptions = {},
): AskableContextSource {
  const { getElement, describe, kind = 'scroll' } = options;

  const resolveElement = (): Element | null => {
    if (getElement) return getElement() ?? null;
    return typeof document !== 'undefined' ? document.documentElement : null;
  };

  return createAskableSource({
    kind,
    describe: describe
      ? () => {
          const el = resolveElement();
          if (!el) return 'Scroll position unavailable.';
          return describe(buildSnapshot(el, options));
        }
      : () => {
          const el = resolveElement();
          if (!el) return 'Scroll position unavailable.';
          return defaultDescribe(buildSnapshot(el, options));
        },
    state: () => {
      const el = resolveElement();
      if (!el) return { available: false };
      const m = getScrollMetrics(el);
      return {
        available: true,
        scrollPercent: m.scrollPercent,
        isAtTop: m.isAtTop,
        isAtBottom: m.isAtBottom,
      };
    },
    data: () => {
      const el = resolveElement();
      if (!el) return null;
      return buildSnapshot(el, options);
    },
  });
}
