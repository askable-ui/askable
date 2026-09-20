import { useState, useCallback, useRef, useEffect } from 'react';
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
  signal: AbortSignal,
) => Promise<void>;

export interface UseAskableChatOptions extends Omit<UseAskableOptions, 'inspector'> {
  /** Initial messages to pre-populate the chat */
  initialMessages?: AskableChatMessage[];
  /** System prompt for append(). Context is appended automatically; appendRequest() sends the reviewed context unchanged. */
  systemPrompt?: string | ((context: string) => string);
  /** Called with each chunk as it streams */
  onChunk?: (chunk: string) => void;
  /** Called with the complete assistant message after streaming finishes */
  onFinish?: (message: AskableChatMessage) => void;
  /** Called on error */
  onError?: (error: unknown) => void;
  /** Options forwarded to ctx.toAgentRequest() by append(), not appendRequest(). */
  requestOptions?: AskableAgentRequestOptions;
  ctx?: AskableContext;
}

export interface UseAskableChatResult {
  /** All messages in the conversation */
  messages: AskableChatMessage[];
  /** Send a user message and stream the assistant reply */
  append: (content: string, handler: AskableChatStreamHandler) => Promise<void>;
  /** Send a JSON-ready request as reviewed, without resolving context or applying systemPrompt again. */
  appendRequest: (request: AskableAgentRequest, handler: AskableChatStreamHandler) => Promise<void>;
  /** Replace the last assistant message incrementally (useful for non-streaming) */
  setAssistantMessage: (content: string) => void;
  /** Reset the conversation to initial state */
  clearMessages: () => void;
  status: AskableChatStatus;
  error: unknown;
  isStreaming: boolean;
  /** Cancel preparation/streaming and return to idle. Forward the handler signal to cancel network work. */
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
 * await append(userInput, async (req, msgs, emit, signal) => {
 *   const res = await fetch('/api/chat', {
 *     method: 'POST',
 *     signal,
 *     body: JSON.stringify({
 *       messages: msgs.map(({ role, content }) => ({ role, content })),
 *       context: req.context,
 *     }),
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
  const messagesRef = useRef(messages);
  const assistantIdRef = useRef('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const updateMessages = useCallback((update: (previous: AskableChatMessage[]) => AskableChatMessage[]) => {
    messagesRef.current = update(messagesRef.current);
    setMessages(messagesRef.current);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (mountedRef.current) setStatus('idle');
  }, []);

  const clearMessages = useCallback(() => {
    if (!mountedRef.current) return;
    abort();
    assistantIdRef.current = '';
    updateMessages(() => initialMessages);
    setStatus('idle');
    setError(null);
  }, [abort, initialMessages, updateMessages]);

  const setAssistantMessage = useCallback((content: string) => {
    if (!mountedRef.current) return;
    const id = assistantIdRef.current || nextId();
    assistantIdRef.current = id;
    updateMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.id === id) {
        return [...prev.slice(0, -1), { ...last, content }];
      }
      return [...prev, { id, role: 'assistant', content, createdAt: Date.now() }];
    });
  }, [updateMessages]);

  const run = useCallback(
    async (prepare: () => AskableAgentRequest | Promise<AskableAgentRequest>, handler: AskableChatStreamHandler): Promise<void> => {
      if (!mountedRef.current) return;
      abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const isCurrent = () => mountedRef.current && !ac.signal.aborted && abortRef.current === ac;

      setError(null);
      setStatus('streaming');

      try {
        const request = await prepare();
        if (!isCurrent()) return;

        const userMessage: AskableChatMessage = {
          id: nextId(),
          role: 'user',
          content: request.question,
          request,
          createdAt: Date.now(),
        };
        const assistantId = nextId();
        assistantIdRef.current = assistantId;
        let content = '';
        const assistantMessage: AskableChatMessage = {
          id: assistantId,
          role: 'assistant',
          content,
          createdAt: Date.now(),
        };

        const allMessages = [...messagesRef.current, userMessage];
        updateMessages(() => [...allMessages, assistantMessage]);

        const emit = (chunk: string) => {
          if (!isCurrent()) return;
          content += chunk;
          updateMessages((prev) => prev.map((message) =>
            message.id === assistantId ? { ...message, content } : message,
          ));
          onChunk?.(chunk);
        };

        await handler(request, allMessages, emit, ac.signal);

        if (isCurrent()) {
          const finalMessage: AskableChatMessage = {
            id: assistantId,
            role: 'assistant',
            content,
            request,
            createdAt: assistantMessage.createdAt,
          };
          updateMessages((prev) => prev.map((message) =>
            message.id === assistantId ? finalMessage : message,
          ));
          setStatus('idle');
          onFinish?.(finalMessage);
        }
      } catch (err) {
        if (isCurrent()) {
          setError(err);
          setStatus('error');
          onError?.(err);
        }
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
      }
    },
    [onChunk, onFinish, onError, abort, updateMessages],
  );

  const append = useCallback(
    (content: string, handler: AskableChatStreamHandler): Promise<void> => run(async () => {
      const request = await ctx.toAgentRequest(content, requestOptions);
      if (!systemPrompt) return request;
      return {
        ...request,
        context: typeof systemPrompt === 'function'
          ? systemPrompt(request.context)
          : `${systemPrompt}\n\n${request.context}`,
      };
    }, handler),
    [ctx, requestOptions, systemPrompt, run],
  );

  const appendRequest = useCallback(
    (request: AskableAgentRequest, handler: AskableChatStreamHandler): Promise<void> => run(
      // Copy synchronously before the first await so later edits cannot change this send.
      () => JSON.parse(JSON.stringify(request)) as AskableAgentRequest,
      handler,
    ),
    [run],
  );

  return {
    messages,
    append,
    appendRequest,
    setAssistantMessage,
    clearMessages,
    status,
    error,
    isStreaming: status === 'streaming',
    abort,
    ctx,
  };
}
