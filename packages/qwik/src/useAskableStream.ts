import { useSignal } from '@builder.io/qwik';
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
}

export interface UseAskableStreamResult {
  stream(question: string, handler: AskableStreamHandler): Promise<string | undefined>;
  streamFrom(question: string, source: ReadableStream<string> | AsyncIterable<string>): Promise<string | undefined>;
  status: ReturnType<typeof useSignal<AskableStreamStatus>>;
  content: ReturnType<typeof useSignal<string>>;
  error: ReturnType<typeof useSignal<unknown>>;
  lastRequest: ReturnType<typeof useSignal<AskableAgentRequest | null>>;
  isStreaming: ReturnType<typeof useSignal<boolean>>;
  reset(): void;
  abort(): void;
  ctx: AskableContext;
}

/**
 * Qwik hook for streaming LLM responses. Reactive `content.value` updates as
 * each chunk arrives, driving progressive rendering.
 *
 * ```tsx
 * export const Chat = component$(() => {
 *   const { stream, content, isStreaming } = useAskableStream();
 *   return (
 *     <>
 *       {isStreaming.value && <span>Thinking…</span>}
 *       <p>{content.value}</p>
 *       <button onClick$={() =>
 *         stream('Explain this chart', async (req, emit) => {
 *           const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify(req) });
 *           const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
 *           while (true) {
 *             const { done, value } = await reader.read();
 *             if (done) break;
 *             emit(value);
 *           }
 *         })
 *       }>Ask AI</button>
 *     </>
 *   );
 * });
 * ```
 */
export function useAskableStream(options: UseAskableStreamOptions = {}): UseAskableStreamResult {
  const { onRequest, onChunk, onSuccess, onError, requestOptions, ...askableOptions } = options;
  const { ctx } = useAskable(askableOptions);

  const status = useSignal<AskableStreamStatus>('idle');
  const content = useSignal('');
  const error = useSignal<unknown>(null);
  const lastRequest = useSignal<AskableAgentRequest | null>(null);
  const isStreaming = useSignal(false);

  let abortController: AbortController | null = null;

  function reset(): void {
    status.value = 'idle';
    content.value = '';
    error.value = null;
    lastRequest.value = null;
    isStreaming.value = false;
  }

  function abort(): void {
    abortController?.abort();
    abortController = null;
    isStreaming.value = false;
    status.value = 'idle';
  }

  async function stream(question: string, handler: AskableStreamHandler): Promise<string | undefined> {
    abort();
    abortController = new AbortController();
    let req = await ctx.toAgentRequest(question, requestOptions);
    if (onRequest) { const override = onRequest(req); if (override) req = override; }

    lastRequest.value = req;
    status.value = 'streaming';
    isStreaming.value = true;
    content.value = '';
    error.value = null;

    try {
      await handler(req, (chunk) => {
        content.value += chunk;
        onChunk?.(chunk, content.value);
      });
      status.value = 'success';
      onSuccess?.(content.value, req);
      return content.value;
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        error.value = e;
        status.value = 'error';
        onError?.(e, req);
      }
      return undefined;
    } finally {
      isStreaming.value = false;
      abortController = null;
    }
  }

  async function streamFrom(question: string, source: ReadableStream<string> | AsyncIterable<string>): Promise<string | undefined> {
    return stream(question, async (_req, emit) => {
      if (source instanceof ReadableStream) {
        const reader = source.getReader();
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
        for await (const chunk of source) emit(chunk);
      }
    });
  }

  return { stream, streamFrom, status, content, error, lastRequest, isStreaming, reset, abort, get ctx() { return ctx; } };
}
