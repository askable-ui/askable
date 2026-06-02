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
  rects?: WebContextRect[];
  selector?: string;
  pointerType?: string;
  capturedAt: string;
}

export type AskableTextSelectionCaptureStyle = Partial<CSSStyleDeclaration>;

export interface AskableTextSelectionCapturePromptOptions {
  /** Placeholder shown in the anchored prompt input. */
  placeholder?: string;
  /** Accessible label/title for the submit button. */
  submitLabel?: string;
  /** Class added to the prompt container. */
  className?: string;
  /** Inline styles applied to the prompt container. */
  style?: AskableTextSelectionCaptureStyle;
  /** Class added to the prompt input. */
  inputClassName?: string;
  /** Inline styles applied to the prompt input. */
  inputStyle?: AskableTextSelectionCaptureStyle;
  /** Class added to the prompt submit button. */
  buttonClassName?: string;
  /** Inline styles applied to the prompt submit button. */
  buttonStyle?: AskableTextSelectionCaptureStyle;
  /** Called when the user submits a non-empty prompt from the selected text. */
  onSubmit?: (
    question: string,
    packet: WebContextPacket,
    selection: AskableTextSelectionCaptureSelection,
  ) => void;
}

export interface AskableTextSelectionCaptureAffordanceOptions {
  /** Keep the selected text range visible after capture. Defaults to true when enabled. */
  persist?: boolean;
  /** Render a compact prompt input anchored to the selected text. Defaults to false. */
  prompt?: boolean | AskableTextSelectionCapturePromptOptions;
  /** Optional label shown beside the selected text. */
  label?: string;
  /** Class added to the selected-text affordance root. */
  className?: string;
  /** Inline styles applied to the selected-text affordance root. */
  style?: AskableTextSelectionCaptureStyle;
  /** Class added to the selected-text label. */
  labelClassName?: string;
  /** Inline styles applied to the selected-text label. */
  labelStyle?: AskableTextSelectionCaptureStyle;
  /** Replace the built-in selected-text affordance with consumer-rendered DOM. */
  render?: (
    packet: WebContextPacket,
    selection: AskableTextSelectionCaptureSelection,
  ) => HTMLElement | null | undefined | void;
}

export interface AskableTextSelectionCaptureTheme {
  /** Fill used for persisted selected text marks. */
  selectionFill: string;
  /** Outline used for persisted selected text marks. */
  selectionOutline: string;
  /** Shadow used for persisted selected text marks. */
  selectionShadow: string;
  /** Background color for the anchored prompt input. */
  promptBackground: string;
  /** Border color for the anchored prompt input. */
  promptBorder: string;
  /** Text color for the anchored prompt input. */
  promptText: string;
  /** Accent color for the anchored prompt submit button. */
  promptAccent: string;
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
  /** Visual theme for selected text marks and anchored prompts. */
  theme?: Partial<AskableTextSelectionCaptureTheme>;
  /** Opt-in selected-state UI shown after capture, optionally with an anchored prompt. */
  selectionAffordance?: boolean | AskableTextSelectionCaptureAffordanceOptions;
  /** Called after selected text is serialized to a Context packet. */
  onCapture?: (packet: WebContextPacket, selection: AskableTextSelectionCaptureSelection) => void;
  /** Called when active selection capture is cancelled. */
  onCancel?: () => void;
}

export interface AskableTextSelectionCaptureHandle {
  start(): void;
  captureNow(overrides?: Partial<AskableTextSelectionCaptureOptions>): WebContextPacket | null;
  cancel(): void;
  clearSelection(): void;
  destroy(): void;
  isActive(): boolean;
}

type LastInteraction = {
  gesture: WebContextGesture;
  pointerType?: string;
};

