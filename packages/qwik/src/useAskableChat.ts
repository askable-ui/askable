import { useSignal } from '@builder.io/qwik';
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
  messages: ReturnType<typeof useSignal<AskableChatMessage[]>>;
  status: ReturnType<typeof useSignal<AskableChatStatus>>;
  error: ReturnType<typeof useSignal<unknown>>;
  isStreaming: ReturnType<typeof useSignal<boolean>>;
  append(content: string, handler: AskableChatStreamHandler): Promise<void>;
  clearMessages(): void;
  abort(): void;
  ctx: AskableContext;
}

let idCounter = 0;
function nextId() { return `msg-${Date.now()}-${++idCounter}`; }

/**
 * Qwik hook for multi-turn AI chat. Injects the current UI context into every
 * turn automatically.
 *
 * ```tsx
 * export const ChatPanel = component$(() => {
 *   const { messages, append, isStreaming } = useAskableChat({
 *     systemPrompt: (ctx) => `You are helpful.\n\n${ctx}`,
 *   });
 *
 *   return (
 *     <>
 *       {messages.value.map((m) => (
 *         <p key={m.id} class={m.role}>{m.content}</p>
 *       ))}
 *       <button onClick$={() => append('Explain this', async (req, msgs, emit) => {
 *         const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify(req) });
 *         const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
 *         while (true) {
 *           const { done, value } = await reader.read();
 *           if (done) break;
 *           emit(value);
 *         }
 *       })}>Send</button>
 *     </>
 *   );
 * });
 * ```
 */
export function useAskableChat(options: UseAskableChatOptions = {}): UseAskableChatResult {
  const { initialMessages = [], systemPrompt, onChunk, onFinish, onError, requestOptions, ...askableOptions } = options;
  const { ctx } = useAskable(askableOptions);

  const messages = useSignal<AskableChatMessage[]>([...initialMessages]);
  const status = useSignal<AskableChatStatus>('idle');
  const error = useSignal<unknown>(null);
  const isStreaming = useSignal(false);

  let currentAc: AbortController | null = null;
  let contentAccum = '';

  function abort(): void {
    currentAc?.abort();
    currentAc = null;
    isStreaming.value = false;
    status.value = 'idle';
  }

  function clearMessages(): void {
    messages.value = [];
    status.value = 'idle';
    error.value = null;
    isStreaming.value = false;
  }

  async function append(content: string, handler: AskableChatStreamHandler): Promise<void> {
    abort();
    currentAc = new AbortController();

    const userMsg: AskableChatMessage = { id: nextId(), role: 'user', content, createdAt: Date.now() };
    messages.value = [...messages.value, userMsg];

    let req = await ctx.toAgentRequest(content, requestOptions);

    if (systemPrompt) {
      const sys = typeof systemPrompt === 'function' ? systemPrompt(ctx.toPromptContext()) : systemPrompt;
      req = { ...req, metadata: { ...req.metadata, systemPrompt: sys } };
    }

    const assistantId = nextId();
    contentAccum = '';
    const assistantMsg: AskableChatMessage = { id: assistantId, role: 'assistant', content: '', request: req, createdAt: Date.now() };
    messages.value = [...messages.value, assistantMsg];

    status.value = 'streaming';
    isStreaming.value = true;
    error.value = null;

    try {
      await handler(req, messages.value.slice(0, -1), (chunk) => {
        contentAccum += chunk;
        messages.value = messages.value.map((m) =>
          m.id === assistantId ? { ...m, content: contentAccum } : m,
        );
        onChunk?.(chunk);
      });

      const finished = messages.value.find((m) => m.id === assistantId)!;
      onFinish?.(finished);
      status.value = 'idle';
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        error.value = e;
        status.value = 'error';
        onError?.(e);
      }
    } finally {
      isStreaming.value = false;
      currentAc = null;
    }
  }

  return { messages, status, error, isStreaming, append, clearMessages, abort, get ctx() { return ctx; } };
}
