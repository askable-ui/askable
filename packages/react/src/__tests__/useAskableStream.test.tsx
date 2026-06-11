import { render, act, waitFor } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableStream } from '../useAskableStream.js';

let streamRef: ReturnType<typeof useAskableStream> | undefined;

function StreamConsumer({ ctx }: { ctx: ReturnType<typeof createAskableContext> }) {
  streamRef = useAskableStream({ ctx });
  return null;
}

describe('useAskableStream', () => {
  afterEach(() => {
    streamRef = undefined;
  });

  it('starts in idle state', () => {
    const ctx = createAskableContext();
    render(<StreamConsumer ctx={ctx} />);

    expect(streamRef!.status).toBe('idle');
    expect(streamRef!.isStreaming).toBe(false);
    expect(streamRef!.content).toBe('');
    expect(streamRef!.error).toBeNull();

    ctx.destroy();
  });

  it('accumulates chunks and reaches success', async () => {
    const ctx = createAskableContext();
    render(<StreamConsumer ctx={ctx} />);

    const chunks = ['Hello', ' world', '!'];

    await act(async () => {
      await streamRef!.stream('Greet me', async (_req, emit) => {
        for (const chunk of chunks) emit(chunk);
      });
    });

    expect(streamRef!.status).toBe('success');
    expect(streamRef!.content).toBe('Hello world!');
    expect(streamRef!.isStreaming).toBe(false);

    ctx.destroy();
  });

  it('calls onChunk for every chunk', async () => {
    const ctx = createAskableContext();
    const received: string[] = [];
    streamRef = undefined;

    function WithCallbacks() {
      streamRef = useAskableStream({
        ctx,
        onChunk: (chunk) => received.push(chunk),
      });
      return null;
    }

    render(<WithCallbacks />);

    await act(async () => {
      await streamRef!.stream('Hi', async (_req, emit) => {
        emit('A'); emit('B'); emit('C');
      });
    });

    expect(received).toEqual(['A', 'B', 'C']);
    ctx.destroy();
  });

  it('transitions to error state when handler throws', async () => {
    const ctx = createAskableContext();
    const err = new Error('Stream failed');

    render(<StreamConsumer ctx={ctx} />);

    await act(async () => {
      await streamRef!.stream('Help', async () => { throw err; });
    });

    expect(streamRef!.status).toBe('error');
    expect(streamRef!.error).toBe(err);

    ctx.destroy();
  });

  it('reset() clears content and returns to idle', async () => {
    const ctx = createAskableContext();
    render(<StreamConsumer ctx={ctx} />);

    await act(async () => {
      await streamRef!.stream('Hi', async (_req, emit) => { emit('text'); });
    });

    expect(streamRef!.content).toBe('text');

    act(() => { streamRef!.reset(); });

    expect(streamRef!.status).toBe('idle');
    expect(streamRef!.content).toBe('');

    ctx.destroy();
  });

  it('streamFrom() handles AsyncIterable', async () => {
    const ctx = createAskableContext();
    render(<StreamConsumer ctx={ctx} />);

    async function* gen() {
      yield 'foo';
      yield 'bar';
    }

    await act(async () => {
      await streamRef!.streamFrom('Iterate', gen());
    });

    expect(streamRef!.content).toBe('foobar');
    expect(streamRef!.status).toBe('success');

    ctx.destroy();
  });

  it('onSuccess is called with final content', async () => {
    const ctx = createAskableContext();
    let finalContent = '';

    function WithSuccess() {
      streamRef = useAskableStream({
        ctx,
        onSuccess: (content) => { finalContent = content; },
      });
      return null;
    }

    render(<WithSuccess />);

    await act(async () => {
      await streamRef!.stream('Test', async (_req, emit) => {
        emit('done'); emit('!');
      });
    });

    expect(finalContent).toBe('done!');
    ctx.destroy();
  });
});
