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

export type AskableRegionCaptureShape = 'region' | 'square' | 'circle' | 'lasso';

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

export interface AskableRegionCaptureState {
  /** Captured Context packet for the current selected region, circle, square, or lasso. */
  packet: WebContextPacket;
  /** Raw selected geometry for the current selected context. */
  selection: AskableRegionCaptureSelection;
  /** Persisted selected-state affordance root, when `selectionAffordance` rendered one. */
  element?: HTMLElement;
}

export interface AskableRegionCaptureGradientStop {
  offset: string;
  color: string;
}

export type AskableRegionCaptureStyle = Partial<CSSStyleDeclaration>;

export interface AskableRegionCapturePromptOptions {
  /** Placeholder shown in the anchored prompt input. */
  placeholder?: string;
  /** Initial prompt input value, useful for suggested follow-up questions. */
  initialValue?: string;
  /** Focus and select the prompt input after rendering. Defaults to true. */
  autoFocus?: boolean;
  /** Accessible label/title for the submit button. */
  submitLabel?: string;
  /** Class added to the prompt container. */
  className?: string;
  /** Inline styles applied to the prompt container. */
  style?: AskableRegionCaptureStyle;
  /** Class added to the prompt input. */
  inputClassName?: string;
  /** Inline styles applied to the prompt input. */
  inputStyle?: AskableRegionCaptureStyle;
  /** Class added to the prompt submit button. */
  buttonClassName?: string;
  /** Inline styles applied to the prompt submit button. */
  buttonStyle?: AskableRegionCaptureStyle;
  /** Called when the user submits a non-empty prompt from the selected area. */
  onSubmit?: (
    question: string,
    packet: WebContextPacket,
    selection: AskableRegionCaptureSelection,
  ) => void;
}

export interface AskableRegionCaptureSelectionAffordanceOptions {
  /** Keep the selected shape visible after capture. Defaults to true when enabled. */
  persist?: boolean;
  /** Render a compact prompt input anchored to the selected shape. Defaults to false. */
  prompt?: boolean | AskableRegionCapturePromptOptions;
  /** Show a small dismiss button for the persisted selected shape. Defaults to false. */
  dismissible?: boolean;
  /** Accessible label/title for the dismiss button. */
  dismissLabel?: string;
  /** Optional label shown beside the selected area. */
  label?: string;
  /** Class added to the selected-area affordance root. */
  className?: string;
  /** Inline styles applied to the selected-area affordance root. */
  style?: AskableRegionCaptureStyle;
  /** Class added to the selected-area label. */
  labelClassName?: string;
  /** Inline styles applied to the selected-area label. */
  labelStyle?: AskableRegionCaptureStyle;
  /** Class added to the dismiss button. */
  dismissClassName?: string;
  /** Inline styles applied to the dismiss button. */
  dismissStyle?: AskableRegionCaptureStyle;
  /** Called after the selected-area affordance is dismissed. */
  onDismiss?: (
    packet: WebContextPacket,
    selection: AskableRegionCaptureSelection,
  ) => void;
  /** Replace the built-in selected-area affordance with consumer-rendered DOM. */
  render?: (
    packet: WebContextPacket,
    selection: AskableRegionCaptureSelection,
  ) => HTMLElement | null | undefined | void;
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
  /** Border color for persisted selected-region affordances. */
  selectionAffordanceStroke: string;
  /** Fill color for persisted selected-region affordances. */
  selectionAffordanceFill: string;
  /** Shadow for persisted selected-region affordances. */
  selectionAffordanceShadow: string;
  /** Background color for the anchored prompt input. */
  promptBackground: string;
  /** Border color for the anchored prompt input. */
  promptBorder: string;
  /** Text color for the anchored prompt input. */
  promptText: string;
  /** Accent color for the anchored prompt submit button. */
  promptAccent: string;
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
  /** Opt-in selected-state UI shown after capture, optionally with an anchored prompt. */
  selectionAffordance?: boolean | AskableRegionCaptureSelectionAffordanceOptions;
  /** Called after a region/circle/lasso is accepted and serialized to a Context packet. */
  onCapture?: (packet: WebContextPacket, selection: AskableRegionCaptureSelection) => void;
  /** Called whenever the pinned selection state changes or is cleared. */
  onSelectionChange?: (state: AskableRegionCaptureState | null) => void;
  /** Called when an active capture is cancelled. */
  onCancel?: () => void;
}

