import type { AskableFocus, AskableEvent } from './types.js';
type FocusCallback = (focus: AskableFocus) => void;
export declare class Observer {
    private root;
    private mutationObserver;
    private boundElements;
    private onFocus;
    private activeEvents;
    constructor(onFocus: FocusCallback);
    observe(root: HTMLElement | Document, events?: AskableEvent[]): void;
    unobserve(): void;
    private handleInteraction;
    private attach;
    private detach;
}
export {};
//# sourceMappingURL=observer.d.ts.map