import {
  Injectable,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { createAskableMediaSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateMediaSourceOptions,
  AskableMediaState,
  AskableMediaSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableMediaState, AskableMediaSourceSnapshot };

export interface AskableMediaSourceServiceOptions
  extends Omit<AskableCreateMediaSourceOptions, 'getMedia'> {
  /** Source registration id. Defaults to "media". */
  id?: string;
}

const TRACK_EVENTS = ['play', 'pause', 'ended', 'timeupdate', 'volumechange', 'ratechange', 'seeking', 'waiting', 'canplay'] as const;

/**
 * Angular service that exposes audio/video player state — current time, duration,
 * playback status, and track metadata — so AI assistants can reference what
 * the user is watching or listening to.
 *
 * Works with any HTML5 media element (video, audio).
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableMediaSourceService] })
 * export class VideoPlayerComponent implements OnInit, OnDestroy {
 *   private readonly mediaSource = inject(AskableMediaSourceService);
 *   private videoEl: HTMLVideoElement | null = null;
 *
 *   ngOnInit() {
 *     this.mediaSource.init({
 *       getMedia: () => this.videoEl,
 *       getTitle: () => this.currentEpisode?.title ?? null,
 *       getArtist: () => this.currentEpisode?.speaker ?? null,
 *     });
 *   }
 *
 *   setVideoElement(el: HTMLVideoElement) {
 *     this.videoEl = el;
 *     this.mediaSource.attachListeners(el);
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableMediaSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'media';
  private _cleanupListeners: (() => void) | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext {
    return this.askable.context;
  }

  get sourceId(): string {
    return this._sourceId;
  }

  init(options: AskableMediaSourceServiceOptions & { getMedia?: () => HTMLMediaElement | null | undefined } = {}): void {
    this.unregister();

    const { id = 'media', getMedia, ...sourceOptions } = options;
    this._sourceId = id;

    const source = createAskableMediaSource({
      ...sourceOptions,
      getMedia: getMedia ?? (() => null),
    });

    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);
  }

  /**
   * Attaches native media event listeners to the given element so the source
   * auto-notifies on play, pause, seek, and other state changes.
   *
   * Returns a cleanup function; call it (or use `ngOnDestroy`) to remove listeners.
   */
  attachListeners(el: HTMLMediaElement): () => void {
    this._cleanupListeners?.();
    const notify = () => this.notifyChanged();
    for (const evt of TRACK_EVENTS) el.addEventListener(evt, notify);
    const cleanup = () => {
      for (const evt of TRACK_EVENTS) el.removeEventListener(evt, notify);
    };
    this._cleanupListeners = cleanup;
    return cleanup;
  }

  resolve(request?: { mode?: string }): Promise<AskableResolvedContextSource> {
    return this.ctx.resolveSource(this._sourceId, request);
  }

  async toPromptContext(options?: { mode?: string; maxTokens?: number }): Promise<string> {
    return this.ctx.toPromptContextAsync({
      sources: [{ id: this._sourceId, ...options }],
    });
  }

  notifyChanged(): void {
    this.handle?.notifyChanged();
  }

  unregister(): void {
    this._cleanupListeners?.();
    this._cleanupListeners = null;
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void {
    this.unregister();
  }
}
