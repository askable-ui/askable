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

/**
 * Svelte 5 runes-based composable for viewport-aware context.
 *
 * Tracks all [data-askable] elements currently visible in the viewport
 * via IntersectionObserver. Must be used inside a Svelte component or
 * `.svelte.ts` file.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableViewport } from '@askable-ui/svelte/useAskableViewport.svelte';
 *   const vp = useAskableViewport();
 * </script>
 *
 * <p>{vp.promptContext}</p>
 * <p>{vp.visibleItems.length} elements in view</p>
 * ```
 */
export function useAskableViewport(options?: UseAskableViewportOptions) {
  const visible = new Map<HTMLElement, AskableFocus>();
  let visibleItems: AskableFocus[] = $state([]);

  const promptContext = $derived(
    visibleItems.length === 0
      ? 'No annotated elements are currently visible in the viewport.'
      : `Visible UI elements:\n${visibleItems
          .map((item) => {
            const meta = typeof item.meta === 'string' ? item.meta : JSON.stringify(item.meta);
            const text = item.text ? ` "${item.text.slice(0, 120)}"` : '';
            return `- ${meta}${text}`;
          })
          .join('\n')}`,
  );

  $effect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

    const root = options?.root ?? document.documentElement;
    const scope = options?.scope;

    const flush = () => {
      visibleItems = Array.from(visible.values()).filter(
        (item) => !scope || item.scope === scope,
      );
    };

    const intersectionObserver = new IntersectionObserver(
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

    const observeAll = () => {
      root.querySelectorAll<HTMLElement>('[data-askable]').forEach((el) => {
        intersectionObserver.observe(el);
      });
    };
    observeAll();

    const mutationObserver = new MutationObserver((records) => {
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
              intersectionObserver.unobserve(el);
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
        observeAll();
        flush();
      }
    });

    mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      intersectionObserver.disconnect();
      mutationObserver.disconnect();
      visible.clear();
    };
  });

  return {
    get visibleItems() { return visibleItems; },
    get promptContext() { return promptContext; },
  };
}
