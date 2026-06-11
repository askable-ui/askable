// Svelte 4 — store-based API
export {
  createAskableRegionCaptureStore,
  createAskableSourceStore,
  createAskableStore,
  createAskableTextSelectionCaptureStore,
  createAskableViewportStore,
} from './askable.js';
export type {
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

// Svelte 5 runes-based API:
//   import { useAskable } from '@askable-ui/svelte/useAskable.svelte'
// Askable components:
//   import Askable  from '@askable-ui/svelte/Askable.svelte'   (Svelte 4)
//   import Askable5 from '@askable-ui/svelte/Askable5.svelte'  (Svelte 5)
