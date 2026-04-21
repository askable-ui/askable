import type { AskableFocus, AskableEvent, AskableFocusSegment, AskableTargetStrategy } from './types.js';

type FocusCallback = (focus: AskableFocus) => void;
type ObserverLifecycleCallbacks = {
  onAttach?: (el: HTMLElement) => void;
  onDetach?: (el: HTMLElement) => void;
};

const EVENT_MAP: Record<AskableEvent, string> = {
  click: 'click',
  hover: 'mouseenter',
  focus: 'focus',
};

function isTouchLikeEnvironment(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
  }

  return navigator.maxTouchPoints > 0;
}

function resolveDomEvents(events: AskableEvent[]): string[] {
  const touchLike = isTouchLikeEnvironment();
  const domEvents = new Set<string>();

  for (const event of events) {
    if (event === 'hover' && touchLike) {
      domEvents.add('click');
      continue;
    }

    domEvents.add(EVENT_MAP[event]);
  }

  return [...domEvents];
}

function isHoverInteraction(eventType: string, events: AskableEvent[]): boolean {
  if (eventType === 'mouseenter') return true;
  return eventType === 'click' && isTouchLikeEnvironment() && events.includes('hover') && !events.includes('click');
}

function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof MutationObserver !== 'undefined'
  );
}

function parseMeta(raw: string): Record<string, unknown> | string {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return raw;
  }
}

function extractText(el: HTMLElement): string {
  return (el.textContent ?? '').trim();
}

function resolveExplicitParent(el: HTMLElement): HTMLElement | null {
  const selector = el.getAttribute('data-askable-parent')?.trim();
  if (!selector) return null;
  const rootNode = el.getRootNode();
  const queryRoot = typeof (rootNode as ParentNode).querySelector === 'function'
    ? rootNode as ParentNode
    : document;
  const candidate = queryRoot.querySelector(selector);
  return candidate instanceof HTMLElement && candidate !== el && candidate.hasAttribute('data-askable')
    ? candidate
    : null;
}

type MetaCacheEntry = {
  raw: string;
  parsed: Record<string, unknown> | string;
};

function resolveMeta(
  el: HTMLElement,
  raw: string,
  metaCache?: WeakMap<HTMLElement, MetaCacheEntry>
): Record<string, unknown> | string {
  const cached = metaCache?.get(el);
  if (cached && cached.raw === raw) {
    return cached.parsed;
  }

  const parsed = parseMeta(raw);
  metaCache?.set(el, { raw, parsed });
  return parsed;
}

function buildFocusSegment(
  el: HTMLElement,
  textExtractor?: (el: HTMLElement) => string,
  metaCache?: WeakMap<HTMLElement, MetaCacheEntry>
): AskableFocusSegment | null {
  const raw = el.getAttribute('data-askable');
  if (raw === null) return null;
  const textOverride = el.getAttribute('data-askable-text');
  const text = textOverride !== null
    ? textOverride
    : textExtractor ? textExtractor(el) : extractText(el);
  const scope = el.getAttribute('data-askable-scope')?.trim() || undefined;

  return {
    meta: resolveMeta(el, raw, metaCache),
    ...(scope ? { scope } : {}),
    text,
  };
}

function resolveAncestorSegments(
  el: HTMLElement,
  textExtractor?: (el: HTMLElement) => string,
  metaCache?: WeakMap<HTMLElement, MetaCacheEntry>
): AskableFocusSegment[] {
  const segments: AskableFocusSegment[] = [];
  const visited = new Set<HTMLElement>([el]);
  let current: HTMLElement | null = el;

  while (current) {
    const explicitParent = resolveExplicitParent(current);
    const parent: HTMLElement | null = explicitParent ?? current.parentElement?.closest('[data-askable]') ?? null;
    if (!parent || visited.has(parent)) break;
    visited.add(parent);
    const segment = buildFocusSegment(parent, textExtractor, metaCache);
    if (segment) {
      segments.push(segment);
    }
    current = parent;
  }

  return segments.reverse();
}

