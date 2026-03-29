export interface AskableFocus {
  /** Parsed data-askable attribute (JSON object or raw string) */
  meta: Record<string, unknown> | string;
  /** Trimmed textContent of the element */
  text: string;
  /** The DOM element itself */
  element: HTMLElement;
  /** Unix timestamp (ms) of when focus was set */
  timestamp: number;
}

export type AskableEventMap = {
  focus: AskableFocus;
};

export type AskableEventName = keyof AskableEventMap;

export type AskableEventHandler<K extends AskableEventName> = (
  payload: AskableEventMap[K]
) => void;

export type AskableEvent = 'click' | 'hover' | 'focus';

export interface AskableObserveOptions {
  /** Which interaction types trigger context updates. Defaults to all: ['click', 'hover', 'focus'] */
  events?: AskableEvent[];
}

export interface AskableContext {
  /** Observe a DOM subtree for [data-askable] elements */
  observe(root: HTMLElement | Document, options?: AskableObserveOptions): void;
  /** Stop observing and detach all listeners */
  unobserve(): void;
  /** Get the current focus context */
  getFocus(): AskableFocus | null;
  /** Subscribe to an event */
  on<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void;
  /** Unsubscribe from an event */
  off<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void;
  /** Programmatically select an element — use for explicit "Ask AI" buttons */
  select(element: HTMLElement): void;
  /** Serialize current focus to a natural language prompt string */
  toPromptContext(): string;
  /** Clean up all listeners and observers */
  destroy(): void;
}
