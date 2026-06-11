import { useState, useCallback } from 'react';
import type {
  AskableAgentRequest,
  AskableAgentRequestOptions,
  AskableContext,
} from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export type AskableAgentStatus = 'idle' | 'pending' | 'success' | 'error';

export interface UseAskableAgentOptions extends Omit<UseAskableOptions, 'inspector'> {
  /**
   * Called with the request payload before it is sent.
   * Return a modified payload or undefined to send the original.
   */
  onRequest?: (request: AskableAgentRequest) => AskableAgentRequest | void | undefined;
  /**
   * Called after a successful response.
   */
  onSuccess?: (response: unknown, request: AskableAgentRequest) => void;
  /**
   * Called when the send handler throws.
   */
  onError?: (error: unknown, request: AskableAgentRequest) => void;
  /**
   * Options forwarded to ctx.toAgentRequest().
   */
  requestOptions?: AskableAgentRequestOptions;
  /**
   * Provide an existing context instead of creating a shared one.
   */
  ctx?: AskableContext;
}

export interface UseAskableAgentResult<T = unknown> {
  /** Send a question with the current UI context attached. */
  send: (
    question: string,
    handler: (request: AskableAgentRequest) => T | Promise<T>,
  ) => Promise<T | undefined>;
  /** Current status */
  status: AskableAgentStatus;
  /** Last successful response */
  data: T | null;
  /** Last error */
  error: unknown;
  /** The last request payload that was sent */
  lastRequest: AskableAgentRequest | null;
  /** True while a request is in-flight */
  isLoading: boolean;
  /** Reset status, data, and error to initial state */
  reset: () => void;
  /** The underlying AskableContext */
  ctx: AskableContext;
}

/**
 * Hook that packages the current UI context into an agent request payload
 * and hands it to your send handler.
 *
 * ```tsx
 * const { send, isLoading, data } = useAskableAgent();
 *
 * async function handleAsk() {
 *   await send('What is this?', async (request) => {
 *     const res = await fetch('/api/chat', {
 *       method: 'POST',
 *       body: JSON.stringify({ context: request.context, question: request.question }),
 *     });
 *     return res.json();
 *   });
 * }
 * ```
 */
export function useAskableAgent<T = unknown>(
  options: UseAskableAgentOptions = {},
): UseAskableAgentResult<T> {
  const { onRequest, onSuccess, onError, requestOptions, ...askableOptions } = options;
  const { ctx } = useAskable(askableOptions);

  const [status, setStatus] = useState<AskableAgentStatus>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [lastRequest, setLastRequest] = useState<AskableAgentRequest | null>(null);

  const send = useCallback(
    async (
      question: string,
      handler: (request: AskableAgentRequest) => T | Promise<T>,
    ): Promise<T | undefined> => {
      setStatus('pending');
      setError(null);

      let request = await ctx.toAgentRequest(question, requestOptions);
      if (onRequest) {
        const modified = onRequest(request);
        if (modified != null) request = modified;
      }
      setLastRequest(request);

      try {
        const result = await handler(request);
        setData(result);
        setStatus('success');
        onSuccess?.(result, request);
        return result;
      } catch (err) {
        setError(err);
        setStatus('error');
        onError?.(err, request);
        return undefined;
      }
    },
    [ctx, onRequest, onSuccess, onError, requestOptions],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setData(null);
    setError(null);
    setLastRequest(null);
  }, []);

  return {
    send,
    status,
    data,
    error,
    lastRequest,
    isLoading: status === 'pending',
    reset,
    ctx,
  };
}
