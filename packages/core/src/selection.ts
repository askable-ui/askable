import type {
  WebContextGesture,
  WebContextPacket,
  WebContextRect,
} from '@askable-ui/context';
import type {
  AskableContext,
  AskableContextPacketOptions,
} from './types.js';

export interface AskableTextSelectionCaptureSelection {
  text: string;
  bounds?: WebContextRect;
  selector?: string;
  pointerType?: string;
  capturedAt: string;
}

export interface AskableTextSelectionCaptureOptions extends Omit<AskableContextPacketOptions, 'mode' | 'gesture' | 'target'> {
  /** Root to observe for selections. Defaults to document. */
  root?: Document | HTMLElement;
  /** Minimum selected text length before a selection is accepted. Defaults to 1. */
  minLength?: number;
  /** Debounce delay for browser selectionchange events. Defaults to 120ms. */
  debounce?: number;
  /** Remove listeners after the first accepted capture. Defaults to false. */
  once?: boolean;
  /** Ignore duplicate selections with the same text and bounds. Defaults to true. */
  dedupe?: boolean;
  /** Called after selected text is serialized to a Context packet. */
  onCapture?: (packet: WebContextPacket, selection: AskableTextSelectionCaptureSelection) => void;
  /** Called when active selection capture is cancelled. */
  onCancel?: () => void;
}

export interface AskableTextSelectionCaptureHandle {
  start(): void;
  captureNow(overrides?: Partial<AskableTextSelectionCaptureOptions>): WebContextPacket | null;
  cancel(): void;
  destroy(): void;
  isActive(): boolean;
}

type LastInteraction = {
  gesture: WebContextGesture;
  pointerType?: string;
};

const DEFAULT_DEBOUNCE = 120;

/**
 * Listens for text selection changes in the document and emits an Askable context packet
 * each time the user selects text. Use `captureNow()` to programmatically snapshot the
 * current selection without waiting for a `selectionchange` event.
 *
 * Call `handle.start()` to begin listening and `handle.destroy()` to clean up.
 * Set `enabled: false` to pause without destroying.
 *
 * @example
 * ```ts
 * const capture = createAskableTextSelectionCapture(ctx, {
 *   onCapture: (packet) => sendToAI(packet),
 *   debounce: 200,
 * });
 * capture.start();
 * // later:
 * const snapshot = capture.captureNow(); // captures current selection
 * ```
 */
export function createAskableTextSelectionCapture(
  ctx: AskableContext,
  options: AskableTextSelectionCaptureOptions = {},
): AskableTextSelectionCaptureHandle {
  const doc = resolveDocument(options.root);
  if (!doc) {
    return {
      start: () => undefined,
      captureNow: () => null,
      cancel: () => undefined,
      destroy: () => undefined,
      isActive: () => false,
    };
  }

  const ownerDocument = doc;
  const root = options.root ?? ownerDocument;
  const minLength = options.minLength ?? 1;
  const debounce = options.debounce ?? DEFAULT_DEBOUNCE;
  const once = options.once ?? false;
  const dedupe = options.dedupe ?? true;
  let active = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastInteraction: LastInteraction = { gesture: 'programmatic' };
  let lastSignature = '';

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const capture = (overrides?: Partial<AskableTextSelectionCaptureOptions>): WebContextPacket | null => {
    const currentOptions = { ...options, ...overrides };
    const currentRoot = currentOptions.root ?? root;
    const currentMinLength = currentOptions.minLength ?? minLength;
    const currentDedupe = currentOptions.dedupe ?? dedupe;
    const currentOnce = currentOptions.once ?? once;
    const selection = readSelection(ownerDocument, currentRoot, currentMinLength, lastInteraction.pointerType);
    if (!selection) return null;

    const signature = selectionSignature(selection);
    if (currentDedupe && signature === lastSignature) return null;
    lastSignature = signature;

    const packet = ctx.toContextPacket({
      ...currentOptions,
      mode: 'text-selection',
      gesture: lastInteraction.gesture,
      target: {
        text: selection.text,
        ...(selection.bounds ? { bounds: selection.bounds } : {}),
        ...(selection.selector ? { selector: selection.selector } : {}),
        metadata: {
          kind: 'text-selection',
          length: selection.text.length,
          ...(selection.pointerType ? { pointerType: selection.pointerType } : {}),
        },
      },
      privacy: {
        consent: 'explicit',
        ...currentOptions.privacy,
      },
      provenance: {
        producer: '@askable-ui/core',
        method: 'dom',
        ...currentOptions.provenance,
      },
    });

    currentOptions.onCapture?.(packet, selection);
    if (currentOnce) destroy();
    return packet;
  };

  const scheduleCapture = () => {
    if (!active) return;
    clearTimer();
    if (debounce <= 0) {
      capture();
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      capture();
    }, debounce);
  };

  function onSelectionChange() {
    scheduleCapture();
  }

  function onPointerUp(event: PointerEvent) {
    lastInteraction = {
      gesture: 'drag',
      pointerType: event.pointerType || undefined,
    };
    scheduleCapture();
  }

  function onKeyUp() {
    lastInteraction = { gesture: 'keyboard' };
    scheduleCapture();
  }

  function start() {
    if (active) return;
    active = true;
    ownerDocument.addEventListener('selectionchange', onSelectionChange);
    ownerDocument.addEventListener('pointerup', onPointerUp);
    ownerDocument.addEventListener('keyup', onKeyUp);
  }

  function destroy() {
    clearTimer();
    ownerDocument.removeEventListener('selectionchange', onSelectionChange);
    ownerDocument.removeEventListener('pointerup', onPointerUp);
    ownerDocument.removeEventListener('keyup', onKeyUp);
    active = false;
  }

  function cancel() {
    const wasActive = active;
    destroy();
    if (wasActive) options.onCancel?.();
  }

  return {
    start,
    captureNow: capture,
    cancel,
    destroy,
    isActive: () => active,
  };
}

