import type { AskableContext, AskableEventHandler, AskableEventName, AskableFocus, AskableObserveOptions } from './types.js';
export declare class AskableContextImpl implements AskableContext {
    private emitter;
    private observer;
    private currentFocus;
    constructor();
    observe(root: HTMLElement | Document, options?: AskableObserveOptions): void;
    unobserve(): void;
    getFocus(): AskableFocus | null;
    on<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void;
    off<K extends AskableEventName>(event: K, handler: AskableEventHandler<K>): void;
    toPromptContext(): string;
    destroy(): void;
}
//# sourceMappingURL=context.d.ts.map