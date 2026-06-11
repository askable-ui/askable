import { Injectable, OnDestroy, signal, computed } from '@angular/core';
import type { AskableFocus } from '@askable-ui/core';

export interface AskableViewportServiceOptions {
  threshold?: number;
  root?: Element | null;
  scope?: string;
}

@Injectable()
export class AskableViewportService implements OnDestroy {
  readonly visibleItems = signal<AskableFocus[]>([]);

  readonly promptContext = computed(() => {
    const items = this.visibleItems();
    if (items.length === 0) return 'No visible elements tracked.';
    const lines = items.map((f) => {
      const meta = typeof f.meta === 'object' ? JSON.stringify(f.meta) : f.meta;
      return meta ? `- ${meta}` : `- ${f.text}`;
    });
    return `Visible UI elements:\n${lines.join('\n')}`;
  });

  private observer: IntersectionObserver | null = null;
  private mutationObserver: MutationObserver | null = null;

  /** Call from ngOnInit or ngAfterViewInit to start observing */
  observe(options?: AskableViewportServiceOptions): void {
    const threshold = options?.threshold ?? 0.1;
    const root = options?.root ?? null;
    const scope = options?.scope;

    this.disconnect();
    this.scan(root, scope);

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement;
          const raw = el.dataset['askable'];
          if (!raw) return;
          let meta: Record<string, unknown> | string = raw;
          try { meta = JSON.parse(raw); } catch { /* literal string */ }
          const elScope = el.dataset['askableScope'] ?? scope;
          const focus: AskableFocus = {
            element: el,
            meta,
            text: el.textContent?.trim() ?? '',
            source: 'dom',
            scope: elScope,
            timestamp: Date.now(),
          };
          this.visibleItems.update((prev) => {
            const without = prev.filter((f) => f.element !== el);
            return entry.isIntersecting ? [...without, focus] : without;
          });
        });
      },
      { threshold, root },
    );

    this.mutationObserver = new MutationObserver(() => this.scan(root, scope));
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  private scan(root: Element | null, scope: string | undefined): void {
    const container = root ?? document;
    const selector = scope
      ? `[data-askable][data-askable-scope="${scope}"]`
      : '[data-askable]';
    container.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      this.observer?.observe(el);
    });
  }

  /** Disconnect observers and clear state */
  disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    this.visibleItems.set([]);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
