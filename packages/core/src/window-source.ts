import { createAskableSource } from './sources.js';
import type { AskableContextSource } from './types.js';

export type AskableDeviceCategory = 'mobile' | 'tablet' | 'desktop' | 'wide';
export type AskableOrientation = 'portrait' | 'landscape' | 'square';

export interface AskableWindowSourceSnapshot {
  /** Inner width of the browser window in pixels. */
  width: number;
  /** Inner height of the browser window in pixels. */
  height: number;
  /** Device pixel ratio (e.g., 2 for retina displays). */
  devicePixelRatio: number;
  /** Window orientation. */
  orientation: AskableOrientation;
  /** Rough device category based on viewport width. */
  deviceCategory: AskableDeviceCategory;
  /** Tailwind-style active breakpoint (xs/sm/md/lg/xl/2xl). */
  breakpoint: string;
  /** Whether the viewport width is at least the given breakpoint. */
  isAtLeast: Record<'sm' | 'md' | 'lg' | 'xl' | '2xl', boolean>;
  /** Whether the browser window is fullscreen. */
  isFullscreen: boolean;
  /** Current scroll dimensions of the document. */
  documentWidth: number;
  documentHeight: number;
}

export interface AskableCreateWindowSourceOptions {
  /**
   * Custom breakpoint definitions (px values).
   * Defaults to Tailwind CSS breakpoints.
   */
  breakpoints?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };
  /** Custom describe function. */
  describe?: (snapshot: AskableWindowSourceSnapshot) => string;
  /** Source category. Defaults to "window". */
  kind?: string;
}

const DEFAULT_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

function getBreakpoint(width: number, bp: Required<NonNullable<AskableCreateWindowSourceOptions['breakpoints']>>): string {
  if (width >= bp['2xl']) return '2xl';
  if (width >= bp.xl) return 'xl';
  if (width >= bp.lg) return 'lg';
  if (width >= bp.md) return 'md';
  if (width >= bp.sm) return 'sm';
  return 'xs';
}

function getDeviceCategory(width: number): AskableDeviceCategory {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1536) return 'desktop';
  return 'wide';
}

function buildSnapshot(options: AskableCreateWindowSourceOptions): AskableWindowSourceSnapshot {
  if (typeof window === 'undefined') {
    return {
      width: 0,
      height: 0,
      devicePixelRatio: 1,
      orientation: 'landscape',
      deviceCategory: 'desktop',
      breakpoint: 'lg',
      isAtLeast: { sm: true, md: true, lg: true, xl: false, '2xl': false },
      isFullscreen: false,
      documentWidth: 0,
      documentHeight: 0,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio ?? 1;

  const bp = { ...DEFAULT_BREAKPOINTS, ...options.breakpoints };
  const breakpoint = getBreakpoint(width, bp);
  const deviceCategory = getDeviceCategory(width);

  const orientation: AskableOrientation = width === height ? 'square' : width > height ? 'landscape' : 'portrait';

  const isAtLeast = {
    sm: width >= bp.sm,
    md: width >= bp.md,
    lg: width >= bp.lg,
    xl: width >= bp.xl,
    '2xl': width >= bp['2xl'],
  };

  const docEl = document.documentElement;

  return {
    width,
    height,
    devicePixelRatio: dpr,
    orientation,
    deviceCategory,
    breakpoint,
    isAtLeast,
    isFullscreen: !!document.fullscreenElement,
    documentWidth: docEl.scrollWidth,
    documentHeight: docEl.scrollHeight,
  };
}

function defaultDescribe(snapshot: AskableWindowSourceSnapshot): string {
  const lines: string[] = [];

  lines.push(`Viewport: ${snapshot.width}×${snapshot.height}px (${snapshot.deviceCategory}, ${snapshot.breakpoint} breakpoint)`);
  lines.push(`Orientation: ${snapshot.orientation}`);

  if (snapshot.devicePixelRatio > 1) {
    lines.push(`Display: ${snapshot.devicePixelRatio}× pixel density (retina-class)`);
  }
  if (snapshot.isFullscreen) {
    lines.push('Fullscreen: active');
  }
  if (snapshot.documentHeight > snapshot.height * 2) {
    lines.push(`Document: ${snapshot.documentWidth}×${snapshot.documentHeight}px (scrollable)`);
  }

  return lines.join('\n');
}

/**
 * Creates a window/viewport context source that exposes the browser viewport
 * dimensions, device category, active breakpoint, orientation, and pixel density —
 * so AI assistants can give accurate responsive design advice and understand the
 * user's screen context.
 *
 * @example
 * ```ts
 * const source = createAskableWindowSource();
 * ctx.registerSource('window', source);
 *
 * // Auto-notify on resize
 * window.addEventListener('resize', () => handle.notifyChanged());
 * ```
 */
export function createAskableWindowSource(
  options: AskableCreateWindowSourceOptions = {},
): AskableContextSource {
  const { describe, kind = 'window' } = options;

  return createAskableSource({
    kind,
    describe: describe
      ? () => describe(buildSnapshot(options))
      : () => defaultDescribe(buildSnapshot(options)),
    state: () => {
      const s = buildSnapshot(options);
      return {
        width: s.width,
        height: s.height,
        breakpoint: s.breakpoint,
        deviceCategory: s.deviceCategory,
      };
    },
    data: () => buildSnapshot(options),
  });
}
