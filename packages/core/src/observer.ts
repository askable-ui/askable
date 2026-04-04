import type { AskableFocus, AskableEvent } from './types.js';

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

export function buildFocus(el: HTMLElement): AskableFocus | null {
  const raw = el.getAttribute('data-askable');
  if (raw === null) return null;
  return {
    meta: parseMeta(raw),
    text: extractText(el),
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
  private activeEvents: AskableEvent[] = ALL_EVENTS;
  private hoverDebounce = 0;
  private hoverThrottle = 0;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHoverTimestamp = 0;

  constructor(onFocus: FocusCallback) {
    this.onFocus = onFocus;
  }

  observe(
    root: HTMLElement | Document,
    events: AskableEvent[] = ALL_EVENTS,
    hoverDebounce = 0,
    hoverThrottle = 0
  ): void {
    if (!isBrowser()) return;
    if (this.root) this.unobserve();
    this.root = root;
    this.activeEvents = events;
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
          if (node instanceof HTMLElement) this.detach(node);
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

    // Nested element priority: when a click/hover reaches a parent [data-askable],
    // check if the actual target is inside a closer (nested) askable descendant that
    // is also bound. If so, skip — the inner element takes precedence.
    const target = event.target as HTMLElement;
    if (target !== el) {
      const closer = target.closest('[data-askable]');
      if (closer && closer !== el && el.contains(closer)) return;
    }

    const isHover = event.type === 'mouseenter';

    if (isHover && this.hoverDebounce > 0) {
      if (this.hoverTimer !== null) clearTimeout(this.hoverTimer);
      this.hoverTimer = setTimeout(() => {
        this.hoverTimer = null;
        const focus = buildFocus(el);
        if (focus) this.onFocus(focus);
      }, this.hoverDebounce);
      return;
    }

    if (isHover && this.hoverThrottle > 0) {
      const now = Date.now();
      if (now - this.lastHoverTimestamp < this.hoverThrottle) return;
      this.lastHoverTimestamp = now;
    }

    const focus = buildFocus(el);
    if (focus) this.onFocus(focus);
  };

  private attach(el: HTMLElement): void {
    if (this.boundElements.has(el)) return;
    this.activeEvents.forEach((e) => el.addEventListener(EVENT_MAP[e], this.handleInteraction));
    this.boundElements.add(el);
  }

  private detach(el: HTMLElement): void {
    this.activeEvents.forEach((e) => el.removeEventListener(EVENT_MAP[e], this.handleInteraction));
    this.boundElements.delete(el);
  }
}
