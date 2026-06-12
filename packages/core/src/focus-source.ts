import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export interface AskableFocusedElementSnapshot {
  /** Tag name of the focused element (lowercase), or null if no element has focus. */
  tag: string | null;
  /** Element's id attribute, or null if absent. */
  id: string | null;
  /** Element's aria-label, or null if absent. */
  label: string | null;
  /** Element's role attribute or native role (inferred from tag). */
  role: string | null;
  /** Element's name attribute (useful for form fields). */
  name: string | null;
  /** Element's type attribute (for input elements). */
  type: string | null;
  /** Current value of input/textarea/select, or null for non-form elements. */
  value: string | null;
  /** CSS classes of the focused element. */
  classes: string[];
  /** Whether the focused element is a form input (input, select, textarea). */
  isFormField: boolean;
  /** Whether the focused element is interactive (button, a, input, select, textarea). */
  isInteractive: boolean;
}

export interface AskableFocusSourceSnapshot {
  /** Snapshot of the currently focused element, or null if nothing is focused. */
  focused: AskableFocusedElementSnapshot | null;
  /** Whether any element currently has focus. */
  hasFocus: boolean;
  /** Number of focus changes since tracking started. */
  focusChangeCount: number;
  /** ISO timestamp of the last focus change. */
  lastChangedAt: string | null;
}

export interface AskableCreateFocusSourceOptions {
  /**
   * Returns the current focus snapshot. Called on each resolve.
   * Framework hooks manage focusin/focusout events; this getter reads the result.
   */
  getSnapshot: () => AskableFocusSourceSnapshot | null;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskableFocusSourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "focus". */
  kind?: string;
}

const FORM_TAGS = new Set(['input', 'textarea', 'select']);
const INTERACTIVE_TAGS = new Set(['input', 'textarea', 'select', 'button', 'a', 'details', 'summary']);

export function elementToFocusSnapshot(el: Element): AskableFocusedElementSnapshot {
  const tag = el.tagName.toLowerCase();
  const htmlEl = el as HTMLElement & { value?: string; name?: string; type?: string };
  const isFormField = FORM_TAGS.has(tag);
  const isInteractive = INTERACTIVE_TAGS.has(tag) || el.hasAttribute('tabindex');

  return {
    tag,
    id: el.id || null,
    label: el.getAttribute('aria-label') ?? el.getAttribute('title') ?? null,
    role: el.getAttribute('role') ?? tag,
    name: htmlEl.name ?? null,
    type: htmlEl.type ?? null,
    value: isFormField && typeof htmlEl.value === 'string' ? htmlEl.value : null,
    classes: Array.from(el.classList),
    isFormField,
    isInteractive,
  };
}

function defaultDescribe(snap: AskableFocusSourceSnapshot): string {
  if (!snap.focused || !snap.hasFocus) return 'No element is focused.';

  const el = snap.focused;
  const parts: string[] = [];

  if (el.label) {
    parts.push(`Focused: ${el.label} (${el.tag})`);
  } else if (el.name) {
    parts.push(`Focused: ${el.name} (${el.tag})`);
  } else if (el.id) {
    parts.push(`Focused: #${el.id} (${el.tag})`);
  } else {
    parts.push(`Focused: <${el.tag}>`);
  }

  if (el.role && el.role !== el.tag) parts.push(`Role: ${el.role}`);
  if (el.type) parts.push(`Type: ${el.type}`);

  return parts.join(', ');
}

/**
 * Creates a focus context source that exposes which element currently has
 * keyboard focus to AI assistants — enabling them to understand what the user
 * is working on and provide field-specific assistance.
 *
 * @example
 * ```ts
 * // AI: "You're focused on the 'email' input field. Make sure to use a valid
 * //      email format — we noticed you've edited it 3 times already."
 * ```
 */
export function createAskableFocusSource(
  options: AskableCreateFocusSourceOptions,
): AskableContextSource {
  return createAskableSource({
    kind: options.kind ?? 'focus',
    describe: options.describe
      ? async () => {
          const snap = options.getSnapshot();
          if (!snap) return 'Focus state unavailable.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = options.getSnapshot();
          return snap ? defaultDescribe(snap) : 'Focus state unavailable.';
        },
    state: () => {
      const snap = options.getSnapshot();
      return {
        hasFocus: snap?.hasFocus ?? false,
        focusedTag: snap?.focused?.tag ?? null,
        focusedRole: snap?.focused?.role ?? null,
        isFormField: snap?.focused?.isFormField ?? false,
        focusChangeCount: snap?.focusChangeCount ?? 0,
      };
    },
    data: () => options.getSnapshot(),
  });
}