const DEFAULT_DEBOUNCE = 120;
const AFFORDANCE_ID = 'askable-text-selection-affordance';
const AFFORDANCE_ATTR = 'data-askable-text-selection-affordance';
export const ASKABLE_TEXT_SELECTION_CAPTURE_THEME: AskableTextSelectionCaptureTheme = {
  selectionFill: 'rgba(124,58,237,0.14)',
  selectionOutline: 'rgba(124,58,237,0.28)',
  selectionShadow: '0 8px 22px rgba(91,33,182,0.1)',
  promptBackground: '#ffffff',
  promptBorder: 'rgba(124,58,237,0.22)',
  promptText: '#111317',
  promptAccent: '#111317',
};

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
      clearSelection: () => undefined,
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
  const theme = resolveTextSelectionTheme(options.theme);
  const selectionAffordance = resolveSelectionAffordance(options.selectionAffordance);
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
          ...(selection.rects?.length ? { rectCount: selection.rects.length } : {}),
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

    renderSelectionAffordance(packet, selection);
    currentOptions.onCapture?.(packet, selection);
    if (currentOnce) stopListening();
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

  const removeAffordance = () => {
    ownerDocument.getElementById(AFFORDANCE_ID)?.remove();
  };

  function stopListening() {
    clearTimer();
    ownerDocument.removeEventListener('selectionchange', onSelectionChange);
    ownerDocument.removeEventListener('pointerup', onPointerUp);
    ownerDocument.removeEventListener('keyup', onKeyUp);
    active = false;
  }

  function destroy() {
    stopListening();
    removeAffordance();
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
    clearSelection: removeAffordance,
    destroy,
    isActive: () => active,
  };

  function renderSelectionAffordance(packet: WebContextPacket, selection: AskableTextSelectionCaptureSelection) {
    if (!selectionAffordance || selectionAffordance.persist === false || !selection.bounds) return;
    removeAffordance();

    const custom = selectionAffordance.render?.(packet, selection);
    if (custom instanceof HTMLElement) {
      custom.id = custom.id || AFFORDANCE_ID;
      custom.setAttribute(AFFORDANCE_ATTR, 'true');
      ownerDocument.body.appendChild(custom);
      return;
    }

    const rootEl = ownerDocument.createElement('div');
    rootEl.id = AFFORDANCE_ID;
    rootEl.setAttribute(AFFORDANCE_ATTR, 'true');
    if (selectionAffordance.className) rootEl.className = selectionAffordance.className;
    rootEl.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483645',
      'pointer-events:none',
      'box-sizing:border-box',
    ].join(';');
    assignStyles(rootEl, selectionAffordance.style);

    const rects = selection.rects?.length ? selection.rects : [selection.bounds];
    rects.forEach((rect) => rootEl.appendChild(createTextMark(rect)));
    if (selectionAffordance.label !== '') {
      rootEl.appendChild(createSelectionLabel(selectionAffordance.label ?? 'Selected text', selection.bounds));
    }

    const prompt = resolvePromptOptions(selectionAffordance.prompt);
    if (prompt) rootEl.appendChild(createPrompt(prompt, packet, selection));

    ownerDocument.body.appendChild(rootEl);
  }

  function createTextMark(rect: WebContextRect): HTMLSpanElement {
    const mark = ownerDocument.createElement('span');
    mark.style.cssText = [
      'position:fixed',
      `left:${Math.max(0, rect.x - 2)}px`,
      `top:${Math.max(0, rect.y - 1)}px`,
      `width:${Math.max(1, rect.width + 4)}px`,
      `height:${Math.max(1, rect.height + 2)}px`,
      'border-radius:7px',
      `background:${theme.selectionFill}`,
      `outline:1px solid ${theme.selectionOutline}`,
      `box-shadow:${theme.selectionShadow}`,
      'pointer-events:none',
    ].join(';');
    return mark;
  }

  function createSelectionLabel(label: string, bounds: WebContextRect): HTMLSpanElement {
    const el = ownerDocument.createElement('span');
    el.textContent = label;
    if (selectionAffordance?.labelClassName) el.className = selectionAffordance.labelClassName;
    el.style.cssText = [
      'position:fixed',
      `left:${bounds.x}px`,
      `top:${Math.max(8, bounds.y - 32)}px`,
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
    prompt: AskableTextSelectionCapturePromptOptions,
    packet: WebContextPacket,
    selection: AskableTextSelectionCaptureSelection,
  ): HTMLFormElement {
    const bounds = selection.bounds;
    const form = ownerDocument.createElement('form');
    if (prompt.className) form.className = prompt.className;
    const placeAbove = bounds ? bounds.y + bounds.height + 56 > window.innerHeight : false;
    form.style.cssText = [
      'position:fixed',
      `left:${bounds ? Math.max(8, Math.min(bounds.x, window.innerWidth - 240)) : 8}px`,
      bounds && placeAbove
        ? `top:${Math.max(8, bounds.y - 48)}px`
        : `top:${bounds ? Math.min(window.innerHeight - 48, bounds.y + bounds.height + 10) : 8}px`,
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

    const input = ownerDocument.createElement('input');
    input.type = 'text';
    input.placeholder = prompt.placeholder ?? 'Ask about this text...';
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

    const button = ownerDocument.createElement('button');
    button.type = 'submit';
    button.textContent = 'Ask';
    button.setAttribute('aria-label', prompt.submitLabel ?? 'Ask about selected text');
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
  const rects = rangeRects(range);
  const selector = selectorForRange(range);
  return {
    text,
    ...(bounds ? { bounds } : {}),
    ...(rects.length ? { rects } : {}),
    ...(selector ? { selector } : {}),
    ...(pointerType ? { pointerType } : {}),
    capturedAt: new Date().toISOString(),
  };
}

function rangeRects(range: Range): WebContextRect[] {
  if (typeof range.getClientRects !== 'function') return [];
  return Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0 || rect.height > 0)
    .map((rect) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }));
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

function resolveTextSelectionTheme(theme?: Partial<AskableTextSelectionCaptureTheme>): AskableTextSelectionCaptureTheme {
  return {
    ...ASKABLE_TEXT_SELECTION_CAPTURE_THEME,
    ...theme,
  };
}

function resolveSelectionAffordance(
  affordance?: boolean | AskableTextSelectionCaptureAffordanceOptions,
): AskableTextSelectionCaptureAffordanceOptions | null {
  if (!affordance) return null;
  if (affordance === true) return { persist: true };
  return { persist: affordance.persist ?? true, ...affordance };
}

function resolvePromptOptions(
  prompt?: boolean | AskableTextSelectionCapturePromptOptions,
): AskableTextSelectionCapturePromptOptions | null {
  if (!prompt) return null;
  if (prompt === true) return {};
  return prompt;
}

function assignStyles(element: HTMLElement, styles?: AskableTextSelectionCaptureStyle): void {
  if (!styles) return;
  Object.assign(element.style, styles);
}
