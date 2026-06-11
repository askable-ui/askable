import { createSignal } from 'solid-js';
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
  stream: (question: string, handler: AskableStreamHandler) => Promise<string | undefined>;
  streamFrom: (question: string, source: ReadableStream<string> | AsyncIterable<string>) => Promise<string | undefined>;
  status: () => AskableStreamStatus;
  content: () => string;
  error: () => unknown;
  lastRequest: () => AskableAgentRequest | null;
  isStreaming: () => boolean;
  reset: () => void;
  abort: () => void;
  ctx: AskableContext;
}

/**
 * SolidJS primitive for streaming LLM responses. Reactive `content()` signal
 * updates as each chunk arrives.
 *
 * ```tsx
 * const { stream, content, isStreaming } = useAskableStream();
 *
 * <div>
 *   {isStreaming() ? <Spinner /> : null}
 *   <p>{content()}</p>
 *   <button onClick={() =>
 *     stream('Explain this', async (req, emit) => {
 *       const res = await fetch('/api/stream', { method: 'POST', body: JSON.stringify(req) });
 *       const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
 *       while (true) {
 *         const { done, value } = await reader.read();
 *         if (done) break;
 *         emit(value);
 *       }
 *     })
 *   }>Ask</button>
 * </div>
 * ```
 */
export function useAskableStream(options: UseAskableStreamOptions = {}): UseAskableStreamResult {
  const { onRequest, onChunk, onSuccess, onError, requestOptions, ...askableOptions } = options;
  const { ctx } = useAskable(askableOptions);

  const [status, setStatus] = createSignal<AskableStreamStatus>('idle');
  const [content, setContent] = createSignal('');
  const [error, setError] = createSignal<unknown>(null);
  const [lastRequest, setLastRequest] = createSignal<AskableAgentRequest | null>(null);

  let currentAc: AbortController | null = null;
  let contentAccum = '';

  function abort() {
    currentAc?.abort();
    currentAc = null;
  }

  function reset() {
    abort();
    setStatus('idle');
    setContent('');
    contentAccum = '';
    setError(null);
    setLastRequest(null);
  }

  async function stream(
    question: string,
    handler: AskableStreamHandler,
  ): Promise<string | undefined> {
    abort();
    const ac = new AbortController();
    currentAc = ac;

    setStatus('streaming');
    setContent('');
    contentAccum = '';
    setError(null);

    let request = await ctx.toAgentRequest(question, requestOptions);
    if (onRequest) {
      const modified = onRequest(request);
      if (modified != null) request = modified;
    }
    setLastRequest(request);

    const emit = (chunk: string) => {
      if (ac.signal.aborted) return;
      contentAccum += chunk;
      setContent(contentAccum);
      onChunk?.(chunk, contentAccum);
    };

    try {
      await handler(request, emit);
      if (!ac.signal.aborted) {
        setStatus('success');
        onSuccess?.(contentAccum, request);
      }
      return contentAccum;
    } catch (err) {
      if (!ac.signal.aborted) {
        setError(err);
        setStatus('error');
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
    stream,
    streamFrom,
    status,
    content,
    error,
    lastRequest,
    isStreaming: () => status() === 'streaming',
    reset,
    abort,
    ctx,
  };
}
