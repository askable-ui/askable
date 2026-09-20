import { render, act, waitFor } from '@testing-library/react';
import { createAskableContext, type AskableAgentRequest } from '@askable-ui/core';
import { useAskableChat, type UseAskableChatResult, type UseAskableChatOptions } from '../useAskableChat.js';

let chatRef: UseAskableChatResult | undefined;

function ChatConsumer(options: UseAskableChatOptions) {
  chatRef = useAskableChat(options);
  return null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('useAskableChat', () => {
  afterEach(() => {
    chatRef = undefined;
  });

  it('starts with empty messages and idle status', () => {
    const ctx = createAskableContext();
    render(<ChatConsumer ctx={ctx} />);

    expect(chatRef!.messages).toHaveLength(0);
    expect(chatRef!.status).toBe('idle');
    expect(chatRef!.isStreaming).toBe(false);

    ctx.destroy();
  });

  it('respects initialMessages', () => {
    const ctx = createAskableContext();
    const initial = [{ id: 'sys-1', role: 'system' as const, content: 'You are helpful', createdAt: Date.now() }];

    function WithInitial() {
      chatRef = useAskableChat({ ctx, initialMessages: initial });
      return null;
    }

    render(<WithInitial />);

    expect(chatRef!.messages).toHaveLength(1);
    expect(chatRef!.messages[0].role).toBe('system');

    ctx.destroy();
  });

  it('append() adds user + assistant messages', async () => {
    const ctx = createAskableContext();
    render(<ChatConsumer ctx={ctx} />);

    await act(async () => {
      await chatRef!.append('Hello', async (_req, _msgs, emit) => {
        emit('Hi'); emit(' there!');
      });
    });

    expect(chatRef!.messages).toHaveLength(2);
    expect(chatRef!.messages[0].role).toBe('user');
    expect(chatRef!.messages[0].content).toBe('Hello');
    expect(chatRef!.messages[1].role).toBe('assistant');
    expect(chatRef!.messages[1].content).toBe('Hi there!');

    ctx.destroy();
  });

  it('status transitions through streaming to idle on success', async () => {
    const ctx = createAskableContext();
    const statuses: string[] = [];

    function TrackStatus() {
      chatRef = useAskableChat({ ctx });
      statuses.push(chatRef.status);
      return null;
    }

    render(<TrackStatus />);

    await act(async () => {
      await chatRef!.append('Test', async (_req, _msgs, emit) => {
        emit('ok');
      });
    });

    expect(chatRef!.status).toBe('idle');
    ctx.destroy();
  });

  it('transitions to error when handler throws', async () => {
    const ctx = createAskableContext();
    render(<ChatConsumer ctx={ctx} />);
    const err = new Error('Network failure');

    await act(async () => {
      await chatRef!.append('Hi', async () => { throw err; });
    });

    expect(chatRef!.status).toBe('error');
    expect(chatRef!.error).toBe(err);

    ctx.destroy();
  });

  it('clearMessages() resets to initial state', async () => {
    const ctx = createAskableContext();
    render(<ChatConsumer ctx={ctx} />);

    await act(async () => {
      await chatRef!.append('Hi', async (_r, _m, e) => { e('hey'); });
    });

    expect(chatRef!.messages).toHaveLength(2);

    act(() => { chatRef!.clearMessages(); });

    expect(chatRef!.messages).toHaveLength(0);
    expect(chatRef!.status).toBe('idle');

    ctx.destroy();
  });

  it('onFinish receives the complete assistant message', async () => {
    const ctx = createAskableContext();
    let finishedMsg: Parameters<NonNullable<typeof chatRef>['append']>[1] extends (
      req: unknown, msgs: unknown, emit: unknown
    ) => unknown ? never : unknown = null;

    function WithFinish() {
      chatRef = useAskableChat({
        ctx,
        onFinish: (msg) => { finishedMsg = msg; },
      });
      return null;
    }

    render(<WithFinish />);

    await act(async () => {
      await chatRef!.append('Say hi', async (_r, _m, e) => { e('Hello!'); });
    });

    await waitFor(() => expect(finishedMsg).not.toBeNull());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((finishedMsg as any).content).toBe('Hello!');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((finishedMsg as any).role).toBe('assistant');

    ctx.destroy();
  });

  it('passes previous messages to each handler turn', async () => {
    const ctx = createAskableContext();
    const capturedMsgCounts: number[] = [];

    function TrackMsgs() {
      chatRef = useAskableChat({ ctx });
      return null;
    }

    render(<TrackMsgs />);

    await act(async () => {
      await chatRef!.append('Turn 1', async (_req, msgs, emit) => {
        capturedMsgCounts.push(msgs.length);
        emit('reply 1');
      });
    });

    await act(async () => {
      await chatRef!.append('Turn 2', async (_req, msgs, emit) => {
        capturedMsgCounts.push(msgs.length);
        emit('reply 2');
      });
    });

    expect(capturedMsgCounts[0]).toBe(1);
    expect(capturedMsgCounts[1]).toBe(3);

    ctx.destroy();
  });

  it('handles context resolution failures without getting stuck or calling the transport', async () => {
    const ctx = createAskableContext();
    const error = new Error('Source unavailable');
    vi.spyOn(ctx, 'toAgentRequest').mockRejectedValue(error);
    const onError = vi.fn();
    const handler = vi.fn();
    render(<ChatConsumer ctx={ctx} onError={onError} />);

    await act(async () => { await chatRef!.append('Explain this', handler); });

    expect(chatRef!.status).toBe('error');
    expect(chatRef!.isStreaming).toBe(false);
    expect(chatRef!.error).toBe(error);
    expect(chatRef!.messages).toEqual([]);
    expect(handler).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
    ctx.destroy();
  });

  it('handles system prompt failures in the same error path', async () => {
    const ctx = createAskableContext();
    const error = new Error('Invalid prompt');
    const handler = vi.fn();
    render(<ChatConsumer ctx={ctx} systemPrompt={() => { throw error; }} />);

    await act(async () => { await chatRef!.append('Explain this', handler); });

    expect(chatRef!.status).toBe('error');
    expect(chatRef!.error).toBe(error);
    expect(handler).not.toHaveBeenCalled();
    ctx.destroy();
  });

  it.each(['abort', 'clearMessages'] as const)('%s prevents a late context request from being sent', async (action) => {
    const ctx = createAskableContext();
    const request = await ctx.toAgentRequest('Pending question');
    const pending = deferred<typeof request>();
    vi.spyOn(ctx, 'toAgentRequest').mockReturnValue(pending.promise);
    const handler = vi.fn();
    render(<ChatConsumer ctx={ctx} />);

    let send!: Promise<void>;
    act(() => { send = chatRef!.append(request.question, handler); });
    expect(chatRef!.isStreaming).toBe(true);
    act(() => { chatRef![action](); });
    expect(chatRef!.status).toBe('idle');
    await act(async () => { pending.resolve(request); await send; });

    expect(handler).not.toHaveBeenCalled();
    expect(chatRef!.messages).toEqual([]);
    expect(chatRef!.status).toBe('idle');
    ctx.destroy();
  });

  it('only dispatches the newest request when context resolves out of order', async () => {
    const ctx = createAskableContext();
    const first = await ctx.toAgentRequest('First');
    const second = await ctx.toAgentRequest('Second');
    const pending = deferred<typeof first>();
    vi.spyOn(ctx, 'toAgentRequest')
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(second);
    const oldHandler = vi.fn();
    render(<ChatConsumer ctx={ctx} />);

    let oldSend!: Promise<void>;
    act(() => { oldSend = chatRef!.append('First', oldHandler); });
    await act(async () => {
      await chatRef!.append('Second', async (_request, _messages, emit) => { emit('New reply'); });
      pending.resolve(first);
      await oldSend;
    });

    expect(oldHandler).not.toHaveBeenCalled();
    expect(chatRef!.messages.map((message) => message.content)).toEqual(['Second', 'New reply']);
    expect(chatRef!.status).toBe('idle');
    ctx.destroy();
  });

  it('passes cancellation to the handler and ignores late chunks and callbacks', async () => {
    const ctx = createAskableContext();
    const pending = deferred<void>();
    const started = deferred<void>();
    const onChunk = vi.fn();
    const onFinish = vi.fn();
    const onError = vi.fn();
    let signal!: AbortSignal;
    let lateEmit!: (chunk: string) => void;
    render(<ChatConsumer ctx={ctx} onChunk={onChunk} onFinish={onFinish} onError={onError} />);

    let send!: Promise<void>;
    await act(async () => {
      send = chatRef!.append('Explain', async (_request, _messages, emit, abortSignal) => {
        signal = abortSignal;
        lateEmit = emit;
        emit('Partial');
        started.resolve();
        await pending.promise;
      });
      await started.promise;
    });
    act(() => { chatRef!.abort(); });
    expect(signal.aborted).toBe(true);
    expect(chatRef!.isStreaming).toBe(false);
    await act(async () => {
      lateEmit(' should be ignored');
      pending.reject(new Error('Cancelled transport'));
      await send;
    });

    expect(chatRef!.messages[1].content).toBe('Partial');
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(chatRef!.status).toBe('idle');
    ctx.destroy();
  });

  it('ignores emit calls after the handler has completed', async () => {
    const ctx = createAskableContext();
    let lateEmit!: (chunk: string) => void;
    const onChunk = vi.fn();
    render(<ChatConsumer ctx={ctx} onChunk={onChunk} />);

    await act(async () => {
      await chatRef!.append('Hello', async (_request, _messages, emit) => {
        lateEmit = emit;
        emit('Done');
      });
    });
    act(() => { lateEmit(' too late'); });

    expect(chatRef!.messages[1].content).toBe('Done');
    expect(onChunk).toHaveBeenCalledTimes(1);
    ctx.destroy();
  });

  it('does not let a superseded handler overwrite a newer turn with chunks or errors', async () => {
    const ctx = createAskableContext();
    const pending = deferred<void>();
    const started = deferred<void>();
    const onError = vi.fn();
    let oldEmit!: (chunk: string) => void;
    let oldSignal!: AbortSignal;
    render(<ChatConsumer ctx={ctx} onError={onError} />);

    let oldSend!: Promise<void>;
    await act(async () => {
      oldSend = chatRef!.append('Old', async (_request, _messages, emit, signal) => {
        oldEmit = emit;
        oldSignal = signal;
        emit('Partial');
        started.resolve();
        await pending.promise;
      });
      await started.promise;
    });
    await act(async () => {
      await chatRef!.append('New', async (_request, _messages, emit) => { emit('New answer'); });
      oldEmit(' stale');
      pending.reject(new Error('Old failure'));
      await oldSend;
    });

    expect(oldSignal.aborted).toBe(true);
    expect(chatRef!.messages.map((message) => message.content)).toEqual(['Old', 'Partial', 'New', 'New answer']);
    expect(chatRef!.status).toBe('idle');
    expect(onError).not.toHaveBeenCalled();
    ctx.destroy();
  });

  it('cancels pending preparation on unmount', async () => {
    const ctx = createAskableContext();
    const request = await ctx.toAgentRequest('Pending');
    const pending = deferred<typeof request>();
    vi.spyOn(ctx, 'toAgentRequest').mockReturnValue(pending.promise);
    const handler = vi.fn();
    const { unmount } = render(<ChatConsumer ctx={ctx} />);

    let send!: Promise<void>;
    act(() => { send = chatRef!.append('Pending', handler); });
    unmount();
    await act(async () => { pending.resolve(request); await send; });

    expect(handler).not.toHaveBeenCalled();
    ctx.destroy();
  });

  it('keeps full history when the same append reference is used before a rerender', async () => {
    const ctx = createAskableContext();
    render(<ChatConsumer ctx={ctx} />);
    const append = chatRef!.append;
    const captured: string[][] = [];

    await act(async () => {
      await append('One', async (_request, messages, emit) => {
        captured.push(messages.map((message) => message.content));
        emit('First answer');
      });
      await append('Two', async (_request, messages) => {
        captured.push(messages.map((message) => message.content));
      });
    });

    expect(captured).toEqual([['One'], ['One', 'First answer', 'Two']]);
    ctx.destroy();
  });

  it('cancels an active handler on unmount and suppresses its late result', async () => {
    const ctx = createAskableContext();
    const pending = deferred<void>();
    const started = deferred<void>();
    let signal!: AbortSignal;
    let lateEmit!: (chunk: string) => void;
    const onChunk = vi.fn();
    const onFinish = vi.fn();
    const { unmount } = render(<ChatConsumer ctx={ctx} onChunk={onChunk} onFinish={onFinish} />);
    let send!: Promise<void>;
    await act(async () => {
      send = chatRef!.append('Pending', async (_request, _messages, emit, abortSignal) => {
        signal = abortSignal;
        lateEmit = emit;
        started.resolve();
        await pending.promise;
      });
      await started.promise;
    });

    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => {
      lateEmit('Late response');
      pending.resolve();
      await send;
    });
    expect(onChunk).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
    ctx.destroy();
  });

  it('does not resurrect cleared history through a cached append reference', async () => {
    const ctx = createAskableContext();
    render(<ChatConsumer ctx={ctx} />);
    const append = chatRef!.append;
    let received: string[] = [];

    await act(async () => {
      await append('Old', async (_request, _messages, emit) => { emit('Old reply'); });
      chatRef!.clearMessages();
      await append('New', async (_request, messages) => {
        received = messages.map((message) => message.content);
      });
    });

    expect(received).toEqual(['New']);
    expect(chatRef!.messages).toHaveLength(2);
    ctx.destroy();
  });

  it('sends a reviewed request without resolving live context or applying systemPrompt', async () => {
    const ctx = createAskableContext();
    ctx.push({ company: 'Acme' }, 'Reviewed selection');
    const request = await ctx.toAgentRequest('Explain Acme', {
      packet: true,
      requestId: 'review-1',
      metadata: { source: { id: 'account-1' } },
    });
    const expected = JSON.parse(JSON.stringify(request));
    const resolve = vi.spyOn(ctx, 'toAgentRequest');
    const systemPrompt = vi.fn(() => 'Should not replace the reviewed prompt');
    const handler = vi.fn(async (_request: AskableAgentRequest) => {});
    render(<ChatConsumer ctx={ctx} systemPrompt={systemPrompt} />);
    act(() => { ctx.push({ company: 'Another' }, 'New live selection'); });

    await act(async () => {
      const send = chatRef!.appendRequest(request, handler);
      request.question = 'Changed after send';
      request.packet!.target.text = 'Changed after send';
      (request.metadata!.source as { id: string }).id = 'changed';
      await send;
    });

    expect(resolve).not.toHaveBeenCalled();
    expect(systemPrompt).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toEqual(expected);
    expect(chatRef!.messages[0].content).toBe('Explain Acme');
    expect(chatRef!.messages[0].request).toEqual(expected);
    expect(chatRef!.messages[1].request).toEqual(expected);
    ctx.destroy();
  });

  it('reports non-JSON reviewed requests as errors without dispatch', async () => {
    const ctx = createAskableContext();
    const request = await ctx.toAgentRequest('Explain');
    request.metadata = { circular: request };
    const handler = vi.fn();
    render(<ChatConsumer ctx={ctx} />);

    await act(async () => { await chatRef!.appendRequest(request, handler); });

    expect(chatRef!.status).toBe('error');
    expect(chatRef!.error).toBeInstanceOf(TypeError);
    expect(handler).not.toHaveBeenCalled();
    ctx.destroy();
  });
});