export interface AskableRegionCaptureHandle {
  start(): void;
  cancel(): void;
  clearSelection(): void;
  getSelection(): AskableRegionCaptureState | null;
  destroy(): void;
  isActive(): boolean;
}

export interface AskableRegionCapturePoint {
  x: number;
  y: number;
}

type Point = AskableRegionCapturePoint;

const OVERLAY_ID = 'askable-region-capture';
const AFFORDANCE_ID = 'askable-region-selection-affordance';
const SELECTION_ATTR = 'data-askable-region-capture-selection';
const AFFORDANCE_ATTR = 'data-askable-region-selection-affordance';
export const ASKABLE_REGION_CAPTURE_THEME: AskableRegionCaptureTheme = {
  overlayBackground: 'rgba(15,23,42,0.08)',
  selectionStroke: '#2563eb',
  selectionFill: 'rgba(37,99,235,0.14)',
  selectionScrim: 'rgba(15,23,42,0.12)',
  lassoGradientStops: [
    { offset: '0%', color: '#6d28d9' },
    { offset: '46%', color: '#7c3aed' },
    { offset: '78%', color: '#8b5cf6' },
    { offset: '100%', color: '#a78bfa' },
  ],
  lassoStrokeWidth: 3,
  lassoGlowColor: 'rgba(124,58,237,0.16)',
  lassoGlowRadius: 8,
  selectionAffordanceStroke: '#7c3aed',
  selectionAffordanceFill: 'rgba(124,58,237,0.1)',
  selectionAffordanceShadow: '0 12px 30px rgba(91,33,182,0.16)',
  promptBackground: '#ffffff',
  promptBorder: 'rgba(124,58,237,0.22)',
  promptText: '#111317',
  promptAccent: '#111317',
};

/**
 * Attaches a pointer-driven region-capture overlay to the document. The user drags
 * (region/square), draws (circle), or traces (lasso) a shape; on release, an
 * Askable context packet is emitted to `onCapture` with the selection geometry
 * and the current context.
 *
 * Call `handle.start()` to mount the overlay and `handle.destroy()` to clean up.
 * With `once: false` (default is `true`) the overlay persists after each capture.
 *
 * @example
 * ```ts
 * const capture = createAskableRegionCapture(ctx, {
 *   shape: 'lasso',
 *   intent: 'explain this region',
 *   onCapture: (packet, selection) => sendToAI(packet),
 *   onCancel: () => console.log('cancelled'),
 * });
 * capture.start(); // mounts overlay
 * ```
 */
