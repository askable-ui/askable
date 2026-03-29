const EVENT_MAP = {
    click: 'click',
    hover: 'mouseenter',
    focus: 'focus',
};
function parseMeta(raw) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return raw;
    }
}
function extractText(el) {
    const text = (el.textContent ?? '').trim();
    return text.length > 200 ? text.slice(0, 200) : text;
}
function buildFocus(el) {
    const raw = el.getAttribute('data-askable');
    if (raw === null)
        return null;
    return {
        meta: parseMeta(raw),
        text: extractText(el),
        element: el,
        timestamp: Date.now(),
    };
}
const ALL_EVENTS = ['click', 'hover', 'focus'];
export class Observer {
    constructor(onFocus) {
        this.root = null;
        this.mutationObserver = null;
        this.boundElements = new Set();
        this.activeEvents = ALL_EVENTS;
        this.handleInteraction = (event) => {
            const el = event.currentTarget;
            const focus = buildFocus(el);
            if (focus)
                this.onFocus(focus);
        };
        this.onFocus = onFocus;
    }
    observe(root, events = ALL_EVENTS) {
        if (this.root)
            this.unobserve();
        this.root = root;
        this.activeEvents = events;
        const rootEl = root instanceof Document ? root.documentElement : root;
        rootEl.querySelectorAll('[data-askable]').forEach((el) => this.attach(el));
        this.mutationObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof HTMLElement))
                        return;
                    if (node.hasAttribute('data-askable'))
                        this.attach(node);
                    node.querySelectorAll('[data-askable]').forEach((el) => this.attach(el));
                });
                mutation.removedNodes.forEach((node) => {
                    if (node instanceof HTMLElement)
                        this.detach(node);
                });
            }
        });
        this.mutationObserver.observe(root, { childList: true, subtree: true });
    }
    unobserve() {
        this.mutationObserver?.disconnect();
        this.mutationObserver = null;
        this.boundElements.forEach((el) => this.detach(el));
        this.boundElements.clear();
        this.root = null;
    }
    attach(el) {
        if (this.boundElements.has(el))
            return;
        this.activeEvents.forEach((e) => el.addEventListener(EVENT_MAP[e], this.handleInteraction));
        this.boundElements.add(el);
    }
    detach(el) {
        this.activeEvents.forEach((e) => el.removeEventListener(EVENT_MAP[e], this.handleInteraction));
        this.boundElements.delete(el);
    }
}
//# sourceMappingURL=observer.js.map