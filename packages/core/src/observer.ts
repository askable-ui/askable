import type { AskableFocus, AskableEvent, AskableTargetStrategy } from './types.js';

type FocusCallback = (focus: AskableFocus) => void;

const EVENT_MAP: Record<AskableEvent, string> = {
  click: 'click',
  hover: 'mouseenter',
  focus: 'focus',
};

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

export function buildFocus(el: HTMLElement, textExtractor?: (el: HTMLElement) => string): AskableFocus | null {
  const raw = el.getAttribute('data-askable');
  if (raw === null) return null;
  // data-askable-text overrides both textExtractor and default textContent extraction.
  // Set to an empty string ("") to suppress text entirely for a single element.
  const textOverride = el.getAttribute('data-askable-text');
  const text = textOverride !== null
    ? textOverride
    : textExtractor ? textExtractor(el) : extractText(el);
  return {
    source: 'dom',
    meta: parseMeta(raw),
    text,
    element: el,
    timestamp: Date.now(),
  };
}

const ALL_EVENTS: AskableEvent[] = ['click', 'hover', 'focus'];

export class Observer {
  private root: HTMLElement | Document | null = null;
  private mutationObserver: MutationObserver | null = null;
  private boundElements = new Set<HTMLElement>();
  private onFocus: FocusCallback;
  private textExtractor: ((el: HTMLElement) => string) | undefined;
  private activeEvents: AskableEvent[] = ALL_EVENTS;
  private targetStrategy: AskableTargetStrategy = 'deepest';
  private hoverDebounce = 0;
  private hoverThrottle = 0;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHoverTimestamp = 0;

  constructor(onFocus: FocusCallback, textExtractor?: (el: HTMLElement) => string) {
    this.onFocus = onFocus;
    this.textExtractor = textExtractor;
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
    this.targetStrategy = targetStrategy;
    this.hoverDebounce = hoverDebounce;
    this.hoverThrottle = hoverThrottle;
    this.lastHoverTimestamp = 0;

    const rootEl = root instanceof Document ? root.documentElement : root;
    rootEl.querySelectorAll<HTMLElement>('[data-askable]').forEach((el) => this.attach(el));

    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.hasAttribute('data-askable')) this.attach(node);
          node.querySelectorAll<HTMLElement>('[data-askable]').forEach((el) => this.attach(el));
        });
        mutation.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement) this.detachTree(node);
        });
      }
    });

    this.mutationObserver.observe(root, { childList: true, subtree: true });
  }

  unobserve(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    this.boundElements.forEach((el) => this.detach(el));
    this.boundElements.clear();
    this.root = null;
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

    const isHover = event.type === 'mouseenter';

    if (isHover && this.hoverDebounce > 0) {
      if (this.hoverTimer !== null) clearTimeout(this.hoverTimer);
      this.hoverTimer = setTimeout(() => {
        this.hoverTimer = null;
        const focus = buildFocus(el, this.textExtractor);
        if (focus) this.onFocus(focus);
      }, this.hoverDebounce);
      return;
    }

    if (isHover && this.hoverThrottle > 0) {
      const now = Date.now();
      if (now - this.lastHoverTimestamp < this.hoverThrottle) return;
      this.lastHoverTimestamp = now;
    }

    const focus = buildFocus(el, this.textExtractor);
    if (focus) this.onFocus(focus);
  };

  private attach(el: HTMLElement): void {
    if (this.boundElements.has(el)) return;
    this.activeEvents.forEach((e) => el.addEventListener(EVENT_MAP[e], this.handleInteraction));
    this.boundElements.add(el);
  }

  private detachTree(root: HTMLElement): void {
    this.detach(root);
    root.querySelectorAll<HTMLElement>('[data-askable]').forEach((el) => this.detach(el));
  }

  private detach(el: HTMLElement): void {
    this.activeEvents.forEach((e) => el.removeEventListener(EVENT_MAP[e], this.handleInteraction));
    this.boundElements.delete(el);
  }
}
