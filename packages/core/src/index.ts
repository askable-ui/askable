export { AskableContextImpl } from './context.js';
export { createAskableInspector } from './inspector.js';
export type {
  AskableInspectorHandle,
  AskableInspectorOptions,
  AskableInspectorPosition,
} from './inspector.js';
export type {
  AskableContext,
  AskableContextOptions,
  AskableEvent,
  AskableEventHandler,
  AskableEventMap,
  AskableEventName,
  AskableFocus,
  AskableObserveOptions,
  AskablePromptContextOptions,
  AskablePromptFormat,
  AskablePromptPreset,
  AskableSerializedFocus,
  AskableTargetStrategy,
} from './types.js';

import { AskableContextImpl } from './context.js';
import type { AskableContext, AskableContextOptions } from './types.js';

/** Create a new AskableContext instance */
export function createAskableContext(options?: AskableContextOptions): AskableContext {
  return new AskableContextImpl(options);
}
