import { createEffect, onCleanup } from 'solid-js';
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
  /**
   * Accessor returning the target HTMLMediaElement.
   * Use a signal or a ref accessor.
   */
  getMedia?: () => HTMLMediaElement | null | undefined;
  /** CSS selector to locate the media element (alternative to getMedia). */
  selector?: string;
  /**
   * Automatically register listeners for play, pause, ended, timeupdate,
   * volumechange, ratechange, seeking, and canplay events.
   * @default true
   */
  autoTrack?: boolean;
}

export type UseAskableMediaSourceResult = UseAskableSourceResult;

const TRACK_EVENTS = ['play', 'pause', 'ended', 'timeupdate', 'volumechange', 'ratechange', 'seeking', 'waiting', 'canplay'] as const;

/**
 * SolidJS primitive that exposes audio/video player state to AI assistants.
 *
 * Works with any HTML5 media element (video, audio).
 *
 * @example
 * ```tsx
 * let videoEl!: HTMLVideoElement;
 *
 * useAskableMediaSource({
 *   getMedia: () => videoEl,
 *   getTitle: () => currentTrack().title,
 *   getArtist: () => currentTrack().artist,
 * });
 *
 * return <video ref={videoEl} src={src()} />;
 * ```
 */
export function useAskableMediaSource(
  options: UseAskableMediaSourceOptions = {},
): UseAskableMediaSourceResult {
  const {
    id = 'media',
    getMedia: getMediaOption,
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

  const getMedia: () => HTMLMediaElement | null | undefined = getMediaOption
    ?? (selector ? () => document.querySelector<HTMLMediaElement>(selector) : () => null);

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

  if (autoTrack) {
    createEffect(() => {
      const el = getMedia();
      if (!el) return;

      const notify = () => result.notifyChanged();
      for (const evt of TRACK_EVENTS) el.addEventListener(evt, notify);
      onCleanup(() => {
        for (const evt of TRACK_EVENTS) el.removeEventListener(evt, notify);
      });
    });
  }

  return result;
}
