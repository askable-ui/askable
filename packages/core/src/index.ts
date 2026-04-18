export { createAskableInspector } from './inspector.js';
export { a11yTextExtractor } from './a11y.js';
export type {
  AskableInspectorHandle,
  AskableInspectorOptions,
  AskableInspectorPosition,
} from './inspector.js';
export type {
  AskableContext,
  AskableContextOptions,
  AskableContextOutputOptions,
  AskableEvent,
  AskableEventHandler,
  AskableEventMap,
  AskableEventName,
  AskableFocus,
  AskableFocusSegment,
  AskableFocusSource,
  AskableObserveOptions,
  AskablePromptContextOptions,
  AskablePromptFormat,
  AskablePromptPreset,
  AskablePushOptions,
  AskableSerializedFocus,
  AskableSerializedFocusSegment,
  AskableTargetStrategy,
} from './types.js';

import { AskableContextImpl } from './context.js';
import type { AskableContext, AskableContextOptions } from './types.js';

const namedContexts = new Map<string, AskableContext>();

/** Create a new AskableContext instance */
export function createAskableContext(options?: AskableContextOptions): AskableContext {
  const name = options?.name?.trim();

  if (typeof window === 'undefined' || !name) {
    return new AskableContextImpl(options);
  }

  const key = `${name}::viewport:${options?.viewport ? 'on' : 'off'}`;
  const existing = namedContexts.get(key);
  if (existing) return existing;

  const ctx = new AskableContextImpl(options);
  const originalDestroy = ctx.destroy.bind(ctx);
  ctx.destroy = () => {
    namedContexts.delete(key);
    originalDestroy();
  };
  namedContexts.set(key, ctx);
  return ctx;
}