function resolveDocument(root?: Document | HTMLElement): Document | null {
  if (typeof Document !== 'undefined' && root instanceof Document) return root;
  if (root?.ownerDocument) return root.ownerDocument;
  return typeof document !== 'undefined' ? document : null;
}

function readSelection(
  doc: Document,
  root: Document | HTMLElement,
  minLength: number,
  pointerType?: string,
): AskableTextSelectionCaptureSelection | null {
  const selection = doc.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const text = selection.toString().trim();
  if (text.length < minLength) return null;

  const range = selection.getRangeAt(0);
  if (!rangeInsideRoot(range, root)) return null;

  const bounds = rangeBounds(range);
  const selector = selectorForRange(range);
  return {
    text,
    ...(bounds ? { bounds } : {}),
    ...(selector ? { selector } : {}),
    ...(pointerType ? { pointerType } : {}),
    capturedAt: new Date().toISOString(),
  };
}

function rangeInsideRoot(range: Range, root: Document | HTMLElement): boolean {
  if (typeof Document !== 'undefined' && root instanceof Document) return true;
  const start = nodeToElement(range.startContainer);
  const end = nodeToElement(range.endContainer);
  return Boolean(start && end && root.contains(start) && root.contains(end));
}

function rangeBounds(range: Range): WebContextRect | undefined {
  if (typeof range.getBoundingClientRect !== 'function') return undefined;
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return undefined;
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function selectorForRange(range: Range): string | undefined {
  const element = nodeToElement(range.commonAncestorContainer);
  if (!element) return undefined;
  return selectorForElement(element);
}

function nodeToElement(node: Node): HTMLElement | null {
  if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) return node;
  const parent = node.parentElement;
  return typeof HTMLElement !== 'undefined' && parent instanceof HTMLElement ? parent : null;
}

function selectorForElement(element: HTMLElement): string | undefined {
  if (element.id) return `#${escapeSelectorIdent(element.id)}`;
  const askableId = element.getAttribute('data-askable-id')?.trim();
  if (askableId) return `[data-askable-id="${escapeAttributeValue(askableId)}"]`;
  const askable = element.closest<HTMLElement>('[data-askable-id]');
  const closestId = askable?.getAttribute('data-askable-id')?.trim();
  return closestId ? `[data-askable-id="${escapeAttributeValue(closestId)}"]` : undefined;
}

function escapeSelectorIdent(value: string): string {
  const css = globalThis.CSS as { escape?: (value: string) => string } | undefined;
  return css?.escape ? css.escape(value) : value.replace(/["'\\#.:,[\]>~+*()]/g, '\\$&');
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function selectionSignature(selection: AskableTextSelectionCaptureSelection): string {
  return JSON.stringify({
    text: selection.text,
    bounds: selection.bounds,
    selector: selection.selector,
  });
}
