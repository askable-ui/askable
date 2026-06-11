import { useState, useCallback, useRef } from 'react';
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

export interface UseAskableChatOptions extends UseAskableOptions {
  initialMessages?: AskableChatMessage[];
  systemPrompt?: string | ((context: string) => string);
  onChunk?: (chunk: string) => void;
  onFinish?: (message: AskableChatMessage) => void;
  onError?: (error: unknown) => void;
  requestOptions?: AskableAgentRequestOptions;
  ctx?: AskableContext;
}

export interface UseAskableChatResult {
  messages: AskableChatMessage[];
  append: (content: string, handler: AskableChatStreamHandler) => Promise<void>;
  clearMessages: () => void;
  status: AskableChatStatus;
  error: unknown;
  isStreaming: boolean;
  abort: () => void;
  ctx: AskableContext;
}

let idCounter = 0;
function nextId() {
  return `msg-${Date.now()}-${++idCounter}`;
}

/**
 * React Native multi-turn chat hook with automatic screen context injection on every turn.
 *
 * ```tsx
 * const { messages, append, isStreaming } = useAskableChat({
 *   systemPrompt: (ctx) => `You are a helpful mobile assistant.\n\n${ctx}`,
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

  const { ctx } = useAskable(askableOptions);

  const [messages, setMessages] = useState<AskableChatMessage[]>(initialMessages);
  const [status, setStatus] = useState<AskableChatStatus>('idle');
  const [error, setError] = useState<unknown>(null);

  const abortRef = useRef<AbortController | null>(null);
  const contentRef = useRef('');
  const assistantIdRef = useRef('');

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const clearMessages = useCallback(() => {
    abort();
    setMessages(initialMessages);
    setStatus('idle');
    setError(null);
  }, [abort, initialMessages]);

  const append = useCallback(
    async (content: string, handler: AskableChatStreamHandler): Promise<void> => {
      abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setError(null);
      setStatus('streaming');

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
      assistantIdRef.current = assistantId;
      contentRef.current = '';

      const assistantMessage: AskableChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      const allMessages = [...messages, userMessage];

      const emit = (chunk: string) => {
        if (ac.signal.aborted) return;
        contentRef.current += chunk;
        const acc = contentRef.current;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === assistantId) {
            return [...prev.slice(0, -1), { ...last, content: acc }];
          }
          return prev;
        });
        onChunk?.(chunk);
      };

      try {
        await handler(request, allMessages, emit);

        if (!ac.signal.aborted) {
          const finalMessage: AskableChatMessage = {
            id: assistantId,
            role: 'assistant',
            content: contentRef.current,
            request,
            createdAt: assistantMessage.createdAt,
          };
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.id === assistantId) {
              return [...prev.slice(0, -1), finalMessage];
            }
            return prev;
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
        if (abortRef.current === ac) abortRef.current = null;
      }
    },
    [ctx, messages, requestOptions, systemPrompt, onChunk, onFinish, onError, abort],
  );

  return {
    messages,
    append,
    clearMessages,
    status,
    error,
    isStreaming: status === 'streaming',
    abort,
    ctx,
  };
}
