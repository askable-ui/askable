import { ref, onMounted, onUnmounted, type MaybeRef, toValue } from 'vue';
import type { AskableContext, AskableContextSourceInclude } from '@askable-ui/core';
import { useAskable } from './useAskable.js';
import type { UseAskableOptions, UseAskableResult } from './useAskable.js';

export interface UseAskableKeyboardShortcutOptions extends UseAskableOptions {
  /**
   * Keyboard shortcut. Modifiers separated by `+`:
   * - `mod` — Cmd (⌘) on macOS, Ctrl on Windows/Linux
   * - `ctrl`, `shift`, `alt`, `meta`
   * @example "mod+k", "ctrl+shift+a", "alt+/"
   * @default "mod+k"
   */
  shortcut?: MaybeRef<string>;
  /** Called when the shortcut fires with the composed context string. */
  onTrigger?: (context: string, event: KeyboardEvent) => void;
  /**
   * Prevents the default browser action for the shortcut.
   * @default true
   */
  preventDefault?: MaybeRef<boolean>;
  /**
   * Stops event propagation when the shortcut fires.
   * @default false
   */
  stopPropagation?: MaybeRef<boolean>;
  /**
   * Toggles `isOpen` automatically on each trigger.
   * @default false
   */
  toggle?: MaybeRef<boolean>;
  /**
   * Whether the listener is active.
   * @default true
   */
  enabled?: MaybeRef<boolean>;
  /** Context sources to include when composing the trigger context. */
  sources?: AskableContextSourceInclude[];
  /** Maximum tokens in the composed context string. */
  maxTokens?: number;
}

export interface UseAskableKeyboardShortcutResult {
  /** Whether the shortcut panel is "open" (only meaningful with `toggle: true`). */
  isOpen: ReturnType<typeof ref<boolean>>;
  /** Programmatically set the open state. */
  setOpen: (open: boolean) => void;
  /** Context string from the last trigger, or `null` before first press. */
  lastContext: ReturnType<typeof ref<string | null>>;
  ctx: AskableContext;
}

interface ParsedShortcut {
  key: string;
  mod: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1));
  return {
    key,
    mod: mods.has('mod'),
    ctrl: mods.has('ctrl'),
    shift: mods.has('shift'),
    alt: mods.has('alt'),
    meta: mods.has('meta'),
  };
}

function matchesShortcut(e: KeyboardEvent, parsed: ParsedShortcut): boolean {
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
  const modPressed = isMac ? e.metaKey : e.ctrlKey;

  if (parsed.mod && !modPressed) return false;
  if (parsed.ctrl && !e.ctrlKey) return false;
  if (parsed.shift && !e.shiftKey) return false;
  if (parsed.alt && !e.altKey) return false;
  if (parsed.meta && !e.metaKey) return false;
  if (!parsed.mod && !parsed.ctrl && !parsed.meta && (e.ctrlKey || e.metaKey)) return false;

  return e.key.toLowerCase() === parsed.key;
}

/**
 * Vue composable that listens for a keyboard shortcut and fires with the full
 * composed AI context — ready to send to any LLM. Defaults to Cmd+K / Ctrl+K.
 *
 * @example
 * ```ts
 * const { isOpen, lastContext } = useAskableKeyboardShortcut({
 *   toggle: true,
 *   onTrigger: (context) => console.log(context),
 * });
 * ```
 */
export function useAskableKeyboardShortcut(
  options: UseAskableKeyboardShortcutOptions = {},
): UseAskableKeyboardShortcutResult {
  const {
    shortcut = 'mod+k',
    onTrigger,
    preventDefault = true,
    stopPropagation = false,
    toggle = false,
    enabled = true,
    sources,
    maxTokens,
    ...askableOptions
  } = options;

  const { ctx } = useAskable(askableOptions) as UseAskableResult;
  const isOpen = ref(false);
  const lastContext = ref<string | null>(null);

  const handleKeyDown = async (e: KeyboardEvent) => {
    if (!toValue(enabled)) return;

    const parsed = parseShortcut(toValue(shortcut));
    if (!matchesShortcut(e, parsed)) return;

    if (toValue(preventDefault)) e.preventDefault();
    if (toValue(stopPropagation)) e.stopPropagation();

    const context = await ctx.toPromptContextAsync({ sources, maxTokens });
    lastContext.value = context;

    if (toValue(toggle)) isOpen.value = !isOpen.value;

    onTrigger?.(context, e);
  };

  onMounted(() => window.addEventListener('keydown', handleKeyDown));
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));

  const setOpen = (open: boolean) => {
    isOpen.value = open;
  };

  return { isOpen, setOpen, lastContext, ctx };
}
