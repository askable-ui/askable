import {
  createAskableContext,
  createAskableDOMSource,
  createAskablePageSource,
  type AskableAsyncContextPacketOptions,
  type AskableAsyncContextOutputOptions,
} from '@askable-ui/core';
import { createAskableBridge, createBrowserExtensionTransport } from '@askable-ui/bridge';
import type { WebContextRect, WebContextTarget } from '@askable-ui/context';

type CaptureMode = 'selected' | 'focus' | 'page';

interface CaptureMessage {
  type: 'askable-companion:capture';
  mode: CaptureMode;
  question?: string;
}

const ctx = createAskableContext({
  maxHistory: 8,
  textExtractor: (element) => normalizeText(element.textContent ?? '').slice(0, 2000),
});

let lastElement: Element | null = document.activeElement instanceof Element ? document.activeElement : null;

ctx.observe(document, {
  events: ['click', 'focus'],
  targetStrategy: 'deepest',
});

document.addEventListener('click', (event) => {
  lastElement = nearestMeaningfulElement(event.target);
}, true);

document.addEventListener('focusin', (event) => {
  lastElement = nearestMeaningfulElement(event.target);
}, true);

ctx.registerSource('page', createAskablePageSource({
  includeLinks: true,
  maxHeadings: 30,
  maxLinks: 30,
  maxTextLength: 12_000,
  sanitizeText: (text) => normalizeText(text),
}));

ctx.registerSource('element', createAskableDOMSource({
  getElement: () => lastElement,
  includeAttributes: ['href', 'aria-label', 'title', 'role', 'placeholder'],
  maxTextLength: 2500,
}));

const bridge = createAskableBridge({
  source: {
    app: 'Askable Browser Companion',
    route: location.pathname,
    url: location.href,
  },
  destination: {
    kind: 'browser-extension',
    label: 'Askable Browser Companion',
  },
  transports: [createBrowserExtensionTransport()],
});

chrome.runtime.onMessage.addListener((message: CaptureMessage, _sender, sendResponse) => {
  if (message?.type !== 'askable-companion:capture') return false;

  capture(message)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Capture failed.',
    }));

  return true;
});

async function capture(message: CaptureMessage) {
  const packetOptions = packetOptionsFor(message.mode);
  const promptOptions = promptOptionsFor(message.mode);
  const packet = await ctx.toContextPacketAsync(packetOptions);
  const prompt = await ctx.toContextAsync(promptOptions);
  const acks = await bridge.send(packet, {
    question: message.question,
    prompt,
  });

  return {
    prompt,
    packet,
    envelopeSent: acks.some((ack) => ack.ok),
    acks,
  };
}

function packetOptionsFor(mode: CaptureMode): AskableAsyncContextPacketOptions {
  const common = {
    history: 3,
    privacy: { consent: 'explicit' as const, redacted: false },
    provenance: { method: 'extension' as const },
  };

  if (mode === 'selected') {
    return {
      ...common,
      mode: 'text-selection',
      gesture: 'custom',
      target: selectionTarget(),
      sources: [{ id: 'page', mode: 'selected' }],
    };
  }

  if (mode === 'page') {
    return {
      ...common,
      mode: 'full-page',
      gesture: 'custom',
      includeViewport: true,
      sources: [{ id: 'page', mode: 'all', maxTokens: 3000 }],
    };
  }

  return {
    ...common,
    mode: 'element-focus',
    gesture: 'custom',
    target: elementTarget(lastElement),
    sources: [{ id: 'element', mode: 'summary' }, { id: 'page', mode: 'summary' }],
  };
}

function promptOptionsFor(mode: CaptureMode): AskableAsyncContextOutputOptions {
  if (mode === 'page') {
    return {
      includeText: true,
      history: 3,
      maxTokens: 3500,
      sources: [{ id: 'page', mode: 'all', maxTokens: 3000 }],
      sourceLabel: 'Full page context',
    };
  }

  if (mode === 'selected') {
    return {
      includeText: true,
      history: 3,
      maxTokens: 1800,
      sources: [{ id: 'page', mode: 'selected' }],
      sourceLabel: 'Selected page context',
    };
  }

  return {
    includeText: true,
    history: 3,
    maxTokens: 1800,
    sources: [{ id: 'element', mode: 'summary' }, { id: 'page', mode: 'summary' }],
    sourceLabel: 'Focused page context',
  };
}

function selectionTarget(): WebContextTarget | undefined {
  const selection = document.getSelection();
  const text = normalizeText(selection?.toString() ?? '');
  if (!selection || !text) return undefined;

  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined;
  const rect = range?.getBoundingClientRect();
  return {
    label: 'Selected text',
    role: 'selection',
    text,
    ...(rect ? { bounds: rectToContextRect(rect) } : {}),
  };
}

function elementTarget(element: Element | null): WebContextTarget | undefined {
  if (!element) return undefined;
  const rect = element.getBoundingClientRect();
  return {
    label: readElementLabel(element),
    role: element.getAttribute('role') ?? element.tagName.toLowerCase(),
    selector: buildSelector(element),
    text: normalizeText(element.textContent ?? '').slice(0, 1000) || undefined,
    bounds: rectToContextRect(rect),
    metadata: {
      tag: element.tagName.toLowerCase(),
      id: element.id || undefined,
      classes: Array.from(element.classList).slice(0, 8),
    },
  };
}

function nearestMeaningfulElement(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest(
    '[data-askable],button,a,input,select,textarea,[role],article,section,main,nav,aside,header,footer,h1,h2,h3,h4,h5,h6,li,td,th,p',
  ) ?? target;
}

function readElementLabel(element: Element): string | undefined {
  return normalizeText(
    element.getAttribute('aria-label')
      ?? element.getAttribute('title')
      ?? element.getAttribute('placeholder')
      ?? element.textContent
      ?? '',
  ).slice(0, 160) || undefined;
}

function buildSelector(element: Element): string {
  if (element.id) return `#${CSS.escape(element.id)}`;

  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.documentElement && parts.length < 4) {
    const tag = current.tagName.toLowerCase();
    const className = Array.from(current.classList)
      .slice(0, 2)
      .map((name) => `.${CSS.escape(name)}`)
      .join('');
    parts.unshift(`${tag}${className}`);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

function readSelectedText(): string {
  return normalizeText(document.getSelection?.()?.toString() ?? '');
}

function rectToContextRect(rect: DOMRect): WebContextRect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