export function createAskableRegionCapture(
  ctx: AskableContext,
  options: AskableRegionCaptureOptions = {},
): AskableRegionCaptureHandle {
  if (typeof document === 'undefined') {
    return {
      start: () => undefined,
      cancel: () => undefined,
      clearSelection: () => undefined,
      getSelection: () => null,
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
  let currentSelection: AskableRegionCaptureState | null = null;

  const shape = options.shape ?? 'region';
  const minSize = options.minSize ?? 6;
  const once = options.once ?? true;
  const theme = resolveRegionCaptureTheme(options.theme);
  const selectionAffordance = resolveSelectionAffordance(options.selectionAffordance);

  const removeAffordance = (clearState = true) => {
    document.getElementById(AFFORDANCE_ID)?.remove();
    if (clearState) setCurrentSelection(null);
  };

  const setCurrentSelection = (state: AskableRegionCaptureState | null) => {
    if (currentSelection === state) return;
    currentSelection = state;
    options.onSelectionChange?.(state);
  };

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
    removeAffordance();
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

    // Clean up before calling onCapture so an error in the callback
    // never leaves a stale overlay in the DOM.
    if (once) {
      removeOverlay();
    } else {
      startPoint = null;
      lassoPoints = [];
      active = false;
      if (selectionEl) selectionEl.style.display = 'none';
      if (lassoSvg) lassoSvg.style.display = 'none';
    }

    const nextSelection: AskableRegionCaptureState = { packet, selection };
    renderSelectionAffordance(packet, selection, nextSelection);
    setCurrentSelection(nextSelection);
    options.onCapture?.(packet, selection);
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
    clearSelection: removeAffordance,
    getSelection: () => currentSelection,
    destroy() {
      removeOverlay();
      removeAffordance();
    },
    isActive: () => Boolean(overlay),
  };

  function renderSelectionAffordance(
    packet: WebContextPacket,
    selection: AskableRegionCaptureSelection,
    state: AskableRegionCaptureState,
  ) {
    if (!selectionAffordance || selectionAffordance.persist === false) return;
    removeAffordance(false);

    const custom = selectionAffordance.render?.(packet, selection);
    if (custom instanceof HTMLElement) {
      custom.id = custom.id || AFFORDANCE_ID;
      custom.setAttribute(AFFORDANCE_ATTR, selection.shape);
      document.body.appendChild(custom);
      state.element = custom;
      return;
    }

    const root = document.createElement('div');
    root.id = AFFORDANCE_ID;
    root.setAttribute(AFFORDANCE_ATTR, selection.shape);
    if (selectionAffordance.className) root.className = selectionAffordance.className;
    root.style.cssText = [
      'position:fixed',
      `left:${selection.bounds.x}px`,
      `top:${selection.bounds.y}px`,
      `width:${Math.max(1, selection.bounds.width)}px`,
      `height:${Math.max(1, selection.bounds.height)}px`,
      'z-index:2147483646',
      'pointer-events:none',
      'box-sizing:border-box',
    ].join(';');
    assignStyles(root, selectionAffordance.style);

    root.appendChild(createSelectionMarker(selection));
    if (selectionAffordance.label !== '') {
      root.appendChild(createSelectionLabel(selectionAffordance.label ?? `${selection.shape} context`));
    }

    const prompt = resolvePromptOptions(selectionAffordance.prompt);
    if (prompt) root.appendChild(createPrompt(prompt, packet, selection));
    if (selectionAffordance.dismissible) root.appendChild(createDismissButton(packet, selection));

    document.body.appendChild(root);
    state.element = root;
    if (prompt?.autoFocus !== false) focusPromptInput(root);
  }

  function createSelectionMarker(selection: AskableRegionCaptureSelection): HTMLElement | SVGSVGElement {
    if (selection.shape === 'lasso' && selection.points?.length) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${Math.max(1, selection.bounds.width)} ${Math.max(1, selection.bounds.height)}`);
      svg.style.cssText = [
        'position:absolute',
        'inset:0',
        'overflow:visible',
        'pointer-events:none',
      ].join(';');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pointsToPath(selection.points, selection.bounds));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', theme.selectionAffordanceStroke);
      path.setAttribute('stroke-width', String(theme.lassoStrokeWidth));
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.style.filter = `drop-shadow(0 0 ${theme.lassoGlowRadius}px ${theme.lassoGlowColor})`;
      svg.appendChild(path);
      return svg;
    }

    const marker = document.createElement('div');
    marker.style.cssText = [
      'position:absolute',
      'inset:0',
      'box-sizing:border-box',
      `border:2px solid ${theme.selectionAffordanceStroke}`,
      `background:${theme.selectionAffordanceFill}`,
      `box-shadow:${theme.selectionAffordanceShadow}`,
      'pointer-events:none',
    ].join(';');
    if (selection.shape === 'circle') marker.style.borderRadius = '9999px';
    return marker;
  }

  function createSelectionLabel(label: string): HTMLSpanElement {
    const el = document.createElement('span');
    el.textContent = label;
    if (selectionAffordance?.labelClassName) el.className = selectionAffordance.labelClassName;
    el.style.cssText = [
      'position:absolute',
      'left:0',
      'bottom:calc(100% + 6px)',
      'padding:4px 8px',
      'border-radius:999px',
      `background:${theme.promptBackground}`,
      `border:1px solid ${theme.promptBorder}`,
      `color:${theme.promptText}`,
      'font:600 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'box-shadow:0 8px 20px rgba(15,23,42,0.12)',
      'white-space:nowrap',
      'pointer-events:none',
    ].join(';');
    assignStyles(el, selectionAffordance?.labelStyle);
    return el;
  }

  function createPrompt(
    prompt: AskableRegionCapturePromptOptions,
    packet: WebContextPacket,
    selection: AskableRegionCaptureSelection,
  ): HTMLFormElement {
    const form = document.createElement('form');
    if (prompt.className) form.className = prompt.className;
    const viewport = viewportSize(document);
    const placeAbove = selection.bounds.y + selection.bounds.height + 56 > viewport.height;
    form.style.cssText = [
      'position:absolute',
      'left:0',
      placeAbove ? 'bottom:calc(100% + 10px)' : 'top:calc(100% + 10px)',
      'display:flex',
      'align-items:center',
      'gap:6px',
      'min-width:220px',
      'max-width:min(320px, calc(100vw - 24px))',
      'padding:6px',
      'border-radius:999px',
      `background:${theme.promptBackground}`,
      `border:1px solid ${theme.promptBorder}`,
      'box-shadow:0 14px 34px rgba(15,23,42,0.14)',
      'pointer-events:auto',
    ].join(';');
    assignStyles(form, prompt.style);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = prompt.placeholder ?? 'Ask about this selection...';
    input.value = prompt.initialValue ?? '';
    if (prompt.inputClassName) input.className = prompt.inputClassName;
    input.style.cssText = [
      'min-width:0',
      'flex:1',
      'border:0',
      'outline:0',
      'background:transparent',
      `color:${theme.promptText}`,
      'font:500 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    ].join(';');
    assignStyles(input, prompt.inputStyle);

    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = 'Ask';
    button.setAttribute('aria-label', prompt.submitLabel ?? 'Ask about selected context');
    if (prompt.buttonClassName) button.className = prompt.buttonClassName;
    button.style.cssText = [
      'border:0',
      'border-radius:999px',
      'padding:6px 10px',
      `background:${theme.promptAccent}`,
      'color:#fff',
      'font:700 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'cursor:pointer',
    ].join(';');
    assignStyles(button, prompt.buttonStyle);

    form.append(input, button);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const question = input.value.trim();
      if (!question) return;
      prompt.onSubmit?.(question, packet, selection);
      input.value = '';
    });
    return form;
  }

  function createDismissButton(
    packet: WebContextPacket,
    selection: AskableRegionCaptureSelection,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'x';
    button.setAttribute('aria-label', selectionAffordance?.dismissLabel ?? 'Dismiss selected context');
    if (selectionAffordance?.dismissClassName) button.className = selectionAffordance.dismissClassName;
    button.style.cssText = [
      'position:absolute',
      'right:-10px',
      'top:-10px',
      'width:22px',
      'height:22px',
      'display:grid',
      'place-items:center',
      'border-radius:999px',
      `border:1px solid ${theme.promptBorder}`,
      `background:${theme.promptBackground}`,
      `color:${theme.promptText}`,
      'box-shadow:0 8px 20px rgba(15,23,42,0.14)',
      'font:700 14px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'cursor:pointer',
      'pointer-events:auto',
      'padding:0',
    ].join(';');
    assignStyles(button, selectionAffordance?.dismissStyle);
    button.addEventListener('click', () => {
      removeAffordance();
      selectionAffordance?.onDismiss?.(packet, selection);
    });
    return button;
  }
}

function focusPromptInput(root: HTMLElement): void {
  const input = root.querySelector('input');
  const view = root.ownerDocument.defaultView;
  if (!input || !view || !(input instanceof view.HTMLInputElement)) return;
  input.focus({ preventScroll: true });
  input.select();
}

function viewportSize(doc: Document): { height: number } {
  const view = doc.defaultView;
  return {
    height: view?.innerHeight ?? 768,
  };
}

function resolveRegionCaptureTheme(theme?: Partial<AskableRegionCaptureTheme>): AskableRegionCaptureTheme {
  return {
    ...ASKABLE_REGION_CAPTURE_THEME,
    ...theme,
    lassoGradientStops: theme?.lassoGradientStops ?? ASKABLE_REGION_CAPTURE_THEME.lassoGradientStops,
  };
}

function resolveSelectionAffordance(
  affordance?: boolean | AskableRegionCaptureSelectionAffordanceOptions,
): AskableRegionCaptureSelectionAffordanceOptions | null {
  if (!affordance) return null;
  if (affordance === true) return { persist: true };
  return { persist: affordance.persist ?? true, ...affordance };
}

function resolvePromptOptions(
  prompt?: boolean | AskableRegionCapturePromptOptions,
): AskableRegionCapturePromptOptions | null {
  if (!prompt) return null;
  if (prompt === true) return {};
  return prompt;
}

function assignStyles(element: HTMLElement | SVGElement, styles?: AskableRegionCaptureStyle): void {
  if (!styles) return;
  Object.assign(element.style, styles);
}

function pointsToPath(points: Point[], bounds: WebContextRect): string {
  return points
    .map((point, index) => {
      const x = Math.round(point.x - bounds.x);
      const y = Math.round(point.y - bounds.y);
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join(' ');
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

  if (shape === 'square') {
    const size = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
    return {
      x: end.x < start.x ? start.x - size : start.x,
      y: end.y < start.y ? start.y - size : start.y,
      width: size,
      height: size,
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
