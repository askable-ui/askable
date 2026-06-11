export { AskableContextElement, defineAskableContext } from './askable-context.js';

// Auto-register when this module is imported in a browser environment
import { defineAskableContext } from './askable-context.js';
defineAskableContext();

export { asMeta } from '@askable-ui/core';
export type { AskableFocus, TypedAskableFocus } from '@askable-ui/core';
