import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { createAskableThemeSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateThemeSourceOptions,
  AskableColorScheme,
  AskableContrastPreference,
  AskableMotionPreference,
  AskableThemeSourceSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableColorScheme, AskableContrastPreference, AskableMotionPreference, AskableThemeSourceSnapshot };

export interface AskableThemeSourceServiceOptions extends AskableCreateThemeSourceOptions {
  /** Source registration id. Defaults to "theme". */
  id?: string;
  /** Automatically listen to prefers-color-scheme and related media query changes. @default true */
  autoTrack?: boolean;
}

const THEME_QUERIES = [
  '(prefers-color-scheme: dark)',
  '(prefers-contrast: more)',
  '(prefers-contrast: less)',
  '(prefers-reduced-motion: reduce)',
];

/**
 * Angular service that exposes the user's OS theme preferences and CSS variable
 * values to AI assistants.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableThemeSourceService] })
 * export class AppComponent implements OnInit {
 *   private readonly themeSource = inject(AskableThemeSourceService);
 *   ngOnInit() { this.themeSource.init({ cssVars: ['--primary-color'] }); }
 * }
 * ```
 */
@Injectable()
export class AskableThemeSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'theme';
  private _cleanup: (() => void) | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }

  init(options: AskableThemeSourceServiceOptions = {}): void {
    this.unregister();
    const { id = 'theme', autoTrack = true, ...sourceOptions } = options;
    this._sourceId = id;

    const source = createAskableThemeSource(sourceOptions);
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);

    if (autoTrack && typeof window !== 'undefined') {
      const notify = () => this.notifyChanged();
      const mqls = THEME_QUERIES.map((q) => {
        const mql = window.matchMedia(q);
        mql.addEventListener('change', notify);
        return mql;
      });
      this._cleanup = () => mqls.forEach((mql) => mql.removeEventListener('change', notify));
    }
  }

  resolve(request?: { mode?: string }): Promise<AskableResolvedContextSource> {
    return this.ctx.resolveSource(this._sourceId, request);
  }

  async toPromptContext(options?: { mode?: string; maxTokens?: number }): Promise<string> {
    return this.ctx.toPromptContextAsync({ sources: [{ id: this._sourceId, ...options }] });
  }

  notifyChanged(): void { this.handle?.notifyChanged(); }

  unregister(): void {
    this._cleanup?.();
    this._cleanup = null;
    this.handle?.unregister();
    this.handle = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void { this.unregister(); }
}
