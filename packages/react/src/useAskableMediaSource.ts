import { useEffect, useMemo, useRef } from 'react';
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
   * React ref pointing to the target HTMLMediaElement (video or audio).
   * When provided, the hook automatically registers native event listeners.
   */
  ref?: React.RefObject<HTMLMediaElement | null>;
  /**
   * CSS selector to locate the media element.
   * Used as a fallback when `ref` is not provided.
   */
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
 * React hook that exposes audio/video player state — current time, duration,
 * playback status, and track metadata — so AI assistants can reference what
 * the user is watching or listening to.
 *
 * Works with any HTML5 media element (video, audio).
 *
 * @example
 * ```tsx
 * const videoRef = useRef<HTMLVideoElement>(null);
 *
 * useAskableMediaSource({
 *   ref: videoRef,
 *   id: 'player',
 *   getTitle: () => currentEpisode.title,
 *   getArtist: () => currentEpisode.speaker,
 * });
 *
 * return <video ref={videoRef} src={src} />;
 * ```
 */
export function useAskableMediaSource(
  options: UseAskableMediaSourceOptions = {},
): UseAskableMediaSourceResult {
  const {
    id = 'media',
    ref,
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

  const refRef = useRef(ref);
  refRef.current = ref;

  const getTitleRef = useRef(getTitle);
  getTitleRef.current = getTitle;
  const getArtistRef = useRef(getArtist);
  getArtistRef.current = getArtist;
  const getAlbumRef = useRef(getAlbum);
  getAlbumRef.current = getAlbum;
  const getChapterRef = useRef(getChapter);
  getChapterRef.current = getChapter;

  const getMedia = useMemo<() => HTMLMediaElement | null | undefined>(() => {
    if (ref) return () => refRef.current?.current ?? null;
    if (selector) return () => document.querySelector<HTMLMediaElement>(selector);
    return () => null;
  }, [ref, selector]);

  const source = useMemo(
    () => createAskableMediaSource({
      getMedia,
      getTitle: () => getTitleRef.current?.() ?? null,
      getArtist: () => getArtistRef.current?.() ?? null,
      getAlbum: () => getAlbumRef.current?.() ?? null,
      getChapter: () => getChapterRef.current?.() ?? null,
      describe,
      kind,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  useEffect(() => {
    if (!autoTrack) return;
    const el = getMedia();
    if (!el) return;

    const notify = () => result.notifyChanged();
    for (const evt of TRACK_EVENTS) el.addEventListener(evt, notify);
    return () => {
      for (const evt of TRACK_EVENTS) el.removeEventListener(evt, notify);
    };
  }, [autoTrack, getMedia, result]);

  return result;
}
