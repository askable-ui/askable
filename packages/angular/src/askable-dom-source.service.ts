import { Injectable, OnDestroy, inject, signal, ElementRef } from '@angular/core';
import { createAskableDOMSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableContextSourceHandle,
  AskableCreateDOMSourceOptions,
  AskableDOMSnapshot,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type { AskableDOMSnapshot };

export interface AskableDOMSourceServiceOptions
  extends Omit<AskableCreateDOMSourceOptions, 'getElement'> {
  /** Source registration id. Defaults to "dom". */
  id?: string;
}

/**
 * Angular service that extracts text content, labels, roles, and attributes
 * from a DOM element and exposes them to AI assistants as structured context.
 *
 * @example
 * ```ts
 * \@Component({
 *   providers: [AskableDOMSourceService],
 *   template: '<div #editor contenteditable>...</div>',
 * })
 * export class AppComponent implements AfterViewInit {
 *   \@ViewChild('editor') editorRef!: ElementRef<HTMLElement>;
 *   private readonly domSource = inject(AskableDOMSourceService);
 *   ngAfterViewInit() {
 *     this.domSource.init({ element: this.editorRef, maxTextLength: 5000 });
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableDOMSourceService implements OnDestroy {
  private readonly askable = inject(AskableService);
  private handle: AskableContextSourceHandle | null = null;
  private _sourceId = 'dom';
  private _getElement: (() => Element | null | undefined) | null = null;

  readonly isRegistered = signal<boolean>(false);

  get ctx(): AskableContext { return this.askable.context; }
  get sourceId(): string { return this._sourceId; }

  init(
    options: AskableDOMSourceServiceOptions & {
      /** ElementRef, DOM element, or getter function. */
      element: ElementRef<Element> | Element | (() => Element | null | undefined);
    },
  ): void {
    this.unregister();
    const { id = 'dom', element, describe, kind, includeAttributes, includeHTML, maxTextLength } = options;
    this._sourceId = id;

    if (element instanceof ElementRef) {
      this._getElement = () => element.nativeElement;
    } else if (typeof element === 'function') {
      this._getElement = element;
    } else {
      this._getElement = () => element;
    }

    const source = createAskableDOMSource({
      getElement: () => this._getElement?.() ?? null,
      describe,
      kind,
      includeAttributes,
      includeHTML,
      maxTextLength,
    });
    this.handle = this.ctx.registerSource(id, source);
    this.isRegistered.set(true);
  }

  resolve(request?: { mode?: string }): Promise<AskableResolvedContextSource> {
    return this.ctx.resolveSource(this._sourceId, request);
  }

  async toPromptContext(options?: { mode?: string; maxTokens?: number }): Promise<string> {
    return this.ctx.toPromptContextAsync({ sources: [{ id: this._sourceId, ...options }] });
  }

  notifyChanged(): void { this.handle?.notifyChanged(); }

  unregister(): void {
    this.handle?.unregister();
    this.handle = null;
    this._getElement = null;
    this.isRegistered.set(false);
  }

  ngOnDestroy(): void { this.unregister(); }
}