export function buildFocus(
  el: HTMLElement,
  textExtractor?: (el: HTMLElement) => string,
  metaCache?: WeakMap<HTMLElement, MetaCacheEntry>
): AskableFocus | null {
  const segment = buildFocusSegment(el, textExtractor, metaCache);
  if (!segment) return null;
  const ancestors = resolveAncestorSegments(el, textExtractor, metaCache);
  return {
    source: 'dom',
    meta: segment.meta,
    ...(segment.scope ? { scope: segment.scope } : {}),
    ...(ancestors.length > 0 ? { ancestors } : {}),
    text: segment.text,
    element: el,
    timestamp: Date.now(),
  };
}

const ALL_EVENTS: AskableEvent[] = ['click', 'hover', 'focus'];
const OBSERVED_ATTRIBUTES = ['data-askable', 'data-askable-text', 'data-askable-priority', 'data-askable-scope', 'data-askable-parent', 'data-askable-events'] as const;

type AskableElementEventOverride = AskableEvent[] | 'manual' | null;

function parseElementEventOverride(el: HTMLElement): AskableElementEventOverride {
  const raw = el.getAttribute('data-askable-events');
  if (raw === null) return null;

  const normalized = raw.trim();
  if (!normalized) return null;
  if (normalized === 'manual') return 'manual';

  const values = normalized
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is AskableEvent => ALL_EVENTS.includes(value as AskableEvent));

  return values.length > 0 ? ALL_EVENTS.filter((event) => values.includes(event)) : null;
}

function resolveInteractionEvent(eventType: string, activeEvents: AskableEvent[]): AskableEvent | null {
  if (eventType === 'focus' && activeEvents.includes('focus')) return 'focus';
  if (isHoverInteraction(eventType, activeEvents)) return 'hover';
  if (eventType === 'click' && activeEvents.includes('click')) return 'click';
  return null;
}

export class Observer {
  private root: HTMLElement | Document | null = null;
  private mutationObserver: MutationObserver | null = null;
  private boundElements = new Set<HTMLElement>();
  private metaCache = new WeakMap<HTMLElement, MetaCacheEntry>();
  private onFocus: FocusCallback;
  private lifecycleCallbacks: ObserverLifecycleCallbacks;
  private textExtractor: ((el: HTMLElement) => string) | undefined;
  private activeEvents: AskableEvent[] = ALL_EVENTS;
  private targetStrategy: AskableTargetStrategy = 'deepest';
  private hoverDebounce = 0;
  private hoverThrottle = 0;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHoverTimestamp = 0;
  private activeDomEvents: string[] = [];

  constructor(
    onFocus: FocusCallback,
    textExtractor?: (el: HTMLElement) => string,
    lifecycleCallbacks: ObserverLifecycleCallbacks = {}
  ) {
    this.onFocus = onFocus;
    this.textExtractor = textExtractor;
    this.lifecycleCallbacks = lifecycleCallbacks;
  }

