import { createAskableMediaSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateMediaSourceOptions,
  AskableMediaState,
  AskableMediaSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableMediaState, AskableMediaSourceSnapshot };

export interface UseAskableMediaSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateMediaSourceOptions, 'getMedia'> {
  /** Source registration id. Defaults to "media". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /**
   * Getter returning the target HTMLMediaElement.
   * Use a Svelte 5 `$state` binding: `getMedia: () => videoEl`.
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

export type UseAskableMediaSource = UseAskableSource;

const TRACK_EVENTS = ['play', 'pause', 'ended', 'timeupdate', 'volumechange', 'ratechange', 'seeking', 'waiting', 'canplay'] as const;

/**
 * Svelte 5 runes-based composable that exposes audio/video player state to AI assistants.
 *
 * Works with any HTML5 media element (video, audio).
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableMediaSource } from '@askable-ui/svelte/useAskableMediaSource.svelte';
 *
 *   let videoEl = $state<HTMLVideoElement | null>(null);
 *
 *   useAskableMediaSource({
 *     getMedia: () => videoEl,
 *     getTitle: () => 'My Video',
 *   });
 * </script>
 *
 * <video bind:this={videoEl} src="..." />
 * ```
 */
export function useAskableMediaSource(
  options: UseAskableMediaSourceOptions = {},
): UseAskableMediaSource {
  const {
    id = 'media',
    ctx,
    getMedia: getMediaOption,
    selector,
    autoTrack = true,
    getTitle,
    getArtist,
    getAlbum,
    getChapter,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  const getMedia: () => HTMLMediaElement | null | undefined = getMediaOption
    ?? (selector ? () => document.querySelector<HTMLMediaElement>(selector) : () => null);

  const mediaSource = createAskableMediaSource({
    getMedia,
    getTitle,
    getArtist,
    getAlbum,
    getChapter,
    describe,
    kind,
  });

  const result = useAskableSource(id, {
    ...mediaSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  if (autoTrack) {
    $effect(() => {
      const el = getMedia();
      if (!el) return;

      const notify = () => result.notifyChanged();
      for (const evt of TRACK_EVENTS) el.addEventListener(evt, notify);
      return () => {
        for (const evt of TRACK_EVENTS) el.removeEventListener(evt, notify);
      };
    });
  }

  return result;
}
