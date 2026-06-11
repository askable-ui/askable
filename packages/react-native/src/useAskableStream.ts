import { useState, useCallback, useRef } from 'react';
import type { AskableAgentRequest, AskableAgentRequestOptions, AskableContext } from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export type AskableStreamStatus = 'idle' | 'streaming' | 'success' | 'error';

export type AskableStreamHandler = (
  request: AskableAgentRequest,
  emit: (chunk: string) => void,
) => Promise<void>;

export interface UseAskableStreamOptions extends UseAskableOptions {
  onRequest?: (request: AskableAgentRequest) => AskableAgentRequest | void | undefined;
  onChunk?: (chunk: string, content: string) => void;
  onSuccess?: (content: string, request: AskableAgentRequest) => void;
  onError?: (error: unknown, request: AskableAgentRequest) => void;
  requestOptions?: AskableAgentRequestOptions;
  ctx?: AskableContext;
}

export interface UseAskableStreamResult {
  stream: (question: string, handler: AskableStreamHandler) => Promise<string | undefined>;
  status: AskableStreamStatus;
  content: string;
  error: unknown;
  lastRequest: AskableAgentRequest | null;
  isStreaming: boolean;
  reset: () => void;
  abort: () => void;
  ctx: AskableContext;
}

/**
 * React Native hook for streaming LLM responses. Updates `content` reactively
 * as each chunk arrives — works with any fetch-based streaming API.
 *
 * ```tsx
 * const { stream, content, isStreaming } = useAskableStream();
 *
 * <TouchableOpacity onPress={() =>
 *   stream('Describe this screen', async (req, emit) => {
 *     const res = await fetch('https://api.example.com/stream', {
 *       method: 'POST', body: JSON.stringify(req),
 *     });
 *     const reader = res.body!.getReader();
 *     const dec = new TextDecoder();
 *     while (true) {
 *       const { done, value } = await reader.read();
 *       if (done) break;
 *       emit(dec.decode(value));
 *     }
 *   })
 * }>
 *   <Text>{isStreaming ? 'Streaming…' : 'Ask AI'}</Text>
 * </TouchableOpacity>
 * ```
 */
export function useAskableStream(options: UseAskableStreamOptions = {}): UseAskableStreamResult {
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
    async (question: string, handler: AskableStreamHandler): Promise<string | undefined> => {
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

  return {
    stream,
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
