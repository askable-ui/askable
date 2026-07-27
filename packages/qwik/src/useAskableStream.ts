import { $, noSerialize, useSignal, useTask$ } from '@builder.io/qwik';
import type { NoSerialize, QRL } from '@builder.io/qwik';
import type { AskableAgentRequest, AskableAgentRequestOptions, AskableContext } from '@askable-ui/core';
import { getAskableContext } from './contextRef.js';
import type { AskableContextRef } from './contextRef.js';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export type AskableStreamStatus = 'idle' | 'streaming' | 'success' | 'error';

export type AskableStreamHandler = QRL<(
  request: AskableAgentRequest,
  emit: (chunk: string) => void,
  signal: AbortSignal,
) => void | Promise<void>>;

export interface UseAskableStreamOptions extends UseAskableOptions {
  onRequest?: QRL<(
    request: AskableAgentRequest,
  ) => AskableAgentRequest | void | undefined | Promise<AskableAgentRequest | void | undefined>>;
  onChunk?: QRL<(chunk: string, content: string) => void | Promise<void>>;
  onSuccess?: QRL<(
    content: string,
    request: AskableAgentRequest,
  ) => void | Promise<void>>;
  onError?: QRL<(error: unknown, request: AskableAgentRequest) => void | Promise<void>>;
  requestOptions?: AskableAgentRequestOptions;
}

export interface UseAskableStreamResult {
  stream: QRL<(
    question: string,
    handler: AskableStreamHandler,
  ) => Promise<string | undefined>>;
  streamFrom: QRL<(
    question: string,
    source: ReadableStream<string> | AsyncIterable<string>,
  ) => Promise<string | undefined>>;
  status: ReturnType<typeof useSignal<AskableStreamStatus>>;
  content: ReturnType<typeof useSignal<string>>;
  error: ReturnType<typeof useSignal<unknown>>;
  lastRequest: ReturnType<typeof useSignal<AskableAgentRequest | null>>;
  isStreaming: ReturnType<typeof useSignal<boolean>>;
  reset: QRL<() => void>;
  abort: QRL<() => void>;
  /** Stable resumable reference populated when the browser lifecycle mounts. */
  ctxRef: AskableContextRef;
  ctx: AskableContext;
}

/**
 * Qwik hook for streaming LLM responses. Reactive `content.value` updates as
 * each chunk arrives, driving progressive rendering.
 *
 * Handler and callback functions are QRLs so the returned actions can be
 * captured safely by resumable Qwik event handlers.
 *
 * ```tsx
 * export const Chat = component$(() => {
 *   const { stream, content, isStreaming } = useAskableStream();
 *   const handler = $(async (req, emit, signal) => {
 *     const res = await fetch('/api/chat', {
 *       method: 'POST',
 *       body: JSON.stringify(req),
 *       signal,
 *     });
 *     const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
 *     while (true) {
 *       const { done, value } = await reader.read();
 *       if (done) break;
 *       emit(value);
 *     }
 *   });
 *
 *   return (
 *     <>
 *       {isStreaming.value && <span>Thinking…</span>}
 *       <p>{content.value}</p>
 *       <button onClick$={() => stream('Explain this chart', handler)}>Ask AI</button>
 *     </>
 *   );
 * });
 * ```
 */
export function useAskableStream(options: UseAskableStreamOptions = {}): UseAskableStreamResult {
  const { onRequest, onChunk, onSuccess, onError, requestOptions, ...askableOptions } = options;
  const { ctxRef } = useAskable(askableOptions);

  const status = useSignal<AskableStreamStatus>('idle');
  const content = useSignal('');
  const error = useSignal<unknown>(null);
  const lastRequest = useSignal<AskableAgentRequest | null>(null);
  const isStreaming = useSignal(false);
  const abortControllerRef = useSignal<NoSerialize<AbortController>>();

  useTask$(({ cleanup }) => {
    cleanup(() => abortControllerRef.value?.abort());
  });

  const reset = $(() => {
    abortControllerRef.value?.abort();
    abortControllerRef.value = undefined;
    status.value = 'idle';
    content.value = '';
    error.value = null;
    lastRequest.value = null;
    isStreaming.value = false;
  });

  const abort = $(() => {
    abortControllerRef.value?.abort();
    abortControllerRef.value = undefined;
    isStreaming.value = false;
    status.value = 'idle';
  });

  const stream = $(async (
    question: string,
    handler: AskableStreamHandler,
  ): Promise<string | undefined> => {
    abortControllerRef.value?.abort();
    const controller = new AbortController();
    abortControllerRef.value = noSerialize(controller);
    status.value = 'streaming';
    isStreaming.value = true;
    content.value = '';
    error.value = null;

    const chunkCallbacks: Promise<void>[] = [];
    let req: AskableAgentRequest | undefined;
    const isCurrent = () => (
      !controller.signal.aborted && abortControllerRef.value === controller
    );

    try {
      const ctx = getAskableContext(ctxRef);
      req = await ctx.toAgentRequest(question, requestOptions);
      if (!isCurrent()) return undefined;
      if (onRequest) {
        const override = await onRequest(req);
        if (!isCurrent()) return undefined;
        if (override) req = override;
      }

      lastRequest.value = req;
      await handler(req, (chunk) => {
        if (!isCurrent()) return;
        content.value += chunk;
        if (onChunk) chunkCallbacks.push(onChunk(chunk, content.value));
      }, controller.signal);
      await Promise.all(chunkCallbacks);

      if (!isCurrent()) return undefined;
      const result = content.value;
      status.value = 'success';
      await onSuccess?.(result, req);
      if (!isCurrent()) return undefined;
      return result;
    } catch (caught) {
      if (!isCurrent() || (caught as Error)?.name === 'AbortError') {
        if (abortControllerRef.value === controller) status.value = 'idle';
        return undefined;
      }
      error.value = caught;
      status.value = 'error';
      if (req) await onError?.(caught, req);
      return undefined;
    } finally {
      if (abortControllerRef.value === controller) {
        abortControllerRef.value = undefined;
        isStreaming.value = false;
      }
    }
  });

  const streamFrom = $(async (
    question: string,
    source: ReadableStream<string> | AsyncIterable<string>,
  ): Promise<string | undefined> => {
    const consumeSource = (async (
      _request: AskableAgentRequest,
      emit: (chunk: string) => void,
      signal: AbortSignal,
    ) => {
      if (source instanceof ReadableStream) {
        const reader = source.getReader();
        const abortReader = () => void reader.cancel().catch(() => undefined);
        signal.addEventListener('abort', abortReader, { once: true });
        try {
          while (!signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            emit(value);
          }
        } finally {
          signal.removeEventListener('abort', abortReader);
          reader.releaseLock();
        }
      } else {
        for await (const chunk of source) {
          if (signal.aborted) break;
          emit(chunk);
        }
      }
    }) as unknown as AskableStreamHandler;
    return stream(question, consumeSource);
  });

  return {
    stream,
    streamFrom,
    status,
    content,
    error,
    lastRequest,
    isStreaming,
    reset,
    abort,
    ctxRef,
    get ctx() { return ctxRef.value!; },
  };
}
