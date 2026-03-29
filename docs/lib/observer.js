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
export class Observer {
    constructor(onFocus) {
        this.root = null;
        this.mutationObserver = null;
        this.boundElements = new Set();
        this.handleInteraction = (event) => {
            const el = event.currentTarget;
            const focus = buildFocus(el);
            if (focus)
                this.onFocus(focus);
        };
        this.onFocus = onFocus;
    }
    observe(root) {
        if (this.root)
            this.unobserve();
        this.root = root;
        // Attach to existing elements
        const rootEl = root instanceof Document ? root.documentElement : root;
        rootEl.querySelectorAll('[data-askable]').forEach((el) => this.attach(el));
        // Watch for new elements
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
//# sourceMappingURL=observer.js.map