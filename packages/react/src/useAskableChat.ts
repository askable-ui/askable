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

export interface UseAskableChatOptions extends Omit<UseAskableOptions, 'inspector'> {
  /** Initial messages to pre-populate the chat */
  initialMessages?: AskableChatMessage[];
  /** System prompt or a function that returns it. Context is appended automatically. */
  systemPrompt?: string | ((context: string) => string);
  /** Called with each chunk as it streams */
  onChunk?: (chunk: string) => void;
  /** Called with the complete assistant message after streaming finishes */
  onFinish?: (message: AskableChatMessage) => void;
  /** Called on error */
  onError?: (error: unknown) => void;
  /** Options forwarded to ctx.toAgentRequest() */
  requestOptions?: AskableAgentRequestOptions;
  ctx?: AskableContext;
}

export interface UseAskableChatResult {
  /** All messages in the conversation */
  messages: AskableChatMessage[];
  /** Send a user message and stream the assistant reply */
  append: (content: string, handler: AskableChatStreamHandler) => Promise<void>;
  /** Replace the last assistant message incrementally (useful for non-streaming) */
  setAssistantMessage: (content: string) => void;
  /** Reset the conversation to initial state */
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
 * Multi-turn chat hook with automatic context injection on every turn.
 *
 * ```tsx
 * const { messages, append, isStreaming, clearMessages } = useAskableChat({
 *   systemPrompt: (ctx) => `You are a helpful assistant.\n\n${ctx}`,
 * });
 *
 * // In the submit handler:
 * await append(userInput, async (req, msgs, emit) => {
 *   const res = await fetch('/api/chat', {
 *     method: 'POST',
 *     body: JSON.stringify({ messages: msgs, context: req.context }),
 *   });
 *   const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
 *   while (true) {
 *     const { done, value } = await reader.read();
 *     if (done) break;
 *     emit(value);
 *   }
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

  const setAssistantMessage = useCallback((content: string) => {
    const id = assistantIdRef.current || nextId();
    assistantIdRef.current = id;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.id === id) {
        return [...prev.slice(0, -1), { ...last, content }];
      }
      return [...prev, { id, role: 'assistant', content, createdAt: Date.now() }];
    });
  }, []);

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
    setAssistantMessage,
    clearMessages,
    status,
    error,
    isStreaming: status === 'streaming',
    abort,
    ctx,
  };
}
