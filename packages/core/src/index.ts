export { createAskableInspector } from './inspector.js';
export { isAskableAgentRequest } from './agent-request.js';
export { ASKABLE_REGION_CAPTURE_THEME, createAskableRegionCapture } from './capture.js';
export { ASKABLE_TEXT_SELECTION_CAPTURE_THEME, createAskableTextSelectionCapture } from './selection.js';
export { a11yTextExtractor } from './a11y.js';
export { createAskableCollectionSource, createAskableSource, isAskablePacketSourceSelection } from './sources.js';
export { createAskablePageSource } from './page-source.js';
export { createAskableFormSource } from './form-source.js';
export { createAskableErrorSource } from './error-source.js';
export { createAskableUserSource } from './user-source.js';
export { createAskableNavigationSource } from './navigation-source.js';
export { createAskableDOMSource } from './dom-source.js';
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
  AskableInspectorSourcePreviewOptions,
} from './inspector.js';
export type {
  AskableRegionCaptureHandle,
  AskableRegionCaptureGradientStop,
  AskableRegionCaptureOptions,
  AskableRegionCapturePoint,
  AskableRegionCapturePromptOptions,
  AskableRegionCaptureSelection,
  AskableRegionCaptureSelectionAffordanceOptions,
  AskableRegionCaptureShape,
  AskableRegionCaptureState,
  AskableRegionCaptureStyle,
  AskableRegionCaptureTheme,
} from './capture.js';
export type {
  AskableTextSelectionCaptureAffordanceOptions,
  AskableTextSelectionCaptureHandle,
  AskableTextSelectionCaptureOptions,
  AskableTextSelectionCapturePromptOptions,
  AskableTextSelectionCaptureSelection,
  AskableTextSelectionCaptureState,
  AskableTextSelectionCaptureStyle,
  AskableTextSelectionCaptureTheme,
} from './selection.js';
export type {
  AskableCollectionItemId,
  AskableCollectionSourceData,
  AskableCreateCollectionSourceOptions,
  AskableCreateSourceOptions,
  AskableSourceModeMap,
  AskableSourceResolver,
  AskableSourceValue,
} from './sources.js';
export type {
  AskableCreatePageSourceOptions,
  AskablePageSourceHeading,
  AskablePageSourceLink,
  AskablePageSourceSnapshot,
} from './page-source.js';
export type {
  AskableCreateFormSourceOptions,
  AskableFormFieldSnapshot,
  AskableFormSourceSnapshot,
} from './form-source.js';
export type {
  AskableCreateErrorSourceOptions,
  AskableErrorEntry,
  AskableErrorSourceSnapshot,
} from './error-source.js';
export type {
  AskableCreateUserSourceOptions,
  AskableUserProfile,
} from './user-source.js';
export type {
  AskableCreateNavigationSourceOptions,
  AskableNavigationEntry,
  AskableNavigationSourceSnapshot,
} from './navigation-source.js';
export type {
  AskableCreateDOMSourceOptions,
  AskableDOMSnapshot,
} from './dom-source.js';
export { asMeta } from './types.js';
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
  AskablePacketSourceSelection,
  AskablePacketSourceSelectionTarget,
  AskablePromptContextOptions,
  AskablePromptFormat,
  AskablePromptPreset,
  AskablePushOptions,
  AskableResolveSourcesOptions,
  AskableResolvedContextSource,
  AskableSerializedFocus,
  AskableSerializedFocusSegment,
  AskableTargetStrategy,
  TypedAskableFocus,
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
