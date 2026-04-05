export { AskableContextImpl } from './context.js';
export type {
  AskableContext,
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
} from './types.js';

import { AskableContextImpl } from './context.js';
import type { AskableContext } from './types.js';

/** Create a new AskableContext instance */
export function createAskableContext(): AskableContext {
  return new AskableContextImpl();
}
