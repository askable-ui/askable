import { useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import { createAskableContext } from '@askable-ui/core';
import type {
  AskableAgentRequest,
  AskableAgentRequestOptions,
  AskableContext,
  AskableContextOptions,
  AskableEvent,
} from '@askable-ui/core';

export type AskableAgentStatus = 'idle' | 'pending' | 'success' | 'error';

export interface UseAskableAgentOptions extends AskableContextOptions {
  events?: AskableEvent[];
  ctx?: AskableContext;
  requestOptions?: AskableAgentRequestOptions;
}

export interface UseAskableAgentResult<T = unknown> {
  status: ReturnType<typeof useSignal<AskableAgentStatus>>;
  data: ReturnType<typeof useSignal<T | null>>;
  error: ReturnType<typeof useSignal<unknown>>;
  isLoading: ReturnType<typeof useSignal<boolean>>;
  lastRequest: ReturnType<typeof useSignal<AskableAgentRequest | null>>;
  send: (question: string, handler: (request: AskableAgentRequest) => T | Promise<T>) => Promise<T | undefined>;
  reset: () => void;
  ctx: AskableContext;
}

/**
 * Qwik hook that packages the current UI context into an agent request
 * and hands it to your send handler.
 *
 * @example
 * ```tsx
 * import { component$ } from '@builder.io/qwik';
 * import { useAskableAgent } from '@askable-ui/qwik';
 *
 * export const AskButton = component$(() => {
 *   const { send, isLoading } = useAskableAgent();
 *
 *   return (
 *     <button disabled={isLoading.value} onClick$={$(() =>
 *       send('What is this?', async (req) =>
 *         fetch('/api/ai', { method: 'POST', body: JSON.stringify(req) }).then(r => r.json())
 *       )
 *     )}>
 *       {isLoading.value ? 'Thinking…' : 'Ask AI'}
 *     </button>
 *   );
 * });
 * ```
 */
export function useAskableAgent<T = unknown>(
  options?: UseAskableAgentOptions,
): UseAskableAgentResult<T> {
  const status = useSignal<AskableAgentStatus>('idle');
  const data = useSignal<T | null>(null);
  const error = useSignal<unknown>(null);
  const isLoading = useSignal<boolean>(false);
  const lastRequest = useSignal<AskableAgentRequest | null>(null);

  let ctx: AskableContext | null = null;
  const requestOptions = options?.requestOptions;

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    ctx = options?.ctx ?? createAskableContext(options);
    if (!options?.ctx) {
      ctx.observe(document, { events: options?.events });
    }
    cleanup(() => {
      if (!options?.ctx) ctx?.destroy();
      ctx = null;
    });
  });

  const send = $(async (
    question: string,
    handler: (request: AskableAgentRequest) => T | Promise<T>,
  ): Promise<T | undefined> => {
    if (!ctx) return undefined;

    status.value = 'pending';
    isLoading.value = true;
    error.value = null;

    const request = await ctx.toAgentRequest(question, requestOptions);
    lastRequest.value = request;

    try {
      const result = await handler(request);
      data.value = result;
      status.value = 'success';
      return result;
    } catch (err) {
      error.value = err;
      status.value = 'error';
      return undefined;
    } finally {
      isLoading.value = status.value === 'pending';
    }
  });

  const reset = $(() => {
    status.value = 'idle';
    data.value = null;
    error.value = null;
    isLoading.value = false;
    lastRequest.value = null;
  });

  return {
    status,
    data,
    error,
    isLoading,
    lastRequest,
    send,
    reset,
    get ctx() { return ctx!; },
  };
}
