import type {
  WebContextCaptureMode,
  WebContextGesture,
  WebContextPacket,
  WebContextRect,
} from '@askable-ui/context';
import type {
  AskableContext,
  AskableContextPacketOptions,
} from './types.js';

export type AskableRegionCaptureShape = 'region' | 'circle' | 'lasso';

export interface AskableRegionCaptureSelection {
  shape: AskableRegionCaptureShape;
  bounds: WebContextRect;
  center?: { x: number; y: number };
  radius?: number;
  points?: AskableRegionCapturePoint[];
  pointerType?: string;
  startedAt: string;
  endedAt: string;
}

export interface AskableRegionCaptureGradientStop {
  offset: string;
  color: string;
}

export interface AskableRegionCaptureTheme {
  /** Full-page overlay color while a capture tool is active. */
  overlayBackground: string;
  /** Rectangular and circle selection border color. */
  selectionStroke: string;
  /** Rectangular and circle selection fill color. */
  selectionFill: string;
  /** Rectangular and circle page scrim outside the selected area. */
  selectionScrim: string;
  /** Lasso stroke gradient stops. Defaults to the Askable AI selection line. */
  lassoGradientStops: readonly AskableRegionCaptureGradientStop[];
  /** Lasso stroke width in CSS pixels. */
  lassoStrokeWidth: number;
  /** CSS color used for the lasso glow. */
  lassoGlowColor: string;
  /** Lasso glow radius in CSS pixels. */
  lassoGlowRadius: number;
}

export interface AskableRegionCaptureOptions extends Omit<AskableContextPacketOptions, 'mode' | 'gesture' | 'target'> {
  /** Capture shape. Defaults to rectangular region selection. */
  shape?: AskableRegionCaptureShape;
  /** Minimum width/height in CSS pixels before a selection is accepted. Defaults to 6. */
  minSize?: number;
  /** Remove the overlay after the first accepted capture. Defaults to true. */
  once?: boolean;
  /** Visual theme for region, circle, and lasso capture overlays. */
  theme?: Partial<AskableRegionCaptureTheme>;
  /** Called after a region/circle/lasso is accepted and serialized to a Context packet. */
  onCapture?: (packet: WebContextPacket, selection: AskableRegionCaptureSelection) => void;
  /** Called when an active capture is cancelled. */
  onCancel?: () => void;
}

export interface AskableRegionCaptureHandle {
  start(): void;
  cancel(): void;
  destroy(): void;
  isActive(): boolean;
}

export interface AskableRegionCapturePoint {
  x: number;
  y: number;
}

type Point = AskableRegionCapturePoint;

const OVERLAY_ID = 'askable-region-capture';
const SELECTION_ATTR = 'data-askable-region-capture-selection';
const DEFAULT_REGION_CAPTURE_THEME: AskableRegionCaptureTheme = {
  overlayBackground: 'rgba(15,23,42,0.08)',
  selectionStroke: '#2563eb',
  selectionFill: 'rgba(37,99,235,0.14)',
  selectionScrim: 'rgba(15,23,42,0.12)',
  lassoGradientStops: [
    { offset: '0%', color: '#06b6d4' },
    { offset: '38%', color: '#4f46e5' },
    { offset: '70%', color: '#a855f7' },
    { offset: '100%', color: '#22c55e' },
  ],
  lassoStrokeWidth: 3,
  lassoGlowColor: 'rgba(79,70,229,0.35)',
  lassoGlowRadius: 8,
};

