// Svelte 4 — store-based API
export {
  createAskableRegionCaptureStore,
  createAskableStore,
  createAskableTextSelectionCaptureStore,
} from './askable.js';
export type {
  AskableRegionCaptureStore,
  AskableRegionCaptureStoreOptions,
  AskableStore,
  AskableStoreOptions,
  AskableTextSelectionCaptureStore,
  AskableTextSelectionCaptureStoreOptions,
} from './askable.js';

// Svelte 5 runes-based API:
//   import { useAskable } from '@askable-ui/svelte/useAskable.svelte'
// Askable components:
//   import Askable  from '@askable-ui/svelte/Askable.svelte'   (Svelte 4)
//   import Askable5 from '@askable-ui/svelte/Askable5.svelte'  (Svelte 5)
