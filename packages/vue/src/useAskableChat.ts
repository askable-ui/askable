import { ref, computed, type MaybeRef } from 'vue';
import type { AskableAgentRequest, AskableAgentRequestOptions, AskableContext } from '@askable-ui/core';
import { useAskable, type UseAskableOptions } from './useAskable.js';

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

export interface UseAskableChatOptions extends Omit<UseAskableOptions, 'inspector'> {
  initialMessages?: AskableChatMessage[];
  systemPrompt?: string | ((context: string) => string);
  onChunk?: (chunk: string) => void;
  onFinish?: (message: AskableChatMessage) => void;
  onError?: (error: unknown) => void;
  requestOptions?: AskableAgentRequestOptions;
  ctx?: AskableContext;
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableChatResult {
  messages: ReturnType<typeof ref<AskableChatMessage[]>>;
  append: (content: string, handler: AskableChatStreamHandler) => Promise<void>;
  clearMessages: () => void;
  status: ReturnType<typeof ref<AskableChatStatus>>;
  error: ReturnType<typeof ref<unknown>>;
  isStreaming: ReturnType<typeof computed<boolean>>;
  abort: () => void;
  ctx: AskableContext;
}

let idCounter = 0;
function nextId() {
  return `msg-${Date.now()}-${++idCounter}`;
}

/**
 * Vue 3 multi-turn chat composable with automatic context injection on every turn.
 *
 * ```vue
 * <script setup>
 * import { useAskableChat } from '@askable-ui/vue';
 *
 * const { messages, append, isStreaming } = useAskableChat({
 *   systemPrompt: (ctx) => `You are a helpful assistant.\n\n${ctx}`,
 * });
 * </script>
 * ```
 */
export function useAskableChat(options: UseAskableChatOptions = {}): UseAskableChatResult {
  const {
    initialMessages = [],
    systemPrompt,
    onChunk,
    onFinish,
    onError,
    requestOptions,
    ...askableOptions
  } = options;

  const { ctx } = useAskable(askableOptions);

  const messages = ref<AskableChatMessage[]>([...initialMessages]);
  const status = ref<AskableChatStatus>('idle');
  const error = ref<unknown>(null);
  const isStreaming = computed(() => status.value === 'streaming');

  let currentAc: AbortController | null = null;
  let contentAccum = '';

  function abort() {
    currentAc?.abort();
    currentAc = null;
  }

  function clearMessages() {
    abort();
    messages.value = [...initialMessages];
    status.value = 'idle';
    error.value = null;
  }

  async function append(content: string, handler: AskableChatStreamHandler): Promise<void> {
    abort();
    const ac = new AbortController();
    currentAc = ac;

    error.value = null;
    status.value = 'streaming';
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

    const snapshotMessages = [...messages.value, userMessage];
    messages.value = [...snapshotMessages, assistantMessage];

    const emit = (chunk: string) => {
      if (ac.signal.aborted) return;
      contentAccum += chunk;
      const idx = messages.value.findIndex((m) => m.id === assistantId);
      if (idx !== -1) {
        messages.value = [
          ...messages.value.slice(0, idx),
          { ...messages.value[idx], content: contentAccum },
          ...messages.value.slice(idx + 1),
        ];
      }
      onChunk?.(chunk);
    };

    try {
      await handler(request, snapshotMessages, emit);

      if (!ac.signal.aborted) {
        const idx = messages.value.findIndex((m) => m.id === assistantId);
        const finalMessage: AskableChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: contentAccum,
          request,
          createdAt: assistantMessage.createdAt,
        };
        if (idx !== -1) {
          messages.value = [
            ...messages.value.slice(0, idx),
            finalMessage,
            ...messages.value.slice(idx + 1),
          ];
        }
        status.value = 'idle';
        onFinish?.(finalMessage);
      }
    } catch (err) {
      if (!ac.signal.aborted) {
        error.value = err;
        status.value = 'error';
        onError?.(err);
      }
    } finally {
      if (currentAc === ac) currentAc = null;
    }
  }

  return { messages, append, clearMessages, status, error, isStreaming, abort, ctx };
}
