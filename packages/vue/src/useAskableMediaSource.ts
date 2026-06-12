import { onMounted, onUnmounted, type MaybeRef, toValue } from 'vue';
import { createAskableMediaSource } from '@askable-ui/core';
import type {
  AskableCreateMediaSourceOptions,
  AskableMediaState,
  AskableMediaSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableMediaState, AskableMediaSourceSnapshot };

export interface UseAskableMediaSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateMediaSourceOptions, 'getMedia'> {
  /** Source registration id. Defaults to "media". */
  id?: string;
  /** Vue template ref pointing to an HTMLMediaElement. */
  elementRef?: { value: HTMLMediaElement | null | undefined };
  /** CSS selector to locate the media element (alternative to elementRef). */
  selector?: string;
  /**
   * Automatically register listeners for play, pause, ended, timeupdate,
   * volumechange, ratechange, seeking, and canplay events.
   * @default true
   */
  autoTrack?: MaybeRef<boolean>;
  enabled?: MaybeRef<boolean>;
}

export type UseAskableMediaSourceResult = UseAskableSourceResult;

const TRACK_EVENTS = ['play', 'pause', 'ended', 'timeupdate', 'volumechange', 'ratechange', 'seeking', 'waiting', 'canplay'] as const;

/**
 * Vue composable that exposes audio/video player state to AI assistants.
 *
 * Works with any HTML5 media element (video, audio).
 *
 * @example
 * ```ts
 * const playerRef = ref<HTMLVideoElement | null>(null);
 *
 * useAskableMediaSource({
 *   elementRef: playerRef,
 *   getTitle: () => currentTrack.value.title,
 *   getArtist: () => currentTrack.value.artist,
 * });
 * ```
 */
export function useAskableMediaSource(
  options: UseAskableMediaSourceOptions = {},
): UseAskableMediaSourceResult {
  const {
    id = 'media',
    elementRef,
    selector,
    autoTrack = true,
    getTitle,
    getArtist,
    getAlbum,
    getChapter,
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const getMedia: () => HTMLMediaElement | null | undefined = elementRef
    ? () => elementRef.value
    : selector
      ? () => document.querySelector<HTMLMediaElement>(selector)
      : () => null;

  const source = createAskableMediaSource({
    getMedia,
    getTitle,
    getArtist,
    getAlbum,
    getChapter,
    describe,
    kind,
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  let cleanupListeners: (() => void) | null = null;

  onMounted(() => {
    if (!toValue(autoTrack)) return;
    const el = getMedia();
    if (!el) return;

    const notify = () => result.notifyChanged();
    for (const evt of TRACK_EVENTS) el.addEventListener(evt, notify);
    cleanupListeners = () => {
      for (const evt of TRACK_EVENTS) el.removeEventListener(evt, notify);
    };
  });

  onUnmounted(() => {
    cleanupListeners?.();
    cleanupListeners = null;
  });

  return result;
}
