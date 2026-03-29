export class Emitter {
    constructor() {
        this.handlers = {};
    }
    on(event, handler) {
        if (!this.handlers[event]) {
            this.handlers[event] = new Set();
        }
        this.handlers[event].add(handler);
    }
    off(event, handler) {
        this.handlers[event]?.delete(handler);
    }
    emit(event, payload) {
        this.handlers[event]?.forEach((h) => h(payload));
    }
    clear() {
        this.handlers = {};
    }
}
//# sourceMappingURL=emitter.js.map