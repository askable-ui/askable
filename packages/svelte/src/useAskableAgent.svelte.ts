import { createAskableContext } from '@askable-ui/core';
import type {
  AskableAgentRequest,
  AskableAgentRequestOptions,
  AskableContext,
  AskableContextOptions,
  AskableObserveOptions,
} from '@askable-ui/core';

export type AskableAgentStatus = 'idle' | 'pending' | 'success' | 'error';

export interface UseAskableAgentOptions extends AskableContextOptions {
  observe?: boolean | AskableObserveOptions;
  ctx?: AskableContext;
  onRequest?: (request: AskableAgentRequest) => AskableAgentRequest | void | undefined;
  onSuccess?: (response: unknown, request: AskableAgentRequest) => void;
  onError?: (error: unknown, request: AskableAgentRequest) => void;
  requestOptions?: AskableAgentRequestOptions;
}

export interface UseAskableAgent<T = unknown> {
  readonly status: AskableAgentStatus;
  readonly isLoading: boolean;
  readonly data: T | null;
  readonly error: unknown;
  readonly lastRequest: AskableAgentRequest | null;
  send(
    question: string,
    handler: (request: AskableAgentRequest) => T | Promise<T>,
  ): Promise<T | undefined>;
  reset(): void;
  readonly ctx: AskableContext;
}

/**
 * Svelte 5 runes-based composable that packages the current UI context into
 * an agent request and hands it to your send handler.
 *
 * ```svelte
 * <script lang="ts">
 *   import { useAskableAgent } from '@askable-ui/svelte/useAskableAgent.svelte';
 *
 *   const agent = useAskableAgent({ observe: true });
 * </script>
 *
 * <button onclick={() => agent.send('What is this?', (req) => fetch('/api/chat', { method: 'POST', body: JSON.stringify(req) }))}>
 *   {agent.isLoading ? 'Thinking…' : 'Ask AI'}
 * </button>
 * ```
 */
export function useAskableAgent<T = unknown>(options?: UseAskableAgentOptions): UseAskableAgent<T> {
  const usesProvidedCtx = Boolean(options?.ctx);
  const ctx = options?.ctx ?? createAskableContext(options);

  if (!usesProvidedCtx && typeof document !== 'undefined' && options?.observe !== false) {
    const observeOpts = options?.observe === true || options?.observe === undefined
      ? undefined
      : options.observe;
    ctx.observe(document, observeOpts);
  }

  let status = $state<AskableAgentStatus>('idle');
  let data: T | null = $state(null);
  let error: unknown = $state(null);
  let lastRequest: AskableAgentRequest | null = $state(null);

  const isLoading = $derived(status === 'pending');

  async function send(
    question: string,
    handler: (request: AskableAgentRequest) => T | Promise<T>,
  ): Promise<T | undefined> {
    status = 'pending';
    error = null;

    let request = await ctx.toAgentRequest(question, options?.requestOptions);
    if (options?.onRequest) {
      const modified = options.onRequest(request);
      if (modified != null) request = modified;
    }
    lastRequest = request;

    try {
      const result = await handler(request);
      data = result;
      status = 'success';
      options?.onSuccess?.(result, request);
      return result;
    } catch (err) {
      error = err;
      status = 'error';
      options?.onError?.(err, request);
      return undefined;
    }
  }

  function reset() {
    status = 'idle';
    data = null;
    error = null;
    lastRequest = null;
  }

  return {
    get status() { return status; },
    get isLoading() { return isLoading; },
    get data() { return data; },
    get error() { return error; },
    get lastRequest() { return lastRequest; },
    send,
    reset,
    ctx,
  };
}
