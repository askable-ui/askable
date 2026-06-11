import { useState, useCallback, useRef } from 'react';
import type { AskableAgentRequest, AskableAgentRequestOptions, AskableContext } from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export type AskableStreamStatus = 'idle' | 'streaming' | 'success' | 'error';

/** A handler that yields text chunks from an LLM stream */
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
  /** Start a streaming request */
  stream: (
    question: string,
    handler: AskableStreamHandler,
  ) => Promise<string | undefined>;
  /** Stream a ReadableStream<string> or AsyncIterable<string> directly */
  streamFrom: (
    question: string,
    source: ReadableStream<string> | AsyncIterable<string>,
  ) => Promise<string | undefined>;
  status: AskableStreamStatus;
  /** Accumulated text so far — reactive, updates with each chunk */
  content: string;
  error: unknown;
  lastRequest: AskableAgentRequest | null;
  isStreaming: boolean;
  reset: () => void;
  /** Abort the in-flight stream */
  abort: () => void;
  ctx: AskableContext;
}

/**
 * Like `useAskableAgent` but designed for streaming LLM responses.
 * Updates `content` reactively as chunks arrive.
 *
 * ```tsx
 * const { stream, content, isStreaming } = useAskableStream();
 *
 * // With Vercel AI SDK
 * await stream('Explain this chart', async (req, emit) => {
 *   const res = await streamText({
 *     model: openai('gpt-4o'),
 *     system: req.context,
 *     messages: [{ role: 'user', content: req.question }],
 *   });
 *   for await (const chunk of res.textStream) {
 *     emit(chunk);
 *   }
 * });
 * ```
 */
export function useAskableStream(
  options: UseAskableStreamOptions = {},
): UseAskableStreamResult {
  const { onRequest, onChunk, onSuccess, onError, requestOptions, ...askableOptions } = options;
  const { ctx } = useAskable(askableOptions);

  const [status, setStatus] = useState<AskableStreamStatus>('idle');
  const [content, setContent] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [lastRequest, setLastRequest] = useState<AskableAgentRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const contentRef = useRef('');

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    abort();
    setStatus('idle');
    setContent('');
    contentRef.current = '';
    setError(null);
    setLastRequest(null);
  }, [abort]);

  const stream = useCallback(
    async (
      question: string,
      handler: AskableStreamHandler,
    ): Promise<string | undefined> => {
      abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setStatus('streaming');
      setContent('');
      contentRef.current = '';
      setError(null);

      let request = await ctx.toAgentRequest(question, requestOptions);
      if (onRequest) {
        const modified = onRequest(request);
        if (modified != null) request = modified;
      }
      setLastRequest(request);

      const emit = (chunk: string) => {
        if (ac.signal.aborted) return;
        contentRef.current += chunk;
        setContent(contentRef.current);
        onChunk?.(chunk, contentRef.current);
      };

      try {
        await handler(request, emit);
        if (!ac.signal.aborted) {
          setStatus('success');
          onSuccess?.(contentRef.current, request);
        }
        return contentRef.current;
      } catch (err) {
        if (!ac.signal.aborted) {
          setError(err);
          setStatus('error');
          onError?.(err, request);
        }
        return undefined;
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
      }
    },
    [ctx, onRequest, onChunk, onSuccess, onError, requestOptions, abort],
  );

  const streamFrom = useCallback(
    async (
      question: string,
      source: ReadableStream<string> | AsyncIterable<string>,
    ): Promise<string | undefined> => {
      return stream(question, async (_req, emit) => {
        if (isReadableStream(source)) {
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
          for await (const chunk of source) {
            emit(chunk);
          }
        }
      });
    },
    [stream],
  );

  return {
    stream,
    streamFrom,
    status,
    content,
    error,
    lastRequest,
    isStreaming: status === 'streaming',
    reset,
    abort,
    ctx,
  };
}

function isReadableStream<T>(value: ReadableStream<T> | AsyncIterable<T>): value is ReadableStream<T> {
  return typeof (value as ReadableStream<T>).getReader === 'function';
}
