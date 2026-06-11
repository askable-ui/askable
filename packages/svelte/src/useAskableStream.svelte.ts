import { createAskableContext } from '@askable-ui/core';
import type {
  AskableAgentRequest,
  AskableAgentRequestOptions,
  AskableContext,
  AskableContextOptions,
  AskableObserveOptions,
} from '@askable-ui/core';

export type AskableStreamStatus = 'idle' | 'streaming' | 'success' | 'error';

export type AskableStreamHandler = (
  request: AskableAgentRequest,
  emit: (chunk: string) => void,
) => Promise<void>;

export interface UseAskableStreamOptions extends AskableContextOptions {
  observe?: boolean | AskableObserveOptions;
  ctx?: AskableContext;
  onRequest?: (request: AskableAgentRequest) => AskableAgentRequest | void | undefined;
  onChunk?: (chunk: string, content: string) => void;
  onSuccess?: (content: string, request: AskableAgentRequest) => void;
  onError?: (error: unknown, request: AskableAgentRequest) => void;
  requestOptions?: AskableAgentRequestOptions;
}

export interface UseAskableStream {
  readonly ctx: AskableContext;
  stream(question: string, handler: AskableStreamHandler): Promise<string | undefined>;
  streamFrom(question: string, source: ReadableStream<string> | AsyncIterable<string>): Promise<string | undefined>;
  readonly status: AskableStreamStatus;
  readonly content: string;
  readonly error: unknown;
  readonly lastRequest: AskableAgentRequest | null;
  readonly isStreaming: boolean;
  reset(): void;
  abort(): void;
}

/**
 * Svelte 5 runes-based streaming hook. The `content` property updates reactively
 * as each text chunk arrives.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableStream } from '@askable-ui/svelte/useAskableStream.svelte';
 *
 *   const { stream, content, isStreaming } = useAskableStream();
 * </script>
 *
 * <p>{content}</p>
 * <button onclick={() => stream('Explain this', async (req, emit) => { ... })}>Ask</button>
 * ```
 */
export function useAskableStream(options: UseAskableStreamOptions = {}): UseAskableStream {
  const { ctx: providedCtx, observe, onRequest, onChunk, onSuccess, onError, requestOptions, ...ctxOptions } = options;
  const ctx = providedCtx ?? createAskableContext(ctxOptions);

  if (!providedCtx && typeof document !== 'undefined' && observe !== false) {
    ctx.observe(document, observe === true || observe === undefined ? undefined : observe);
  }

  let status = $state<AskableStreamStatus>('idle');
  let content = $state('');
  let error = $state<unknown>(null);
  let lastRequest = $state<AskableAgentRequest | null>(null);
  const isStreaming = $derived(status === 'streaming');

  let currentAc: AbortController | null = null;
  let contentAccum = '';

  function abort() {
    currentAc?.abort();
    currentAc = null;
  }

  function reset() {
    abort();
    status = 'idle';
    content = '';
    contentAccum = '';
    error = null;
    lastRequest = null;
  }

  async function stream(question: string, handler: AskableStreamHandler): Promise<string | undefined> {
    abort();
    const ac = new AbortController();
    currentAc = ac;

    status = 'streaming';
    content = '';
    contentAccum = '';
    error = null;

    let request = await ctx.toAgentRequest(question, requestOptions);
    if (onRequest) {
      const modified = onRequest(request);
      if (modified != null) request = modified;
    }
    lastRequest = request;

    const emit = (chunk: string) => {
      if (ac.signal.aborted) return;
      contentAccum += chunk;
      content = contentAccum;
      onChunk?.(chunk, contentAccum);
    };

    try {
      await handler(request, emit);
      if (!ac.signal.aborted) {
        status = 'success';
        onSuccess?.(contentAccum, request);
      }
      return contentAccum;
    } catch (err) {
      if (!ac.signal.aborted) {
        error = err;
        status = 'error';
        onError?.(err, request);
      }
      return undefined;
    } finally {
      if (currentAc === ac) currentAc = null;
    }
  }

  async function streamFrom(
    question: string,
    source: ReadableStream<string> | AsyncIterable<string>,
  ): Promise<string | undefined> {
    return stream(question, async (_req, emit) => {
      if (typeof (source as ReadableStream<string>).getReader === 'function') {
        const reader = (source as ReadableStream<string>).getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            emit(value);
          }
        } finally {
          reader.releaseLock();
        }
      } else {
        for await (const chunk of source as AsyncIterable<string>) {
          emit(chunk);
        }
      }
    });
  }

  return {
    ctx,
    stream,
    streamFrom,
    get status() { return status; },
    get content() { return content; },
    get error() { return error; },
    get lastRequest() { return lastRequest; },
    get isStreaming() { return isStreaming; },
    reset,
    abort,
  };
}
