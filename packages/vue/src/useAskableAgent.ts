import { ref, readonly } from 'vue';
import type {
  AskableAgentRequest,
  AskableAgentRequestOptions,
  AskableContext,
} from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

export type AskableAgentStatus = 'idle' | 'pending' | 'success' | 'error';

export interface UseAskableAgentOptions extends Omit<UseAskableOptions, 'inspector'> {
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
  status: Readonly<ReturnType<typeof ref<AskableAgentStatus>>>;
  data: Readonly<ReturnType<typeof ref<T | null>>>;
  error: Readonly<ReturnType<typeof ref<unknown>>>;
  lastRequest: Readonly<ReturnType<typeof ref<AskableAgentRequest | null>>>;
  isLoading: Readonly<ReturnType<typeof ref<boolean>>>;
  reset: () => void;
  ctx: AskableContext;
}

/**
 * Vue 3 composable that packages the current UI context into an agent request
 * payload and hands it to your send handler.
 *
 * ```vue
 * <script setup lang="ts">
 * import { useAskableAgent } from '@askable-ui/vue';
 *
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
 * </script>
 * ```
 */
export function useAskableAgent<T = unknown>(options: UseAskableAgentOptions = {}): {
  send: (question: string, handler: (request: AskableAgentRequest) => T | Promise<T>) => Promise<T | undefined>;
  status: ReturnType<typeof ref<AskableAgentStatus>>;
  data: ReturnType<typeof ref<T | null>>;
  error: ReturnType<typeof ref<unknown>>;
  lastRequest: ReturnType<typeof ref<AskableAgentRequest | null>>;
  isLoading: ReturnType<typeof ref<boolean>>;
  reset: () => void;
  ctx: AskableContext;
} {
  const { onRequest, onSuccess, onError, requestOptions, ...askableOptions } = options;
  const { ctx } = useAskable(askableOptions);

  const status = ref<AskableAgentStatus>('idle');
  const data = ref<T | null>(null) as ReturnType<typeof ref<T | null>>;
  const error = ref<unknown>(null);
  const lastRequest = ref<AskableAgentRequest | null>(null);
  const isLoading = ref(false);

  async function send(
    question: string,
    handler: (request: AskableAgentRequest) => T | Promise<T>,
  ): Promise<T | undefined> {
    status.value = 'pending';
    isLoading.value = true;
    error.value = null;

    let request = await ctx.toAgentRequest(question, requestOptions);
    if (onRequest) {
      const modified = onRequest(request);
      if (modified != null) request = modified;
    }
    lastRequest.value = request;

    try {
      const result = await handler(request);
      data.value = result;
      status.value = 'success';
      isLoading.value = false;
      onSuccess?.(result, request);
      return result;
    } catch (err) {
      error.value = err;
      status.value = 'error';
      isLoading.value = false;
      onError?.(err, request);
      return undefined;
    }
  }

  function reset() {
    status.value = 'idle';
    data.value = null;
    error.value = null;
    lastRequest.value = null;
    isLoading.value = false;
  }

  return { send, status, data, error, lastRequest, isLoading, reset, ctx };
}
