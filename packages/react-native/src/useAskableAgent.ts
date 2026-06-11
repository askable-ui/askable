import { useState, useCallback } from 'react';
import type {
  AskableAgentRequest,
  AskableAgentRequestOptions,
  AskableContext,
} from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export type AskableAgentStatus = 'idle' | 'pending' | 'success' | 'error';

export interface UseAskableAgentOptions extends UseAskableOptions {
  onRequest?: (request: AskableAgentRequest) => AskableAgentRequest | void | undefined;
  onSuccess?: (response: unknown, request: AskableAgentRequest) => void;
  onError?: (error: unknown, request: AskableAgentRequest) => void;
  requestOptions?: AskableAgentRequestOptions;
  ctx?: AskableContext;
}

export interface UseAskableAgentResult<T = unknown> {
  send: (
    question: string,
    handler: (request: AskableAgentRequest) => T | Promise<T>,
  ) => Promise<T | undefined>;
  status: AskableAgentStatus;
  data: T | null;
  error: unknown;
  lastRequest: AskableAgentRequest | null;
  isLoading: boolean;
  reset: () => void;
  ctx: AskableContext;
}

/**
 * React Native hook that packages the current screen context into an agent
 * request payload and hands it to your send handler.
 *
 * ```tsx
 * const { send, isLoading } = useAskableAgent();
 *
 * <TouchableOpacity onPress={() =>
 *   send('What screen is this?', async (req) =>
 *     fetch('https://api.example.com/ai', {
 *       method: 'POST',
 *       body: JSON.stringify(req),
 *     }).then(r => r.json())
 *   )
 * } disabled={isLoading}>
 *   <Text>{isLoading ? 'Thinking…' : 'Ask AI'}</Text>
 * </TouchableOpacity>
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