  observe(
    root: HTMLElement | Document,
    events: AskableEvent[] = ALL_EVENTS,
    hoverDebounce = 0,
    hoverThrottle = 0,
    targetStrategy: AskableTargetStrategy = 'deepest'
  ): void {
    if (!isBrowser()) return;
    if (this.root) this.unobserve();
    this.root = root;
    this.activeEvents = events;
    this.activeDomEvents = resolveDomEvents(events);
    this.targetStrategy = targetStrategy;
    this.hoverDebounce = hoverDebounce;
    this.hoverThrottle = hoverThrottle;
    this.lastHoverTimestamp = 0;

    const rootEl = root instanceof Document ? root.documentElement : root;
    rootEl.querySelectorAll<HTMLElement>('[data-askable]').forEach((el) => this.attach(el));

    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement) {
            this.handleAttributeMutation(target, mutation.attributeName);
          }
          continue;
        }
        mutation.addedNodes.forEach((node) => {
          if (!(typeof HTMLElement !== 'undefined' && node instanceof HTMLElement)) return;
          if (node.hasAttribute('data-askable')) this.attach(node);
          node.querySelectorAll<HTMLElement>('[data-askable]').forEach((el) => this.attach(el));
        });
        mutation.removedNodes.forEach((node) => {
          if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) this.detachTree(node);
        });
      }
    });

    this.mutationObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [...OBSERVED_ATTRIBUTES],
    });
  }

  unobserve(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    this.boundElements.forEach((el) => this.detach(el));
    this.boundElements.clear();
    this.metaCache = new WeakMap<HTMLElement, MetaCacheEntry>();
    this.root = null;
    this.activeDomEvents = [];
    if (this.hoverTimer !== null) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  private handleInteraction = (event: Event): void => {
    const el = event.currentTarget as HTMLElement;
    const target = event.target as HTMLElement;

    // Apply targetStrategy to decide which [data-askable] element handles the event.
    if (this.targetStrategy === 'exact') {
      // Only fire if the event target itself has [data-askable] — no bubbled triggers.
      if (!target.hasAttribute('data-askable') || target !== el) return;
    } else if (this.targetStrategy === 'shallowest') {
      // Outermost [data-askable] ancestor wins — skip if a bound ancestor exists.
      let ancestor = el.parentElement;
      while (ancestor) {
        if (this.boundElements.has(ancestor as HTMLElement)) return;
        ancestor = ancestor.parentElement;
      }
    } else {
      // 'deepest' (default): innermost wins. data-askable-priority overrides.
      if (target !== el) {
        // Event bubbled — check if a closer descendant should win.
        const closer = target.closest('[data-askable]');
        if (closer && closer !== el && el.contains(closer)) {
          const elPriority = parseInt(el.getAttribute('data-askable-priority') ?? '0', 10);
          const closerPriority = parseInt((closer as HTMLElement).getAttribute('data-askable-priority') ?? '0', 10);
          if (elPriority <= closerPriority) return;
        }
      } else {
        // Direct target — check if any ancestor has higher priority.
        const elPriority = parseInt(el.getAttribute('data-askable-priority') ?? '0', 10);
        let ancestor = el.parentElement;
        while (ancestor) {
          if (ancestor.hasAttribute('data-askable')) {
            const ancestorPriority = parseInt(ancestor.getAttribute('data-askable-priority') ?? '0', 10);
            if (ancestorPriority > elPriority) return;
          }
          ancestor = ancestor.parentElement;
        }
      }
    }

    const interactionEvent = resolveInteractionEvent(event.type, this.activeEvents);
    if (!interactionEvent) return;

    const elementEventOverride = parseElementEventOverride(el);
    if (elementEventOverride === 'manual') return;
    if (elementEventOverride && !elementEventOverride.includes(interactionEvent)) return;

    const isHover = interactionEvent === 'hover';

    if (isHover && this.hoverDebounce > 0) {
      if (this.hoverTimer !== null) clearTimeout(this.hoverTimer);
      this.hoverTimer = setTimeout(() => {
        this.hoverTimer = null;
        const focus = buildFocus(el, this.textExtractor, this.metaCache);
        if (focus) this.onFocus(focus);
      }, this.hoverDebounce);
      return;
    }

    if (isHover && this.hoverThrottle > 0) {
      const now = Date.now();
      if (now - this.lastHoverTimestamp < this.hoverThrottle) return;
      this.lastHoverTimestamp = now;
    }

    const focus = buildFocus(el, this.textExtractor, this.metaCache);
    if (focus) this.onFocus(focus);
  };

  private attach(el: HTMLElement): void {
    if (this.boundElements.has(el)) return;
    this.activeDomEvents.forEach((eventName) => el.addEventListener(eventName, this.handleInteraction));
    this.boundElements.add(el);
    this.lifecycleCallbacks.onAttach?.(el);
  }

  private handleAttributeMutation(el: HTMLElement, attributeName: string | null): void {
    if (attributeName === 'data-askable') {
      this.metaCache.delete(el);
      if (el.hasAttribute('data-askable')) {
        this.attach(el);
      } else {
        this.detach(el);
      }
      return;
    }

    if (!this.boundElements.has(el)) return;

    if (attributeName === 'data-askable-priority') {
      return;
    }

    if (attributeName === 'data-askable-text') {
      return;
    }
  }

  private detachTree(root: HTMLElement): void {
    this.detach(root);
    root.querySelectorAll<HTMLElement>('[data-askable]').forEach((el) => this.detach(el));
  }

  private detach(el: HTMLElement): void {
    this.activeDomEvents.forEach((eventName) => el.removeEventListener(eventName, this.handleInteraction));
    this.boundElements.delete(el);
    this.metaCache.delete(el);
    this.lifecycleCallbacks.onDetach?.(el);
  }
}
