import { ref, computed, type ComputedRef, type MaybeRef } from 'vue';
import type { AskableAgentRequest, AskableAgentRequestOptions, AskableContext } from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export type AskableStreamStatus = 'idle' | 'streaming' | 'success' | 'error';

export type AskableStreamHandler = (
  request: AskableAgentRequest,
  emit: (chunk: string) => void,
) => Promise<void>;

export interface UseAskableStreamOptions extends Omit<UseAskableOptions, 'inspector'> {
  onRequest?: (request: AskableAgentRequest) => AskableAgentRequest | void | undefined;
  onChunk?: (chunk: string, content: string) => void;
  onSuccess?: (content: string, request: AskableAgentRequest) => void;
  onError?: (error: unknown, request: AskableAgentRequest) => void;
  requestOptions?: AskableAgentRequestOptions;
  ctx?: AskableContext;
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableStreamResult {
  stream: (question: string, handler: AskableStreamHandler) => Promise<string | undefined>;
  streamFrom: (question: string, source: ReadableStream<string> | AsyncIterable<string>) => Promise<string | undefined>;
  status: ReturnType<typeof ref<AskableStreamStatus>>;
  content: ReturnType<typeof ref<string>>;
  error: ReturnType<typeof ref<unknown>>;
  lastRequest: ReturnType<typeof ref<AskableAgentRequest | null>>;
  isStreaming: ComputedRef<boolean>;
  reset: () => void;
  abort: () => void;
  ctx: AskableContext;
}

/**
 * Vue 3 composable for streaming LLM responses. Updates `content.value`
 * reactively as each chunk arrives.
 *
 * ```vue
 * <script setup>
 * import { useAskableStream } from '@askable-ui/vue';
 *
 * const { stream, content, isStreaming } = useAskableStream();
 *
 * async function ask() {
 *   await stream('What is this?', async (req, emit) => {
 *     const res = await fetch('/api/stream', { method: 'POST', body: JSON.stringify(req) });
 *     const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
 *     while (true) {
 *       const { done, value } = await reader.read();
 *       if (done) break;
 *       emit(value);
 *     }
 *   });
 * }
 * </script>
 * ```
 */
export function useAskableStream(options: UseAskableStreamOptions = {}): UseAskableStreamResult {
  const { onRequest, onChunk, onSuccess, onError, requestOptions, ...askableOptions } = options;
  const { ctx } = useAskable(askableOptions);

  const status = ref<AskableStreamStatus>('idle');
  const content = ref('');
  const error = ref<unknown>(null);
  const lastRequest = ref<AskableAgentRequest | null>(null);
  const isStreaming = computed(() => status.value === 'streaming');

  let currentAc: AbortController | null = null;
  let contentAccum = '';

  function abort() {
    currentAc?.abort();
    currentAc = null;
  }

  function reset() {
    abort();
    status.value = 'idle';
    content.value = '';
    contentAccum = '';
    error.value = null;
    lastRequest.value = null;
  }

  async function stream(question: string, handler: AskableStreamHandler): Promise<string | undefined> {
    abort();
    const ac = new AbortController();
    currentAc = ac;

    status.value = 'streaming';
    content.value = '';
    contentAccum = '';
    error.value = null;

    let request = await ctx.toAgentRequest(question, requestOptions);
    if (onRequest) {
      const modified = onRequest(request);
      if (modified != null) request = modified;
    }
    lastRequest.value = request;

    const emit = (chunk: string) => {
      if (ac.signal.aborted) return;
      contentAccum += chunk;
      content.value = contentAccum;
      onChunk?.(chunk, contentAccum);
    };

    try {
      await handler(request, emit);
      if (!ac.signal.aborted) {
        status.value = 'success';
        onSuccess?.(contentAccum, request);
      }
      return contentAccum;
    } catch (err) {
      if (!ac.signal.aborted) {
        error.value = err;
        status.value = 'error';
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

  return { stream, streamFrom, status, content, error, lastRequest, isStreaming, reset, abort, ctx };
}
