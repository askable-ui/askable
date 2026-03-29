// askable-ui/core — bundled single file

class Emitter {
  constructor() { this.handlers = {}; }
  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = new Set();
    this.handlers[event].add(handler);
  }
  off(event, handler) { this.handlers[event]?.delete(handler); }
  emit(event, payload) { this.handlers[event]?.forEach(h => h(payload)); }
  clear() { this.handlers = {}; }
}

function parseMeta(raw) {
  try { return JSON.parse(raw); } catch { return raw; }
}

function extractText(el) {
  const text = (el.textContent ?? '').trim();
  return text.length > 200 ? text.slice(0, 200) : text;
}

function buildFocus(el) {
  const raw = el.getAttribute('data-askable');
  if (raw === null) return null;
  return { meta: parseMeta(raw), text: extractText(el), element: el, timestamp: Date.now() };
}

class Observer {
  constructor(onFocus) {
    this.root = null;
    this.mutationObserver = null;
    this.boundElements = new Set();
    this.onFocus = onFocus;
    this.handleInteraction = (event) => {
      const el = event.currentTarget;
      const focus = buildFocus(el);
      if (focus) this.onFocus(focus);
    };
  }

  observe(root) {
    if (this.root) this.unobserve();
    this.root = root;
    const rootEl = root instanceof Document ? root.documentElement : root;
    rootEl.querySelectorAll('[data-askable]').forEach(el => this.attach(el));
    this.mutationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (node.hasAttribute('data-askable')) this.attach(node);
          node.querySelectorAll('[data-askable]').forEach(el => this.attach(el));
        });
        mutation.removedNodes.forEach(node => {
          if (node instanceof HTMLElement) this.detach(node);
        });
      }
    });
    this.mutationObserver.observe(root, { childList: true, subtree: true });
  }

  unobserve() {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    this.boundElements.forEach(el => this.detach(el));
    this.boundElements.clear();
    this.root = null;
  }

  attach(el) {
    if (this.boundElements.has(el)) return;
    el.addEventListener('focus', this.handleInteraction);
    el.addEventListener('click', this.handleInteraction);
    el.addEventListener('mouseenter', this.handleInteraction);
    this.boundElements.add(el);
  }

  detach(el) {
    el.removeEventListener('focus', this.handleInteraction);
    el.removeEventListener('click', this.handleInteraction);
    el.removeEventListener('mouseenter', this.handleInteraction);
    this.boundElements.delete(el);
  }
}

export class AskableContextImpl {
  constructor() {
    this.emitter = new Emitter();
    this.currentFocus = null;
    this.observer = new Observer(focus => {
      this.currentFocus = focus;
      this.emitter.emit('focus', focus);
    });
  }

  observe(root) { this.observer.observe(root); }
  unobserve() { this.observer.unobserve(); }
  getFocus() { return this.currentFocus; }
  on(event, handler) { this.emitter.on(event, handler); }
  off(event, handler) { this.emitter.off(event, handler); }

  toPromptContext() {
    const focus = this.currentFocus;
    if (!focus) return 'No UI element is currently focused.';
    const meta = focus.meta;
    const metaStr = typeof meta === 'string'
      ? meta
      : Object.entries(meta).map(([k, v]) => `${k}: ${String(v)}`).join(', ');
    const parts = ['User is focused on:'];
    if (metaStr) parts.push(metaStr);
    if (focus.text) parts.push(`value "${focus.text}"`);
    return parts.join(' — ');
  }

  destroy() {
    this.observer.unobserve();
    this.emitter.clear();
    this.currentFocus = null;
  }
}

export function createAskableContext() {
  return new AskableContextImpl();
}
