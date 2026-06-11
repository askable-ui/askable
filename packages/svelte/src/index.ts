// Svelte 4 — store-based API
export {
  createAskableHistoryStore,
  createAskableRegionCaptureStore,
  createAskableSourceStore,
  createAskableStore,
  createAskableTextSelectionCaptureStore,
  createAskableViewportStore,
} from './askable.js';
export type {
  AskableHistoryStore,
  AskableHistoryStoreOptions,
  AskableRegionCaptureStore,
  AskableRegionCaptureStoreOptions,
  AskableSourceStore,
  AskableSourceStoreOptions,
  AskableStore,
  AskableStoreOptions,
  AskableTextSelectionCaptureStore,
  AskableTextSelectionCaptureStoreOptions,
  AskableViewportStore,
  AskableViewportStoreOptions,
} from './askable.js';

// Re-export typed meta utility from core for convenience
export { asMeta } from '@askable-ui/core';
export type { TypedAskableFocus } from '@askable-ui/core';

// Svelte 5 runes-based API:
//   import { useAskable } from '@askable-ui/svelte/useAskable.svelte'
// Askable components:
//   import Askable  from '@askable-ui/svelte/Askable.svelte'   (Svelte 4)
//   import Askable5 from '@askable-ui/svelte/Askable5.svelte'  (Svelte 5)
