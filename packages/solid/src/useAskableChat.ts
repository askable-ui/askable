import { createSignal } from 'solid-js';
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
}

export interface UseAskableChatResult {
  messages: () => AskableChatMessage[];
  append: (content: string, handler: AskableChatStreamHandler) => Promise<void>;
  clearMessages: () => void;
  status: () => AskableChatStatus;
  error: () => unknown;
  isStreaming: () => boolean;
  abort: () => void;
  ctx: AskableContext;
}

let idCounter = 0;
function nextId() {
  return `msg-${Date.now()}-${++idCounter}`;
}

/**
 * SolidJS multi-turn chat primitive with automatic context injection on every turn.
 *
 * ```tsx
 * const { messages, append, isStreaming } = useAskableChat({
 *   systemPrompt: (ctx) => `You are helpful.\n\n${ctx}`,
 * });
 *
 * <For each={messages()}>{(msg) => <p class={msg.role}>{msg.content}</p>}</For>
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

  const [messages, setMessages] = createSignal<AskableChatMessage[]>([...initialMessages]);
  const [status, setStatus] = createSignal<AskableChatStatus>('idle');
  const [error, setError] = createSignal<unknown>(null);

  let currentAc: AbortController | null = null;
  let contentAccum = '';

  function abort() {
    currentAc?.abort();
    currentAc = null;
  }

  function clearMessages() {
    abort();
    setMessages([...initialMessages]);
    setStatus('idle');
    setError(null);
  }

  async function append(content: string, handler: AskableChatStreamHandler): Promise<void> {
    abort();
    const ac = new AbortController();
    currentAc = ac;

    setError(null);
    setStatus('streaming');
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

    const snapshotMessages = [...messages(), userMessage];
    setMessages([...snapshotMessages, assistantMessage]);

    const emit = (chunk: string) => {
      if (ac.signal.aborted) return;
      contentAccum += chunk;
      const acc = contentAccum;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === assistantId);
        if (idx === -1) return prev;
        return [...prev.slice(0, idx), { ...prev[idx], content: acc }, ...prev.slice(idx + 1)];
      });
      onChunk?.(chunk);
    };

    try {
      await handler(request, snapshotMessages, emit);

      if (!ac.signal.aborted) {
        const finalMessage: AskableChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: contentAccum,
          request,
          createdAt: assistantMessage.createdAt,
        };
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === assistantId);
          if (idx === -1) return prev;
          return [...prev.slice(0, idx), finalMessage, ...prev.slice(idx + 1)];
        });
        setStatus('idle');
        onFinish?.(finalMessage);
      }
    } catch (err) {
      if (!ac.signal.aborted) {
        setError(err);
        setStatus('error');
        onError?.(err);
      }
    } finally {
      if (currentAc === ac) currentAc = null;
    }
  }

  return {
    messages,
    append,
    clearMessages,
    status,
    error,
    isStreaming: () => status() === 'streaming',
    abort,
    ctx,
  };
}
