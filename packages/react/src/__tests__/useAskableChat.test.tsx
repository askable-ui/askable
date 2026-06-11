import { render, act, waitFor } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableChat, type UseAskableChatResult } from '../useAskableChat.js';

let chatRef: UseAskableChatResult | undefined;

function ChatConsumer({ ctx }: { ctx: ReturnType<typeof createAskableContext> }) {
  chatRef = useAskableChat({ ctx });
  return null;
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
});