export function createAskableRegionCapture(
  ctx: AskableContext,
  options: AskableRegionCaptureOptions = {},
): AskableRegionCaptureHandle {
  if (typeof document === 'undefined') {
    return {
      start: () => undefined,
      cancel: () => undefined,
      destroy: () => undefined,
      isActive: () => false,
    };
  }

  let overlay: HTMLDivElement | null = null;
  let selectionEl: HTMLDivElement | null = null;
  let lassoSvg: SVGSVGElement | null = null;
  let lassoPolyline: SVGPolylineElement | null = null;
  let startPoint: Point | null = null;
  let lassoPoints: Point[] = [];
  let startedAt = '';
  let pointerType: string | undefined;
  let active = false;

  const shape = options.shape ?? 'region';
  const minSize = options.minSize ?? 6;
  const once = options.once ?? true;
  const theme = resolveRegionCaptureTheme(options.theme);

  const removeOverlay = () => {
    overlay?.removeEventListener('pointerdown', onPointerDown);
    overlay?.removeEventListener('pointermove', onPointerMove);
    overlay?.removeEventListener('pointerup', onPointerUp);
    overlay?.removeEventListener('pointercancel', onPointerCancel);
    document.removeEventListener('keydown', onKeyDown);
    overlay?.remove();
    overlay = null;
    selectionEl = null;
    lassoSvg = null;
    lassoPolyline = null;
    startPoint = null;
    lassoPoints = [];
    active = false;
  };

  const cancel = () => {
    const wasActive = Boolean(overlay);
    removeOverlay();
    if (wasActive) options.onCancel?.();
  };

  const ensureOverlay = () => {
    document.getElementById(OVERLAY_ID)?.remove();

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('aria-label', 'Context region capture');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'cursor:crosshair',
      `background:${theme.overlayBackground}`,
      'touch-action:none',
      'user-select:none',
    ].join(';');

    if (shape === 'lasso') {
      lassoSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      lassoSvg.setAttribute(SELECTION_ATTR, shape);
      lassoSvg.style.cssText = [
        'position:absolute',
        'inset:0',
        'width:100%',
        'height:100%',
        'pointer-events:none',
        'display:none',
      ].join(';');

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      const gradientId = 'askable-region-capture-lasso-gradient';
      gradient.setAttribute('id', gradientId);
      gradient.setAttribute('x1', '0%');
      gradient.setAttribute('y1', '0%');
      gradient.setAttribute('x2', '100%');
      gradient.setAttribute('y2', '0%');
      theme.lassoGradientStops.forEach(({ offset, color }) => {
        const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop.setAttribute('offset', offset);
        stop.setAttribute('stop-color', color);
        gradient.appendChild(stop);
      });
      defs.appendChild(gradient);
      lassoSvg.appendChild(defs);

      lassoPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      lassoPolyline.setAttribute('fill', 'none');
      lassoPolyline.setAttribute('stroke', `url(#${gradientId})`);
      lassoPolyline.setAttribute('stroke-width', String(theme.lassoStrokeWidth));
      lassoPolyline.setAttribute('stroke-linejoin', 'round');
      lassoPolyline.setAttribute('stroke-linecap', 'round');
      lassoPolyline.style.filter = `drop-shadow(0 0 ${theme.lassoGlowRadius}px ${theme.lassoGlowColor})`;
      lassoSvg.appendChild(lassoPolyline);
      overlay.appendChild(lassoSvg);
    } else {
      selectionEl = document.createElement('div');
      selectionEl.setAttribute(SELECTION_ATTR, shape);
      selectionEl.style.cssText = [
        'position:absolute',
        'box-sizing:border-box',
        `border:2px solid ${theme.selectionStroke}`,
        `background:${theme.selectionFill}`,
        `box-shadow:0 0 0 9999px ${theme.selectionScrim}`,
        'pointer-events:none',
        'display:none',
      ].join(';');
      if (shape === 'circle') selectionEl.style.borderRadius = '9999px';
      overlay.appendChild(selectionEl);
    }

    overlay.addEventListener('pointerdown', onPointerDown);
    overlay.addEventListener('pointermove', onPointerMove);
    overlay.addEventListener('pointerup', onPointerUp);
    overlay.addEventListener('pointercancel', onPointerCancel);
    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);
  };

  const updateLasso = (points: Point[]) => {
    if (!lassoSvg || !lassoPolyline) return;
    lassoSvg.style.display = 'block';
    lassoPolyline.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
  };

  const updateSelection = (bounds: WebContextRect) => {
    if (!selectionEl) return;
    selectionEl.style.display = 'block';
    selectionEl.style.left = `${bounds.x}px`;
    selectionEl.style.top = `${bounds.y}px`;
    selectionEl.style.width = `${bounds.width}px`;
    selectionEl.style.height = `${bounds.height}px`;
  };

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    pointerType = event.pointerType || undefined;
    startPoint = pointFromEvent(event);
    lassoPoints = [startPoint];
    startedAt = new Date().toISOString();
    active = true;
    if (selectionEl) selectionEl.style.display = 'none';
    if (lassoSvg) lassoSvg.style.display = 'none';
    overlay?.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!startPoint || !active) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    if (shape === 'lasso') {
      appendLassoPoint(lassoPoints, point);
      updateLasso(lassoPoints);
      return;
    }
    updateSelection(boundsForShape(shape, startPoint, point));
  }

  function onPointerUp(event: PointerEvent) {
    if (!startPoint || !active) return;
    event.preventDefault();
    const endPoint = pointFromEvent(event);
    if (shape === 'lasso') appendLassoPoint(lassoPoints, endPoint);
    const selection = createSelection(
      shape,
      startPoint,
      endPoint,
      pointerType,
      startedAt,
      shape === 'lasso' ? lassoPoints : undefined,
    );

    if (selection.bounds.width < minSize || selection.bounds.height < minSize) {
      cancel();
      return;
    }

    const packet = ctx.toContextPacket({
      ...options,
      mode: captureModeForShape(shape),
      gesture: gestureForShape(shape),
      target: {
        bounds: selection.bounds,
        metadata: {
          shape: selection.shape,
          ...(selection.center ? { center: selection.center } : {}),
          ...(selection.radius !== undefined ? { radius: selection.radius } : {}),
          ...(selection.points ? { points: selection.points, pointCount: selection.points.length } : {}),
          ...(selection.pointerType ? { pointerType: selection.pointerType } : {}),
        },
      },
      privacy: {
        consent: 'explicit',
        ...options.privacy,
      },
      provenance: {
        producer: '@askable-ui/core',
        method: 'app',
        ...options.provenance,
      },
    });

    options.onCapture?.(packet, selection);

    if (once) {
      removeOverlay();
      return;
    }

    startPoint = null;
    lassoPoints = [];
    active = false;
    if (selectionEl) selectionEl.style.display = 'none';
    if (lassoSvg) lassoSvg.style.display = 'none';
  }

  function onPointerCancel() {
    cancel();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') cancel();
  }

  return {
    start() {
      ensureOverlay();
    },
    cancel,
    destroy: removeOverlay,
    isActive: () => active,
  };
}

