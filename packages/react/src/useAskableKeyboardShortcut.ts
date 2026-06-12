import { useState, useEffect, useCallback, useRef } from 'react';
import type { AskableContext, AskableContextSourceInclude } from '@askable-ui/core';
import { useAskable } from './useAskable.js';
import type { UseAskableOptions } from './useAskable.js';

export interface UseAskableKeyboardShortcutOptions extends UseAskableOptions {
  /**
   * Keyboard shortcut to listen for. Modifiers are separated by `+`:
   * - `mod` — Cmd (⌘) on macOS, Ctrl on Windows/Linux
   * - `ctrl`, `shift`, `alt`, `meta`
   * Keys are case-insensitive.
   * @example "mod+k", "ctrl+shift+a", "alt+/"
   * @default "mod+k"
   */
  shortcut?: string;
  /**
   * Called when the shortcut fires. Receives the composed context string ready
   * to inject into an LLM prompt, plus the originating keyboard event.
   */
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
   * When true, `isOpen` is toggled automatically on each trigger.
   * Set to false when you manage your own open/close state.
   * @default false
   */
  toggle?: boolean;
  /**
   * Whether the listener is active.
   * @default true
   */
  enabled?: boolean;
  /**
   * Context sources to include when composing the trigger context.
   * Defaults to all registered sources.
   */
  sources?: AskableContextSourceInclude[];
  /**
   * Maximum tokens in the composed context string.
   * Passed to `ctx.toPromptContextAsync`.
   */
  maxTokens?: number;
}

export interface UseAskableKeyboardShortcutResult {
  /**
   * Whether the shortcut-triggered panel/overlay is in "open" state.
   * Only meaningful when `toggle: true` is set; otherwise always `false`.
   */
  isOpen: boolean;
  /** Programmatically set the open state. */
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  /**
   * The context string produced by the most recent shortcut trigger.
   * `null` before the shortcut has been pressed for the first time.
   */
  lastContext: string | null;
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
 * Listens for a keyboard shortcut and fires an async callback with the full
 * composed AI context — ready to send to any LLM. Defaults to Cmd+K (Mac) /
 * Ctrl+K (Windows/Linux).
 *
 * @example
 * ```tsx
 * // Open a chat panel pre-loaded with the current UI context
 * const { isOpen, setOpen, lastContext } = useAskableKeyboardShortcut({
 *   toggle: true,
 *   onTrigger: (context) => {
 *     // context is the full prompt-ready string from all registered sources
 *     console.log(context);
 *   },
 * });
 *
 * return isOpen ? <AIChatPanel context={lastContext} onClose={() => setOpen(false)} /> : null;
 * ```
 *
 * @example
 * ```tsx
 * // Custom shortcut with Vercel AI SDK
 * useAskableKeyboardShortcut({
 *   shortcut: 'mod+shift+a',
 *   onTrigger: async (context) => {
 *     await append({ role: 'user', content: context });
 *   },
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
  const [isOpen, setOpen] = useState(false);
  const [lastContext, setLastContext] = useState<string | null>(null);

  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  const parsedShortcut = useRef(parseShortcut(shortcut));
  parsedShortcut.current = parseShortcut(shortcut);

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if (!enabled) return;
      if (!matchesShortcut(e, parsedShortcut.current)) return;

      if (preventDefault) e.preventDefault();
      if (stopPropagation) e.stopPropagation();

      const context = await ctx.toPromptContextAsync({ sources, maxTokens });
      setLastContext(context);

      if (toggle) setOpen((prev) => !prev);

      onTriggerRef.current?.(context, e);
    },
    [ctx, enabled, preventDefault, stopPropagation, toggle, sources, maxTokens],
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  return { isOpen, setOpen, lastContext, ctx };
}
