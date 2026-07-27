import { $, noSerialize, useSignal, useTask$ } from '@builder.io/qwik';
import type { NoSerialize, QRL } from '@builder.io/qwik';
import type { AskableAgentRequest, AskableAgentRequestOptions, AskableContext } from '@askable-ui/core';
import { getAskableContext } from './contextRef.js';
import type { AskableContextRef } from './contextRef.js';
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

export type AskableChatStreamHandler = QRL<(
  request: AskableAgentRequest,
  messages: AskableChatMessage[],
  emit: (chunk: string) => void,
  signal: AbortSignal,
) => void | Promise<void>>;

export interface UseAskableChatOptions extends UseAskableOptions {
  initialMessages?: AskableChatMessage[];
  systemPrompt?: string | QRL<(context: string) => string | Promise<string>>;
  onChunk?: QRL<(chunk: string) => void | Promise<void>>;
  onFinish?: QRL<(message: AskableChatMessage) => void | Promise<void>>;
  onError?: QRL<(error: unknown) => void | Promise<void>>;
  requestOptions?: AskableAgentRequestOptions;
}

export interface UseAskableChatResult {
  messages: ReturnType<typeof useSignal<AskableChatMessage[]>>;
  status: ReturnType<typeof useSignal<AskableChatStatus>>;
  error: ReturnType<typeof useSignal<unknown>>;
  isStreaming: ReturnType<typeof useSignal<boolean>>;
  append: QRL<(content: string, handler: AskableChatStreamHandler) => Promise<void>>;
  clearMessages: QRL<() => void>;
  abort: QRL<() => void>;
  /** Stable resumable reference populated when the browser lifecycle mounts. */
  ctxRef: AskableContextRef;
  ctx: AskableContext;
}

/**
 * Qwik hook for multi-turn AI chat. Injects the current UI context into every
 * turn automatically. Handlers and callbacks are QRLs so actions can be used
 * from resumable Qwik event handlers.
 *
 * ```tsx
 * export const ChatPanel = component$(() => {
 *   const chat = useAskableChat({
 *     systemPrompt: 'You are helpful.',
 *   });
 *   const handler = $(async (req, messages, emit, signal) => {
 *     const res = await fetch('/api/chat', {
 *       method: 'POST',
 *       body: JSON.stringify({ req, messages }),
 *       signal,
 *     });
 *     const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
 *     while (true) {
 *       const { done, value } = await reader.read();
 *       if (done) break;
 *       emit(value);
 *     }
 *   });
 *
 *   return <button onClick$={() => chat.append('Explain this', handler)}>Send</button>;
 * });
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
  const { ctxRef } = useAskable(askableOptions);

  const messages = useSignal<AskableChatMessage[]>([...initialMessages]);
  const status = useSignal<AskableChatStatus>('idle');
  const error = useSignal<unknown>(null);
  const isStreaming = useSignal(false);
  const abortControllerRef = useSignal<NoSerialize<AbortController>>();
  const idCounter = useSignal(0);

  useTask$(({ cleanup }) => {
    cleanup(() => abortControllerRef.value?.abort());
  });

  const abort = $(() => {
    abortControllerRef.value?.abort();
    abortControllerRef.value = undefined;
    isStreaming.value = false;
    status.value = 'idle';
  });

  const clearMessages = $(() => {
    abortControllerRef.value?.abort();
    abortControllerRef.value = undefined;
    messages.value = [];
    status.value = 'idle';
    error.value = null;
    isStreaming.value = false;
  });

  const append = $(async (
    content: string,
    handler: AskableChatStreamHandler,
  ): Promise<void> => {
    abortControllerRef.value?.abort();
    const controller = new AbortController();
    abortControllerRef.value = noSerialize(controller);
    status.value = 'streaming';
    isStreaming.value = true;
    error.value = null;

    const nextId = () => `msg-${Date.now()}-${++idCounter.value}`;
    const userMsg: AskableChatMessage = {
      id: nextId(),
      role: 'user',
      content,
      createdAt: Date.now(),
    };
    let req: AskableAgentRequest | undefined;
    let assistantId: string | undefined;
    let accumulated = '';
    const chunkCallbacks: Promise<void>[] = [];
    const isCurrent = () => (
      !controller.signal.aborted && abortControllerRef.value === controller
    );

    try {
      const ctx = getAskableContext(ctxRef);
      req = await ctx.toAgentRequest(content, requestOptions);
      if (!isCurrent()) return;
      if (systemPrompt) {
        const prompt = typeof systemPrompt === 'string'
          ? systemPrompt
          : await systemPrompt(ctx.toPromptContext());
        if (!isCurrent()) return;
        req = { ...req, metadata: { ...req.metadata, systemPrompt: prompt } };
      }

      assistantId = nextId();
      const assistantMsg: AskableChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        request: req,
        createdAt: Date.now(),
      };
      messages.value = [...messages.value, userMsg, assistantMsg];

      await handler(req, messages.value.slice(0, -1), (chunk) => {
        if (!isCurrent()) return;
        accumulated += chunk;
        messages.value = messages.value.map((message) =>
          message.id === assistantId
            ? { ...message, content: accumulated }
            : message,
        );
        if (onChunk) chunkCallbacks.push(onChunk(chunk));
      }, controller.signal);
      await Promise.all(chunkCallbacks);

      if (!isCurrent()) return;
      const finished = messages.value.find((message) => message.id === assistantId);
      if (finished) await onFinish?.(finished);
      if (!isCurrent()) return;
      status.value = 'idle';
    } catch (caught) {
      if (!isCurrent() || (caught as Error)?.name === 'AbortError') {
        if (abortControllerRef.value === controller) status.value = 'idle';
        return;
      }
      error.value = caught;
      status.value = 'error';
      await onError?.(caught);
    } finally {
      if (abortControllerRef.value === controller) {
        abortControllerRef.value = undefined;
        isStreaming.value = false;
      }
    }
  });

  return {
    messages,
    status,
    error,
    isStreaming,
    append,
    clearMessages,
    abort,
    ctxRef,
    get ctx() { return ctxRef.value!; },
  };
}
