// @vitest-environment node
import { $, component$, noSerialize } from '@builder.io/qwik';
import { createDOM } from '@builder.io/qwik/testing';
import { createAskableContext } from '@askable-ui/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAskableAgent, type UseAskableAgentResult } from '../useAskableAgent.js';
import { useAskableChat, type UseAskableChatResult } from '../useAskableChat.js';
import { useAskableHistory, type UseAskableHistoryResult } from '../useAskableHistory.js';
import { useAskableSource, type UseAskableSourceResult } from '../useAskableSource.js';
import { useAskableStream, type UseAskableStreamResult } from '../useAskableStream.js';

async function waitForMountedContext(result: { ctx: unknown }, expected: unknown): Promise<void> {
  await vi.waitFor(() => expect(result.ctx).toBe(expected));
}

afterEach(() => vi.unstubAllGlobals());

describe('Qwik hook lifecycle', () => {
  it('initializes a private configured context before stream actions run', async () => {
    const holder: { stream?: UseAskableStreamResult } = {};
    const Consumer = component$(() => {
      holder.stream = useAskableStream({ maxHistory: 1 });
      return <div>ready</div>;
    });

    const { render, screen } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);

    expect(holder.stream).toBeDefined();
    await vi.waitFor(() => expect(holder.stream!.ctx).toBeDefined());
    await expect(holder.stream!.stream('question', async (_request, emit) => {
      emit('answer');
    })).resolves.toBe('answer');
  });

  it('resolves the mounted context when stream and chat actions run', async () => {
    const provided = noSerialize(createAskableContext());
    const holder: {
      stream?: UseAskableStreamResult;
      chat?: UseAskableChatResult;
    } = {};
    const Consumer = component$(() => {
      holder.stream = useAskableStream({ ctx: provided });
      holder.chat = useAskableChat({ ctx: provided });
      return <div>ready</div>;
    });

    const { render } = await createDOM();
    await render(<Consumer />);

    expect(holder.stream).toBeDefined();
    expect(holder.chat).toBeDefined();
    await waitForMountedContext(holder.stream!, provided);
    await waitForMountedContext(holder.chat!, provided);

    await expect(holder.stream!.stream('stream question', async (_request, emit) => {
      emit('answer');
    })).resolves.toBe('answer');

    await holder.chat!.append('chat question', async (_request, _messages, emit) => {
      emit('reply');
    });
    expect(holder.chat!.messages.value.at(-1)?.content).toBe('reply');
  });

  it('registers source and history hooks against the mounted context', async () => {
    const provided = noSerialize(createAskableContext());
    const holder: {
      history?: UseAskableHistoryResult;
      source?: UseAskableSourceResult;
    } = {};
    const Consumer = component$(() => {
      holder.history = useAskableHistory({ ctx: provided });
      holder.source = useAskableSource(
        'orders',
        $(() => ({ resolve: () => ({ count: 2 }) })),
        { ctx: provided },
      );
      return <div>ready</div>;
    });

    const { render } = await createDOM();
    await render(<Consumer />);

    expect(holder.history).toBeDefined();
    expect(holder.source).toBeDefined();
    await waitForMountedContext(holder.history!, provided);
    await waitForMountedContext(holder.source!, provided);
    await vi.waitFor(() => expect(provided.hasSource('orders')).toBe(true));

    provided.push({ panel: 'orders' }, 'Orders');
    await vi.waitFor(() => expect(holder.history!.current.value?.meta.panel).toBe('orders'));
    await expect(holder.source!.resolve()).resolves.toMatchObject({ data: { count: 2 } });
  });

  it('creates an externally owned context from a resume-safe QRL factory', async () => {
    const holder: { stream?: UseAskableStreamResult } = {};
    const contextFactory = $(() => createAskableContext());
    const Consumer = component$(() => {
      holder.stream = useAskableStream({ ctx$: contextFactory });
      return <div>ready</div>;
    });

    const { render, screen } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);

    expect(holder.stream).toBeDefined();
    await vi.waitFor(() => expect(holder.stream!.ctx).toBeDefined());
    await expect(
      holder.stream!.stream('question', async (_request, emit) => emit('answer')),
    ).resolves.toBe('answer');
  });

  it('uses the mounted shared lifecycle for agent requests', async () => {
    const provided = noSerialize(createAskableContext());
    const holder: { agent?: UseAskableAgentResult<string> } = {};
    const Consumer = component$(() => {
      holder.agent = useAskableAgent<string>({ ctx: provided });
      return <div>ready</div>;
    });

    const { render } = await createDOM();
    await render(<Consumer />);

    expect(holder.agent).toBeDefined();
    await waitForMountedContext(holder.agent!, provided);
    await expect(holder.agent!.send('question', async () => 'answer')).resolves.toBe('answer');
    expect(holder.agent!.data.value).toBe('answer');
  });

});
