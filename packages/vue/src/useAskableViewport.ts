import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { AskableFocus } from '@askable-ui/core';

export interface UseAskableViewportOptions {
  /**
   * Root element to observe for [data-askable] children.
   * Defaults to `document.documentElement`.
   */
  root?: HTMLElement;
  /**
   * IntersectionObserver threshold — fraction of element that must be visible.
   * @default 0.1
   */
  threshold?: number | number[];
  /**
   * Only include elements whose `scope` matches this value.
   * Scope is read from `data-askable-scope` or the `scope` key inside `data-askable`.
   */
  scope?: string;
}

export interface UseAskableViewportResult {
  /** All [data-askable] elements currently intersecting the viewport */
  visibleItems: ReturnType<typeof ref<AskableFocus[]>>;
  /**
   * Prompt-ready string listing visible elements.
   * Inject directly into your system prompt or AI message.
   */
  promptContext: ReturnType<typeof computed<string>>;
}

function parseElementMeta(el: HTMLElement): Record<string, unknown> | string {
  const raw = el.dataset.askable;
  if (!raw) return '';
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return raw;
  }
}

function getElementScope(el: HTMLElement, meta: Record<string, unknown> | string): string | undefined {
  if (el.dataset.askableScope) return el.dataset.askableScope;
  if (typeof meta === 'object' && meta !== null && typeof meta.scope === 'string') return meta.scope;
  return undefined;
}

function buildItem(el: HTMLElement): AskableFocus {
  const meta = parseElementMeta(el);
  return {
    source: 'dom',
    meta,
    scope: getElementScope(el, meta),
    text: el.textContent?.trim() ?? '',
    element: el,
    timestamp: Date.now(),
  };
}

export function useAskableViewport(options?: UseAskableViewportOptions) {
  const visibleItems = ref<AskableFocus[]>([]);

  const promptContext = computed(() => {
    const items = visibleItems.value;
    if (!items.length) return 'No annotated elements are currently visible in the viewport.';
    const lines = items.map((item) => {
      const meta = typeof item.meta === 'string' ? item.meta : JSON.stringify(item.meta);
      const text = item.text ? ` "${item.text.slice(0, 120)}"` : '';
      return `- ${meta}${text}`;
    });
    return `Visible UI elements:\n${lines.join('\n')}`;
  });

  let intersectionObserver: IntersectionObserver | null = null;
  let mutationObserver: MutationObserver | null = null;
  const visible = new Map<HTMLElement, AskableFocus>();

  const flush = () => {
    const scope = options?.scope;
    visibleItems.value = Array.from(visible.values()).filter(
      (item) => !scope || item.scope === scope,
    );
  };

  const observeAll = (root: HTMLElement) => {
    root.querySelectorAll<HTMLElement>('[data-askable]').forEach((el) => {
      intersectionObserver?.observe(el);
    });
  };

  onMounted(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

    const root = options?.root ?? document.documentElement;

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        let changed = false;
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            visible.set(el, buildItem(el));
            changed = true;
          } else if (visible.has(el)) {
            visible.delete(el);
            changed = true;
          }
        }
        if (changed) flush();
      },
      { threshold: options?.threshold ?? 0.1 },
    );

    observeAll(root);

    mutationObserver = new MutationObserver((records) => {
      let needsReScan = false;
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          const targets = node.hasAttribute('data-askable')
            ? [node]
            : Array.from(node.querySelectorAll<HTMLElement>('[data-askable]'));
          for (const el of targets) {
            if (visible.has(el)) {
              visible.delete(el);
              intersectionObserver?.unobserve(el);
              needsReScan = true;
            }
          }
        }
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.hasAttribute('data-askable') || node.querySelector('[data-askable]')) {
            needsReScan = true;
          }
        }
      }
      if (needsReScan) {
        observeAll(root);
        flush();
      }
    });

    mutationObserver.observe(root, { childList: true, subtree: true });
  });

  onUnmounted(() => {
    intersectionObserver?.disconnect();
    mutationObserver?.disconnect();
    intersectionObserver = null;
    mutationObserver = null;
    visible.clear();
  });

  return { visibleItems, promptContext };
}
