import { createAskableSource } from './sources.js';
import type { AskableContextSource } from './types.js';

export interface AskableMediaState {
  /** Current playback position in seconds. */
  currentTime: number;
  /** Total duration in seconds (0 if unknown). */
  duration: number;
  /** Whether media is currently playing. */
  isPlaying: boolean;
  /** Whether media is paused. */
  isPaused: boolean;
  /** Whether media is muted. */
  isMuted: boolean;
  /** Volume level 0-1. */
  volume: number;
  /** Playback rate (1 = normal speed). */
  playbackRate: number;
  /** Whether media has ended. */
  hasEnded: boolean;
  /** Whether media is buffering. */
  isBuffering: boolean;
}

export interface AskableMediaSourceSnapshot extends AskableMediaState {
  /** Media title from metadata or provided via `getTitle`. */
  title: string | null;
  /** Artist/author name. */
  artist: string | null;
  /** Album or show name. */
  album: string | null;
  /** Current chapter or section name. */
  chapter: string | null;
  /** Human-readable timestamp (e.g. "1:23 / 4:56"). */
  timeDisplay: string;
  /** Progress percentage 0-100. */
  progressPercent: number;
}

export interface AskableCreateMediaSourceOptions {
  /**
   * Returns the target HTMLMediaElement (HTMLVideoElement or HTMLAudioElement).
   * Called on each resolve.
   */
  getMedia: () => HTMLMediaElement | null | undefined;
  /** Returns the media title. Falls back to the element's `title` attribute or src basename. */
  getTitle?: () => string | null;
  /** Returns the artist/author name. */
  getArtist?: () => string | null;
  /** Returns the album or show name. */
  getAlbum?: () => string | null;
  /** Returns the current chapter or section name. */
  getChapter?: () => string | null;
  /** Custom describe function. */
  describe?: (snapshot: AskableMediaSourceSnapshot) => string;
  /** Source category. Defaults to "media". */
  kind?: string;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildSnapshot(
  el: HTMLMediaElement,
  options: AskableCreateMediaSourceOptions,
): AskableMediaSourceSnapshot {
  const currentTime = el.currentTime;
  const duration = isFinite(el.duration) ? el.duration : 0;
  const progressPercent = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
  const timeDisplay = `${formatTime(currentTime)} / ${formatTime(duration)}`;

  const title = options.getTitle?.() ??
    (el.title || (el.src ? decodeURIComponent(el.src.split('/').pop() ?? '').replace(/\.\w+$/, '') : null));

  return {
    currentTime,
    duration,
    isPlaying: !el.paused && !el.ended,
    isPaused: el.paused,
    isMuted: el.muted,
    volume: el.volume,
    playbackRate: el.playbackRate,
    hasEnded: el.ended,
    isBuffering: el.readyState < 3 && !el.paused,
    title: title || null,
    artist: options.getArtist?.() ?? null,
    album: options.getAlbum?.() ?? null,
    chapter: options.getChapter?.() ?? null,
    timeDisplay,
    progressPercent,
  };
}

function defaultDescribe(snapshot: AskableMediaSourceSnapshot): string {
  const lines: string[] = [];

  if (snapshot.title) lines.push(`Media: ${snapshot.title}`);
  if (snapshot.artist) lines.push(`Artist: ${snapshot.artist}`);
  if (snapshot.album) lines.push(`Album: ${snapshot.album}`);
  if (snapshot.chapter) lines.push(`Chapter: ${snapshot.chapter}`);

  const status = snapshot.isPlaying ? 'Playing' : snapshot.hasEnded ? 'Ended' : 'Paused';
  lines.push(`Status: ${status} at ${snapshot.timeDisplay} (${snapshot.progressPercent}%)`);

  if (snapshot.playbackRate !== 1) lines.push(`Speed: ${snapshot.playbackRate}x`);
  if (snapshot.isMuted) lines.push('Audio: muted');

  return lines.join('\n');
}

/**
 * Creates a media context source that exposes audio/video player state —
 * current time, duration, playback status, and track metadata — so AI assistants
 * can reference what the user is watching or listening to.
 *
 * Works with any HTML5 media element (video, audio). Auto-updates via the
 * framework hook when the user plays, pauses, or seeks.
 *
 * @example
 * ```ts
 * // Video player
 * const source = createAskableMediaSource({
 *   getMedia: () => videoRef.current,
 *   getTitle: () => currentEpisode.title,
 *   getArtist: () => currentEpisode.speaker,
 * });
 * ctx.registerSource('player', source);
 *
 * // Auto-notify on playback events
 * videoRef.current.addEventListener('timeupdate', () => handle.notifyChanged());
 * videoRef.current.addEventListener('pause', () => handle.notifyChanged());
 * videoRef.current.addEventListener('play', () => handle.notifyChanged());
 * ```
 */
export function createAskableMediaSource(
  options: AskableCreateMediaSourceOptions,
): AskableContextSource {
  const { getMedia, describe, kind = 'media' } = options;

  return createAskableSource({
    kind,
    describe: describe
      ? () => {
          const el = getMedia();
          if (!el) return 'Media player not available.';
          return describe(buildSnapshot(el, options));
        }
      : () => {
          const el = getMedia();
          if (!el) return 'Media player not available.';
          return defaultDescribe(buildSnapshot(el, options));
        },
    state: () => {
      const el = getMedia();
      if (!el) return { available: false };
      return {
        available: true,
        isPlaying: !el.paused && !el.ended,
        progressPercent: isFinite(el.duration) && el.duration > 0
          ? Math.round((el.currentTime / el.duration) * 100)
          : 0,
        currentTime: el.currentTime,
        duration: isFinite(el.duration) ? el.duration : 0,
      };
    },
    data: () => {
      const el = getMedia();
      if (!el) return null;
      return buildSnapshot(el, options);
    },
  });
}
