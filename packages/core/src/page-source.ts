import type {
  AskableContextSource,
  AskableContextSourceResolveRequest,
} from './types.js';

export interface AskablePageSourceHeading {
  level: number;
  text: string;
}

export interface AskablePageSourceLink {
  text: string;
  href: string;
}

export interface AskablePageSourceSnapshot {
  title?: string;
  url?: string;
  selectedText?: string;
  text?: string;
  headings?: AskablePageSourceHeading[];
  links?: AskablePageSourceLink[];
  truncated?: boolean;
}

export interface AskableCreatePageSourceOptions {
  /** Root document or element to read from. Defaults to global document. */
  root?: Document | HTMLElement;
  /** Human-readable source description. Defaults to "Current page". */
  describe?: string | (() => string | Promise<string>);
  /** Source category. Defaults to "page". */
  kind?: string;
  /** Include links in resolved snapshots. Defaults to false. */
  includeLinks?: boolean;
  /** Maximum links returned when includeLinks is true. Defaults to 20. */
  maxLinks?: number;
  /** Maximum headings returned. Defaults to 20. */
  maxHeadings?: number;
  /** Maximum body text characters returned for mode "all". Defaults to 8000. */
  maxTextLength?: number;
  /** Override how page text is extracted from the root. */
  textExtractor?: (root: Document | HTMLElement) => string;
  /** Redact or transform extracted page and selection text. */
  sanitizeText?: (text: string) => string;
}

/**
 * Create a source that snapshots page text, selection, headings, and optional links.
 *
 * This is useful for browser extensions or fallback integrations that need
 * context from pages that have not added Askable annotations.
 *
 * @example
 * ctx.registerSource('page', createAskablePageSource({ includeLinks: true }));
 */
export function createAskablePageSource(options: AskableCreatePageSourceOptions = {}): AskableContextSource {
  return {
    kind: options.kind ?? 'page',
    modes: ['state', 'summary', 'selected', 'all'],
    describe: options.describe ?? 'Current page',
    getState: () => {
      const root = resolveRoot(options.root);
      if (!root) return undefined;
      const doc = rootToDocument(root);
      const selectedText = readSelection(doc, options);
      return {
        title: doc.title || undefined,
        url: doc.location?.href,
        ...(selectedText ? { selectedTextLength: selectedText.length } : {}),
      };
    },
    resolve: (request) => resolvePageSnapshot(request, options),
  };
}

function resolvePageSnapshot(
  request: AskableContextSourceResolveRequest,
  options: AskableCreatePageSourceOptions,
): AskablePageSourceSnapshot | undefined {
  const root = resolveRoot(options.root);
  if (!root) return undefined;

  const doc = rootToDocument(root);
  const selectedText = readSelection(doc, options);
  const maxItems = request.maxItems;

  if (request.mode === 'selected') {
    return {
      title: doc.title || undefined,
      url: doc.location?.href,
      ...(selectedText ? { selectedText } : {}),
    };
  }

  const snapshot: AskablePageSourceSnapshot = {
    title: doc.title || undefined,
    url: doc.location?.href,
    ...(selectedText ? { selectedText } : {}),
    headings: readHeadings(root, options, maxItems),
  };

  if (options.includeLinks) {
    snapshot.links = readLinks(root, options, maxItems);
  }

  if (request.mode === 'all') {
    const { text, truncated } = readPageText(root, options, request.maxTokens);
    snapshot.text = text;
    snapshot.truncated = truncated;
  }

  return snapshot;
}

function resolveRoot(root: Document | HTMLElement | undefined): Document | HTMLElement | undefined {
  if (root) return root;
  return typeof document === 'undefined' ? undefined : document;
}

function rootToDocument(root: Document | HTMLElement): Document {
  return isDocument(root) ? root : root.ownerDocument;
}

function readSelection(
  doc: Document,
  options: AskableCreatePageSourceOptions,
): string | undefined {
  const selection = doc.getSelection?.()?.toString().trim();
  if (!selection) return undefined;
  return sanitizeText(selection, options);
}

function readPageText(
  root: Document | HTMLElement,
  options: AskableCreatePageSourceOptions,
  maxTokens?: number,
): { text: string; truncated: boolean } {
  const raw = options.textExtractor
    ? options.textExtractor(root)
    : defaultText(root);
  const text = normalizeWhitespace(sanitizeText(raw, options));
  const maxChars = Math.max(0, Math.min(
    options.maxTextLength ?? 8000,
    maxTokens ? maxTokens * 4 : Number.POSITIVE_INFINITY,
  ));
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}

function defaultText(root: Document | HTMLElement): string {
  const element = isDocument(root) ? root.body : root;
  if (!element) return '';
  if (typeof element.innerText === 'string') return element.innerText;

  const doc = element.ownerDocument;
  const showText = doc.defaultView?.NodeFilter.SHOW_TEXT ?? 4;
  const walker = doc.createTreeWalker(element, showText, {
    acceptNode(node) {
      const parent = node.parentElement?.tagName.toLowerCase();
      if (parent === 'script' || parent === 'style' || parent === 'noscript') {
        return doc.defaultView?.NodeFilter.FILTER_REJECT ?? 2;
      }
      return node.textContent?.trim()
        ? (doc.defaultView?.NodeFilter.FILTER_ACCEPT ?? 1)
        : (doc.defaultView?.NodeFilter.FILTER_REJECT ?? 2);
    },
  });
  const chunks: string[] = [];
  let node = walker.nextNode();
  while (node) {
    chunks.push(node.textContent ?? '');
    node = walker.nextNode();
  }
  return chunks.join(' ');
}

function isDocument(root: Document | HTMLElement): root is Document {
  return typeof Document !== 'undefined' && root instanceof Document;
}

function readHeadings(
  root: Document | HTMLElement,
  options: AskableCreatePageSourceOptions,
  maxItems?: number,
): AskablePageSourceHeading[] {
  const limit = Math.max(0, maxItems ?? options.maxHeadings ?? 20);
  if (limit === 0) return [];
  return Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .slice(0, limit)
    .map((heading) => ({
      level: Number(heading.tagName.slice(1)),
      text: normalizeWhitespace(sanitizeText(heading.textContent ?? '', options)),
    }))
    .filter((heading) => heading.text.length > 0);
}

function readLinks(
  root: Document | HTMLElement,
  options: AskableCreatePageSourceOptions,
  maxItems?: number,
): AskablePageSourceLink[] {
  const limit = Math.max(0, maxItems ?? options.maxLinks ?? 20);
  if (limit === 0) return [];
  return Array.from(root.querySelectorAll('a[href]'))
    .slice(0, limit)
    .map((link) => ({
      text: normalizeWhitespace(sanitizeText(link.textContent ?? '', options)),
      href: (link as HTMLAnchorElement).href,
    }))
    .filter((link) => link.text.length > 0 && link.href.length > 0);
}

function sanitizeText(text: string, options: AskableCreatePageSourceOptions): string {
  return options.sanitizeText ? options.sanitizeText(text) : text;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