function resolveRegionCaptureTheme(theme?: Partial<AskableRegionCaptureTheme>): AskableRegionCaptureTheme {
  return {
    ...DEFAULT_REGION_CAPTURE_THEME,
    ...theme,
    lassoGradientStops: theme?.lassoGradientStops ?? DEFAULT_REGION_CAPTURE_THEME.lassoGradientStops,
  };
}

function pointFromEvent(event: PointerEvent): Point {
  return { x: event.clientX, y: event.clientY };
}

function boundsForShape(shape: AskableRegionCaptureShape, start: Point, end: Point): WebContextRect {
  if (shape === 'circle') {
    const center = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    const radius = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2;
    return {
      x: center.x - radius,
      y: center.y - radius,
      width: radius * 2,
      height: radius * 2,
    };
  }

  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function boundsForPoints(points: Point[]): WebContextRect {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function appendLassoPoint(points: Point[], point: Point): void {
  const previous = points[points.length - 1];
  if (!previous || distance(previous, point) >= 2) {
    points.push(point);
  }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createSelection(
  shape: AskableRegionCaptureShape,
  start: Point,
  end: Point,
  pointerType: string | undefined,
  startedAt: string,
  points?: Point[],
): AskableRegionCaptureSelection {
  const lassoPointsForSelection = points && points.length > 0 ? points : undefined;
  const bounds = lassoPointsForSelection ? boundsForPoints(lassoPointsForSelection) : boundsForShape(shape, start, end);
  const endedAt = new Date().toISOString();

  if (shape === 'circle') {
    const center = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    return {
      shape,
      bounds,
      center,
      radius: bounds.width / 2,
      ...(pointerType ? { pointerType } : {}),
      startedAt,
      endedAt,
    };
  }

  return {
    shape,
    bounds,
    ...(lassoPointsForSelection ? { points: lassoPointsForSelection } : {}),
    ...(pointerType ? { pointerType } : {}),
    startedAt,
    endedAt,
  };
}

function captureModeForShape(shape: AskableRegionCaptureShape): WebContextCaptureMode {
  if (shape === 'lasso') return 'lasso';
  return shape === 'circle' ? 'circle' : 'region';
}

function gestureForShape(shape: AskableRegionCaptureShape): WebContextGesture {
  if (shape === 'lasso') return 'lasso';
  return shape === 'circle' ? 'circle' : 'drag';
}
