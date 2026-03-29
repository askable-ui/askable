import { Emitter } from './emitter.js';
import { Observer } from './observer.js';
export class AskableContextImpl {
    constructor() {
        this.emitter = new Emitter();
        this.currentFocus = null;
        this.observer = new Observer((focus) => {
            this.currentFocus = focus;
            this.emitter.emit('focus', focus);
        });
    }
    observe(root, options) {
        this.observer.observe(root, options?.events);
    }
    unobserve() {
        this.observer.unobserve();
    }
    getFocus() {
        return this.currentFocus;
    }
    on(event, handler) {
        this.emitter.on(event, handler);
    }
    off(event, handler) {
        this.emitter.off(event, handler);
    }
    toPromptContext() {
        const focus = this.currentFocus;
        if (!focus)
            return 'No UI element is currently focused.';
        const meta = focus.meta;
        let metaStr = '';
        if (typeof meta === 'string') {
            metaStr = meta;
        }
        else {
            const parts = Object.entries(meta).map(([k, v]) => `${k}: ${String(v)}`);
            metaStr = parts.join(', ');
        }
        const parts = ['User is focused on:'];
        if (metaStr)
            parts.push(metaStr);
        if (focus.text)
            parts.push(`value "${focus.text}"`);
        return parts.join(' — ');
    }
    destroy() {
        this.observer.unobserve();
        this.emitter.clear();
        this.currentFocus = null;
    }
}
//# sourceMappingURL=context.js.map