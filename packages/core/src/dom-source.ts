import { createAskableSource } from './sources.js';
import type { AskableContextSource } from './types.js';

export interface AskableDOMSnapshot {
  /** Tag name of the element (lowercase). */
  tag: string;
  /** Trimmed text content of the element. */
  text: string;
  /** Element's aria-label, aria-labelledby text, or title attribute. */
  label: string | null;
  /** aria-role or native role. */
  role: string | null;
  /** HTML id attribute. */
  id: string | null;
  /** CSS class list as an array. */
  classes: string[];
  /** Data attributes as a key-value map (keys without the "data-" prefix). */
  data: Record<string, string>;
  /** Selected subset of attributes to include (from includeAttributes option). */
  attributes: Record<string, string>;
  /** Number of direct children. */
  childCount: number;
}

export interface AskableCreateDOMSourceOptions {
  /**
   * Function that returns the target element (or null/undefined when not mounted).
   * Use this to pass a ref getter rather than a static element.
   */
  getElement: () => Element | null | undefined;
  /**
   * Specific attribute names to include in the snapshot.
   * Common uses: `['href', 'src', 'value', 'placeholder', 'disabled']`
   * @default []
   */
  includeAttributes?: string[];
  /**
   * When true, the snapshot includes the full `innerHTML`.
   * Use with caution — may expose sensitive content.
   * @default false
   */
  includeHTML?: boolean;
  /**
   * Truncate text content to this length.
   * @default 2000
   */
  maxTextLength?: number;
  /**
   * Custom describe function. Receives the snapshot and returns a prompt string.
   */
  describe?: (snapshot: AskableDOMSnapshot) => string;
  /** Source category. Defaults to "dom". */
  kind?: string;
}

function buildSnapshot(
  el: Element,
  options: AskableCreateDOMSourceOptions,
): AskableDOMSnapshot {
  const { includeAttributes = [], maxTextLength = 2000 } = options;

  const text = (el.textContent ?? '').trim().slice(0, maxTextLength);
  const label =
    el.getAttribute('aria-label') ??
    el.getAttribute('title') ??
    el.getAttribute('placeholder') ??
    null;

  const role = el.getAttribute('role') ?? (el as HTMLElement).tagName.toLowerCase() ?? null;
  const id = el.id || null;
  const classes = Array.from(el.classList);

  const data: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('data-')) {
      data[attr.name.slice(5)] = attr.value;
    }
  }

  const attributes: Record<string, string> = {};
  for (const name of includeAttributes) {
    const value = el.getAttribute(name);
    if (value !== null) attributes[name] = value;
  }

  return {
    tag: el.tagName.toLowerCase(),
    text,
    label,
    role,
    id,
    classes,
    data,
    attributes,
    childCount: el.children.length,
  };
}

function defaultDescribe(snapshot: AskableDOMSnapshot): string {
  const parts: string[] = [`Element: <${snapshot.tag}>`];

  if (snapshot.label) parts.push(`Label: ${snapshot.label}`);
  if (snapshot.role && snapshot.role !== snapshot.tag) parts.push(`Role: ${snapshot.role}`);
  if (snapshot.id) parts.push(`Id: ${snapshot.id}`);
  if (snapshot.text) parts.push(`Content: ${snapshot.text.slice(0, 200)}`);

  if (Object.keys(snapshot.attributes).length > 0) {
    parts.push(`Attributes: ${Object.entries(snapshot.attributes).map(([k, v]) => `${k}="${v}"`).join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Creates a DOM context source that extracts text content, labels, roles,
 * data attributes, and selected attributes from any element, making it
 * available to AI assistants as structured context.
 *
 * Useful for capturing the content of rich text editors, data grids,
 * custom widgets, or any DOM element that doesn't have dedicated source support.
 *
 * @example
 * ```ts
 * // Capture a rich text editor's content
 * const editorSource = createAskableDOMSource({
 *   getElement: () => editorRef.current,
 *   includeAttributes: ['contenteditable', 'data-format'],
 *   maxTextLength: 5000,
 * });
 * ctx.registerSource('editor', editorSource);
 *
 * // Capture a custom chart widget
 * const chartSource = createAskableDOMSource({
 *   getElement: () => chartContainerRef.current,
 *   describe: (snap) => `Chart showing: ${snap.data.title || 'unknown'}`,
 * });
 * ctx.registerSource('chart', chartSource);
 * ```
 */
export function createAskableDOMSource(
  options: AskableCreateDOMSourceOptions,
): AskableContextSource {
  const { getElement, describe, kind = 'dom' } = options;

  return createAskableSource({
    kind,
    describe: describe
      ? () => {
          const el = getElement();
          if (!el) return 'Element not available.';
          return describe(buildSnapshot(el, options));
        }
      : () => {
          const el = getElement();
          if (!el) return 'Element not available.';
          return defaultDescribe(buildSnapshot(el, options));
        },
    state: () => {
      const el = getElement();
      if (!el) return { available: false };
      return {
        available: true,
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        childCount: el.children.length,
      };
    },
    data: () => {
      const el = getElement();
      if (!el) return null;
      return buildSnapshot(el, options);
    },
  });
}
