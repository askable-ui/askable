export { createAskableInspector } from './inspector.js';
export { ASKABLE_REGION_CAPTURE_THEME, createAskableRegionCapture } from './capture.js';
export { createAskableTextSelectionCapture } from './selection.js';
export { a11yTextExtractor } from './a11y.js';
export { createAskableCollectionSource, createAskableSource } from './sources.js';
export {
  WEB_CONTEXT_PROTOCOL,
  WEB_CONTEXT_VERSION,
  createWebContextPacket,
  isWebContextPacket,
  webContextPacketSchema,
} from '@askable-ui/context';
export type {
  CreateWebContextPacketOptions,
  WebContextCapture,
  WebContextCaptureMode,
  WebContextGesture,
  WebContextPacket,
  WebContextPrivacy,
  WebContextProvenance,
  WebContextRect,
  WebContextSource,
  WebContextSurrounding,
  WebContextTarget,
} from '@askable-ui/context';
export type {
  AskableInspectorHandle,
  AskableInspectorOptions,
  AskableInspectorPosition,
} from './inspector.js';
export type {
  AskableRegionCaptureHandle,
  AskableRegionCaptureGradientStop,
  AskableRegionCaptureOptions,
  AskableRegionCapturePoint,
  AskableRegionCaptureSelection,
  AskableRegionCaptureShape,
  AskableRegionCaptureTheme,
} from './capture.js';
export type {
  AskableTextSelectionCaptureHandle,
  AskableTextSelectionCaptureOptions,
  AskableTextSelectionCaptureSelection,
} from './selection.js';
export type {
  AskableCollectionSourceData,
  AskableCreateCollectionSourceOptions,
  AskableCreateSourceOptions,
  AskableSourceValue,
} from './sources.js';
export type {
  AskableContext,
  AskableAgentRequest,
  AskableAgentRequestOptions,
  AskableAsyncContextSubscriber,
  AskableAsyncContextPacketOptions,
  AskableContextOptions,
  AskableContextOutputOptions,
  AskableContextPacketOptions,
  AskableAsyncContextOutputOptions,
  AskableAsyncPromptContextOptions,
  AskableContextSubscriber,
  AskableContextSource,
  AskableContextSourceChange,
  AskableContextSourceErrorMode,
  AskableContextSourceHandle,
  AskableContextSourceInclude,
  AskableContextSourceInfo,
  AskableContextSourceMode,
  AskableContextSourceRequest,
  AskableContextSourceResolveRequest,
  AskableAsyncSubscribeOptions,
  AskableSubscribeOptions,
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
  AskableResolvedContextSource,
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
