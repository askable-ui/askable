import { createSignal, createEffect, onCleanup } from 'solid-js';
import type { AskableContext, AskableContextSourceInclude } from '@askable-ui/core';
import { useAskable } from './useAskable.js';
import type { UseAskableOptions } from './useAskable.js';

export interface UseAskableKeyboardShortcutOptions extends UseAskableOptions {
  /**
   * Keyboard shortcut. Modifiers separated by `+`:
   * - `mod` — Cmd (⌘) on macOS, Ctrl on Windows/Linux
   * - `ctrl`, `shift`, `alt`, `meta`
   * @example "mod+k", "ctrl+shift+a", "alt+/"
   * @default "mod+k"
   */
  shortcut?: string | (() => string);
  /** Called when the shortcut fires with the composed context string. */
  onTrigger?: (context: string, event: KeyboardEvent) => void;
  /**
   * Prevents the default browser action for the shortcut.
   * @default true
   */
  preventDefault?: boolean;
  /**
   * Stops event propagation when the shortcut fires.
   * @default false
   */
  stopPropagation?: boolean;
  /**
   * Toggles `isOpen` automatically on each trigger.
   * @default false
   */
  toggle?: boolean;
  /**
   * Whether the listener is active.
   * @default true
   */
  enabled?: boolean | (() => boolean);
  /** Context sources to include when composing the trigger context. */
  sources?: AskableContextSourceInclude[];
  /** Maximum tokens in the composed context string. */
  maxTokens?: number;
}

export interface UseAskableKeyboardShortcutResult {
  /** Whether the panel is "open" (only meaningful with `toggle: true`). */
  isOpen: () => boolean;
  /** Programmatically set the open state. */
  setOpen: (open: boolean) => void;
  /** Accessor for the context string from the last trigger. */
  lastContext: () => string | null;
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
 * SolidJS primitive that listens for a keyboard shortcut and fires with the full
 * composed AI context — ready to send to any LLM. Defaults to Cmd+K / Ctrl+K.
 *
 * @example
 * ```tsx
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

  const { ctx } = useAskable(askableOptions);
  const [isOpen, setOpen] = createSignal(false);
  const [lastContext, setLastContext] = createSignal<string | null>(null);

  const resolveEnabled = () => (typeof enabled === 'function' ? enabled() : enabled);
  const resolveShortcut = () => (typeof shortcut === 'function' ? shortcut() : shortcut);

  createEffect(() => {
    const active = resolveEnabled();
    if (!active) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      const parsed = parseShortcut(resolveShortcut());
      if (!matchesShortcut(e, parsed)) return;

      if (preventDefault) e.preventDefault();
      if (stopPropagation) e.stopPropagation();

      const context = await ctx.toPromptContextAsync({ sources, maxTokens });
      setLastContext(context);

      if (toggle) setOpen((prev) => !prev);

      onTrigger?.(context, e);
    };

    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  return { isOpen, setOpen, lastContext, ctx };
}
