import { createAskableContext } from '@askable-ui/core';
import type {
  AskableAgentRequest,
  AskableAgentRequestOptions,
  AskableContext,
  AskableContextOptions,
  AskableObserveOptions,
} from '@askable-ui/core';

export type AskableChatRole = 'user' | 'assistant' | 'system';

export interface AskableChatMessage {
  id: string;
  role: AskableChatRole;
  content: string;
  request?: AskableAgentRequest;
  createdAt: number;
}

export type AskableChatStatus = 'idle' | 'streaming' | 'error';

export type AskableChatStreamHandler = (
  request: AskableAgentRequest,
  messages: AskableChatMessage[],
  emit: (chunk: string) => void,
) => Promise<void>;

export interface UseAskableChatOptions extends AskableContextOptions {
  observe?: boolean | AskableObserveOptions;
  ctx?: AskableContext;
  initialMessages?: AskableChatMessage[];
  systemPrompt?: string | ((context: string) => string);
  onChunk?: (chunk: string) => void;
  onFinish?: (message: AskableChatMessage) => void;
  onError?: (error: unknown) => void;
  requestOptions?: AskableAgentRequestOptions;
}

export interface UseAskableChat {
  readonly ctx: AskableContext;
  readonly messages: AskableChatMessage[];
  append(content: string, handler: AskableChatStreamHandler): Promise<void>;
  clearMessages(): void;
  readonly status: AskableChatStatus;
  readonly error: unknown;
  readonly isStreaming: boolean;
  abort(): void;
}

let idCounter = 0;
function nextId() {
  return `msg-${Date.now()}-${++idCounter}`;
}

/**
 * Svelte 5 runes-based multi-turn chat with automatic context injection.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableChat } from '@askable-ui/svelte/useAskableChat.svelte';
 *
 *   const chat = useAskableChat({
 *     systemPrompt: (ctx) => `You are helpful.\n\n${ctx}`,
 *   });
 * </script>
 *
 * {#each chat.messages as msg}
 *   <p class={msg.role}>{msg.content}</p>
 * {/each}
 * ```
 */
export function useAskableChat(options: UseAskableChatOptions = {}): UseAskableChat {
  const {
    ctx: providedCtx,
    observe,
    initialMessages = [],
    systemPrompt,
    onChunk,
    onFinish,
    onError,
    requestOptions,
    ...ctxOptions
  } = options;

  const ctx = providedCtx ?? createAskableContext(ctxOptions);

  if (!providedCtx && typeof document !== 'undefined' && observe !== false) {
    ctx.observe(document, observe === true || observe === undefined ? undefined : observe);
  }

  let messages = $state<AskableChatMessage[]>([...initialMessages]);
  let status = $state<AskableChatStatus>('idle');
  let error = $state<unknown>(null);
  const isStreaming = $derived(status === 'streaming');

  let currentAc: AbortController | null = null;
  let contentAccum = '';

  function abort() {
    currentAc?.abort();
    currentAc = null;
  }

  function clearMessages() {
    abort();
    messages = [...initialMessages];
    status = 'idle';
    error = null;
  }

  async function append(content: string, handler: AskableChatStreamHandler): Promise<void> {
    abort();
    const ac = new AbortController();
    currentAc = ac;

    error = null;
    status = 'streaming';
    contentAccum = '';

    const userMessage: AskableChatMessage = {
      id: nextId(),
      role: 'user',
      content,
      createdAt: Date.now(),
    };

    let request = await ctx.toAgentRequest(content, requestOptions);

    if (systemPrompt) {
      const sysContent =
        typeof systemPrompt === 'function'
          ? systemPrompt(request.context)
          : `${systemPrompt}\n\n${request.context}`;
      request = { ...request, context: sysContent };
    }

    userMessage.request = request;

    const assistantId = nextId();
    const assistantMessage: AskableChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };

    const snapshotMessages = [...messages, userMessage];
    messages = [...snapshotMessages, assistantMessage];

    const emit = (chunk: string) => {
      if (ac.signal.aborted) return;
      contentAccum += chunk;
      const idx = messages.findIndex((m) => m.id === assistantId);
      if (idx !== -1) {
        messages = [
          ...messages.slice(0, idx),
          { ...messages[idx], content: contentAccum },
          ...messages.slice(idx + 1),
        ];
      }
      onChunk?.(chunk);
    };

    try {
      await handler(request, snapshotMessages, emit);

      if (!ac.signal.aborted) {
        const idx = messages.findIndex((m) => m.id === assistantId);
        const finalMessage: AskableChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: contentAccum,
          request,
          createdAt: assistantMessage.createdAt,
        };
        if (idx !== -1) {
          messages = [
            ...messages.slice(0, idx),
            finalMessage,
            ...messages.slice(idx + 1),
          ];
        }
        status = 'idle';
        onFinish?.(finalMessage);
      }
    } catch (err) {
      if (!ac.signal.aborted) {
        error = err;
        status = 'error';
        onError?.(err);
      }
    } finally {
      if (currentAc === ac) currentAc = null;
    }
  }

  return {
    ctx,
    get messages() { return messages; },
    append,
    clearMessages,
    get status() { return status; },
    get error() { return error; },
    get isStreaming() { return isStreaming; },
    abort,
  };
}
