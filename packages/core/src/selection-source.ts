import { createAskableSource } from './sources.js';
import type { AskableContextSource } from './types.js';

export interface AskableSelectionSourceSnapshot {
  /** The currently selected text, or null if nothing is selected. */
  selectedText: string | null;
  /** Number of characters selected. */
  length: number;
  /** True when text is currently selected. */
  hasSelection: boolean;
  /** The containing element's tag name, if available. */
  containerTag: string | null;
  /** The containing element's id attribute, if available. */
  containerId: string | null;
  /** Trimmed text immediately before the selection (up to `surroundingChars` chars). */
  precedingText: string | null;
  /** Trimmed text immediately after the selection (up to `surroundingChars` chars). */
  followingText: string | null;
}

export interface AskableCreateSelectionSourceOptions {
  /**
   * Custom function that returns the selection. Defaults to `window.getSelection()`.
   */
  getSelection?: () => Selection | null;
  /**
   * Maximum characters to include in selectedText.
   * @default 5000
   */
  maxLength?: number;
  /**
   * Characters of surrounding context to include before and after the selection.
   * Set to 0 to disable surrounding context.
   * @default 200
   */
  surroundingChars?: number;
  /** Custom describe function. */
  describe?: (snapshot: AskableSelectionSourceSnapshot) => string;
  /** Source category. Defaults to "selection". */
  kind?: string;
}

function getAnchorElement(selection: Selection): Element | null {
  const node = selection.anchorNode;
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
}

function getSurrounding(
  selection: Selection,
  chars: number,
): { precedingText: string | null; followingText: string | null } {
  if (chars <= 0) return { precedingText: null, followingText: null };

  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  if (!range) return { precedingText: null, followingText: null };

  try {
    const container = range.commonAncestorContainer;
    const fullText = container.textContent ?? '';
    const selStart = range.startOffset;
    const selEnd = range.endOffset;

    const preceding = fullText.slice(Math.max(0, selStart - chars), selStart).trimStart();
    const following = fullText.slice(selEnd, selEnd + chars).trimEnd();

    return {
      precedingText: preceding || null,
      followingText: following || null,
    };
  } catch {
    return { precedingText: null, followingText: null };
  }
}

function buildSnapshot(
  options: AskableCreateSelectionSourceOptions,
): AskableSelectionSourceSnapshot {
  const maxLength = options.maxLength ?? 5000;
  const surroundingChars = options.surroundingChars ?? 200;

  const resolveSelection = options.getSelection ?? (() =>
    typeof window !== 'undefined' ? window.getSelection() : null);

  const selection = resolveSelection();
  const rawText = selection?.toString() ?? '';
  const hasSelection = rawText.length > 0;

  if (!hasSelection || !selection) {
    return {
      selectedText: null,
      length: 0,
      hasSelection: false,
      containerTag: null,
      containerId: null,
      precedingText: null,
      followingText: null,
    };
  }

  const selectedText = rawText.length > maxLength
    ? rawText.slice(0, maxLength) + '…'
    : rawText;

  const anchorEl = getAnchorElement(selection);
  const surrounding = getSurrounding(selection, surroundingChars);

  return {
    selectedText,
    length: rawText.length,
    hasSelection: true,
    containerTag: anchorEl?.tagName?.toLowerCase() ?? null,
    containerId: anchorEl?.id || null,
    ...surrounding,
  };
}

function defaultDescribe(snapshot: AskableSelectionSourceSnapshot): string {
  if (!snapshot.hasSelection || !snapshot.selectedText) {
    return 'No text currently selected.';
  }

  const lines: string[] = [];

  if (snapshot.containerTag) {
    const ctx = snapshot.containerId
      ? `${snapshot.containerTag}#${snapshot.containerId}`
      : snapshot.containerTag;
    lines.push(`Selected in: <${ctx}>`);
  }

  lines.push(`Selected text (${snapshot.length} chars):\n${snapshot.selectedText}`);

  if (snapshot.precedingText || snapshot.followingText) {
    lines.push('\nContext:');
    if (snapshot.precedingText) lines.push(`Before: …${snapshot.precedingText}`);
    if (snapshot.followingText) lines.push(`After: ${snapshot.followingText}…`);
  }

  return lines.join('\n');
}

/**
 * Creates a text selection context source that exposes what the user has
 * currently selected on the page — selected text, surrounding context,
 * and the containing element — so AI assistants can reference the exact
 * content the user is highlighting without any additional UI.
 *
 * @example
 * ```ts
 * const source = createAskableSelectionSource({ maxLength: 2000 });
 * ctx.registerSource('selection', source);
 *
 * // Notify when selection changes
 * document.addEventListener('selectionchange', () => handle.notifyChanged());
 * ```
 */
export function createAskableSelectionSource(
  options: AskableCreateSelectionSourceOptions = {},
): AskableContextSource {
  const { describe, kind = 'selection' } = options;

  return createAskableSource({
    kind,
    describe: describe
      ? () => describe(buildSnapshot(options))
      : () => defaultDescribe(buildSnapshot(options)),
    state: () => {
      const snapshot = buildSnapshot(options);
      return {
        hasSelection: snapshot.hasSelection,
        length: snapshot.length,
      };
    },
    data: () => {
      const snapshot = buildSnapshot(options);
      return snapshot.hasSelection ? snapshot : null;
    },
  });
}
