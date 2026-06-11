import { Injectable, OnDestroy, inject, signal, computed } from '@angular/core';
import type {
  AskableAgentRequest,
  AskableAgentRequestOptions,
} from '@askable-ui/core';
import { AskableService } from './askable.service.js';

export type AskableAgentStatus = 'idle' | 'pending' | 'success' | 'error';

export interface AskableAgentServiceOptions {
  onRequest?: (request: AskableAgentRequest) => AskableAgentRequest | void | undefined;
  onSuccess?: (response: unknown, request: AskableAgentRequest) => void;
  onError?: (error: unknown, request: AskableAgentRequest) => void;
  requestOptions?: AskableAgentRequestOptions;
}

/**
 * Angular service that packages the current UI context into an agent request
 * and hands it to your send handler.
 *
 * @example
 * ```ts
 * \@Component({ providers: [AskableAgentService] })
 * export class AskButtonComponent {
 *   private readonly agent = inject(AskableAgentService);
 *
 *   askAI() {
 *     this.agent.send('What am I looking at?', async (req) =>
 *       fetch('/api/ai', { method: 'POST', body: JSON.stringify(req) }).then(r => r.json())
 *     );
 *   }
 * }
 * ```
 */
@Injectable()
export class AskableAgentService<T = unknown> implements OnDestroy {
  private readonly askable = inject(AskableService);
  private options: AskableAgentServiceOptions = {};

  readonly status = signal<AskableAgentStatus>('idle');
  readonly data = signal<T | null>(null);
  readonly error = signal<unknown>(null);
  readonly lastRequest = signal<AskableAgentRequest | null>(null);
  readonly isLoading = computed(() => this.status() === 'pending');

  configure(options: AskableAgentServiceOptions): void {
    this.options = options;
  }

  async send(
    question: string,
    handler: (request: AskableAgentRequest) => T | Promise<T>,
  ): Promise<T | undefined> {
    this.status.set('pending');
    this.error.set(null);

    let request = await this.askable.context.toAgentRequest(
      question,
      this.options.requestOptions,
    );

    if (this.options.onRequest) {
      const modified = this.options.onRequest(request);
      if (modified != null) request = modified;
    }

    this.lastRequest.set(request);

    try {
      const result = await handler(request);
      this.data.set(result);
      this.status.set('success');
      this.options.onSuccess?.(result, request);
      return result;
    } catch (err) {
      this.error.set(err);
      this.status.set('error');
      this.options.onError?.(err, request);
      return undefined;
    }
  }

  reset(): void {
    this.status.set('idle');
    this.data.set(null);
    this.error.set(null);
    this.lastRequest.set(null);
  }

  ngOnDestroy(): void {
    this.reset();
  }
}
