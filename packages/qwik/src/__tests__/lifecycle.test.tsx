// @vitest-environment node
import { $, component$, noSerialize, sync$, useSignal } from '@builder.io/qwik';
import { createDOM } from '@builder.io/qwik/testing';
import { createAskableContext } from '@askable-ui/core';
import type { AskableAgentRequest, AskableContextSource } from '@askable-ui/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAskableAgent, type UseAskableAgentResult } from '../useAskableAgent.js';
import {
  useAskableChat,
  type AskableChatMessage,
  type AskableChatStreamHandler,
  type UseAskableChatResult,
} from '../useAskableChat.js';
import { useAskableHistory, type UseAskableHistoryResult } from '../useAskableHistory.js';
import { useAskableNotificationSource } from '../useAskableNotificationSource.js';
import { useAskableCartSource } from '../useAskableCartSource.js';
import { useAskableErrorSource } from '../useAskableErrorSource.js';
import { useAskableMultistepSource } from '../useAskableMultistepSource.js';
import { useAskableNavigationSource } from '../useAskableNavigationSource.js';
import { useAskablePageSource } from '../useAskablePageSource.js';
import { useAskableFormSource } from '../useAskableFormSource.js';
import { useAskableTableSource } from '../useAskableTableSource.js';
import { useAskableSource, type UseAskableSourceResult } from '../useAskableSource.js';
import {
  useAskableStream,
  type AskableStreamHandler,
  type UseAskableStreamResult,
} from '../useAskableStream.js';

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

  it('reconstructs QRL context callbacks forwarded through specialized hooks', async () => {
    const holder: { stream?: UseAskableStreamResult } = {};
    const Consumer = component$(() => {
      holder.stream = useAskableStream({
        sanitizeText: sync$((text) => `safe:${text}`),
      });
      return <div>ready</div>;
    });

    const { render, screen } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);
    await vi.waitFor(() => expect(holder.stream!.ctx).toBeDefined());

    holder.stream!.ctx.push({ field: 'note' }, 'private');
    expect(holder.stream!.ctx.getFocus()?.text).toBe('safe:private');
  });

  it('resolves the mounted context when stream and chat actions run', async () => {
    const provided = noSerialize(createAskableContext())!;
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
    const provided = noSerialize(createAskableContext())!;
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
    const provided = noSerialize(createAskableContext())!;
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

  it('executes stream actions from an optimizer-generated event QRL', async () => {
    const Consumer = component$(() => {
      const stream = useAskableStream();
      const handler = $(async (
        _request: AskableAgentRequest,
        emit: (chunk: string) => void,
      ) => emit('answer'));
      return (
        <>
          <button onClick$={() => stream.stream('question', handler)}>Run stream</button>
          <output>{stream.content.value}</output>
        </>
      );
    });

    const { render, screen, userEvent } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);
    await userEvent('button', 'click');

    await vi.waitFor(() => expect(screen.querySelector('output')?.textContent).toBe('answer'));
  });

  it('invokes resumable stream callbacks from an event action', async () => {
    const Consumer = component$(() => {
      const events = useSignal('');
      const stream = useAskableStream({
        onRequest: $((request) => ({
          ...request,
          question: `${request.question}!`,
        })),
        onChunk: $((chunk, content) => {
          events.value += `chunk:${chunk}:${content};`;
        }),
        onSuccess: $((content) => {
          events.value += `success:${content}`;
        }),
      });
      const handler = $(async (
        request: AskableAgentRequest,
        emit: (chunk: string) => void,
      ) => emit(request.question));
      return (
        <>
          <button onClick$={() => stream.stream('question', handler)}>Run</button>
          <output id="callback-content">{stream.content.value}</output>
          <output id="callback-events">{events.value}</output>
        </>
      );
    });

    const { render, screen, userEvent } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);
    await userEvent('button', 'click');

    await vi.waitFor(() => {
      expect(screen.querySelector('#callback-content')?.textContent).toBe('question!');
      expect(screen.querySelector('#callback-events')?.textContent)
        .toBe('chunk:question!:question!;success:question!');
    });
  });

  it('executes chat actions from an optimizer-generated event QRL', async () => {
    const Consumer = component$(() => {
      const chat = useAskableChat();
      const handler = $(async (
        _request: AskableAgentRequest,
        _messages: AskableChatMessage[],
        emit: (chunk: string) => void,
      ) => emit('reply'));
      return (
        <>
          <button onClick$={() => chat.append('question', handler)}>Run chat</button>
          <output>{chat.messages.value.at(-1)?.content}</output>
        </>
      );
    });

    const { render, screen, userEvent } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);
    await userEvent('button', 'click');

    await vi.waitFor(() => expect(screen.querySelector('output')?.textContent).toBe('reply'));
  });

  it('keeps stream ownership with the newest overlapping preflight', async () => {
    const provided = noSerialize(createAskableContext())!;
    const toAgentRequest = provided.toAgentRequest.bind(provided);
    provided.toAgentRequest = async (question, requestOptions) => {
      await new Promise((resolve) => setTimeout(resolve, question === 'first' ? 30 : 1));
      return toAgentRequest(question, requestOptions);
    };
    const holder: { stream?: UseAskableStreamResult } = {};
    const Consumer = component$(() => {
      holder.stream = useAskableStream({ ctx: provided });
      return <div>ready</div>;
    });

    const { render, screen } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);
    await waitForMountedContext(holder.stream!, provided);

    const handler = (async (
      request: AskableAgentRequest,
      emit: (chunk: string) => void,
    ) => emit(request.question)) as unknown as AskableStreamHandler;
    const first = holder.stream!.stream('first', handler);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = holder.stream!.stream('second', handler);
    await Promise.all([first, second]);

    expect(holder.stream!.content.value).toBe('second');
    expect(holder.stream!.lastRequest.value?.question).toBe('second');
    expect(holder.stream!.status.value).toBe('success');
    expect(holder.stream!.isStreaming.value).toBe(false);
  });

  it('suppresses a stale stream result when onSuccess starts a replacement', async () => {
    const provided = noSerialize(createAskableContext())!;
    const holder: {
      stream?: UseAskableStreamResult;
      successStarted?: ReturnType<typeof useSignal<boolean>>;
    } = {};
    const Consumer = component$(() => {
      const successStarted = useSignal(false);
      holder.successStarted = successStarted;
      holder.stream = useAskableStream({
        ctx: provided,
        onSuccess: $(async (result) => {
          if (result !== 'first') return;
          successStarted.value = true;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }),
      });
      return <div>ready</div>;
    });

    const { render, screen } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);
    await waitForMountedContext(holder.stream!, provided);

    const handler = (async (
      request: AskableAgentRequest,
      emit: (chunk: string) => void,
    ) => emit(request.question)) as unknown as AskableStreamHandler;
    const first = holder.stream!.stream('first', handler);
    await vi.waitFor(() => expect(holder.successStarted?.value).toBe(true));
    const second = holder.stream!.stream('second', handler);

    await expect(second).resolves.toBe('second');
    await expect(first).resolves.toBeUndefined();
    expect(holder.stream!.content.value).toBe('second');
  });

  it('preserves stream abort and reset behavior with QRL actions', async () => {
    const holder: { stream?: UseAskableStreamResult } = {};
    const Consumer = component$(() => {
      holder.stream = useAskableStream();
      return <div>ready</div>;
    });

    const { render, screen } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);
    await vi.waitFor(() => expect(holder.stream!.ctx).toBeDefined());
    const stream = holder.stream!;

    const delayedHandler = (async (
      _request: AskableAgentRequest,
      emit: (chunk: string) => void,
      signal: AbortSignal,
    ) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (!signal.aborted) emit('late');
    }) as unknown as AskableStreamHandler;
    const pending = stream.stream('question', delayedHandler);
    await vi.waitFor(() => expect(stream.isStreaming.value).toBe(true));
    await stream.abort();
    await pending;

    expect(stream.content.value).toBe('');
    expect(stream.status.value).toBe('idle');
    expect(stream.isStreaming.value).toBe(false);

    const immediateHandler = (
      (_request: AskableAgentRequest, emit: (chunk: string) => void) => emit('answer')
    ) as unknown as AskableStreamHandler;
    await stream.stream('again', immediateHandler);
    expect(stream.content.value).toBe('answer');
    await stream.reset();
    expect(stream.content.value).toBe('');
    expect(stream.status.value).toBe('idle');
    expect(stream.lastRequest.value).toBeNull();
  });

  it('propagates chat abort and suppresses stale chunks', async () => {
    const Consumer = component$(() => {
      const chat = useAskableChat();
      const handler = $(async (
        _request: AskableAgentRequest,
        _messages: AskableChatMessage[],
        emit: (chunk: string) => void,
        signal: AbortSignal,
      ) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (!signal.aborted) emit('late');
      });
      return (
        <>
          <button id="append" onClick$={() => { void chat.append('question', handler); }}>Append</button>
          <button id="abort" onClick$={() => { void chat.abort(); }}>Abort</button>
          <output id="message">{chat.messages.value.at(-1)?.content}</output>
          <output id="chat-status">{chat.status.value}:{String(chat.isStreaming.value)}</output>
        </>
      );
    });

    const { render, screen, userEvent } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);
    await userEvent('#append', 'click');
    await userEvent('#abort', 'click');

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.querySelector('#message')?.textContent).toBe('');
    expect(screen.querySelector('#chat-status')?.textContent).toBe('idle:false');
  });

  it('keeps chat messages owned by the newest overlapping preflight', async () => {
    const provided = noSerialize(createAskableContext())!;
    const toAgentRequest = provided.toAgentRequest.bind(provided);
    provided.toAgentRequest = async (question, requestOptions) => {
      await new Promise((resolve) => setTimeout(resolve, question === 'first' ? 30 : 1));
      return toAgentRequest(question, requestOptions);
    };
    const holder: { chat?: UseAskableChatResult } = {};
    const Consumer = component$(() => {
      holder.chat = useAskableChat({ ctx: provided });
      return <div>ready</div>;
    });

    const { render } = await createDOM();
    await render(<Consumer />);
    await waitForMountedContext(holder.chat!, provided);

    const handler = (async function chatHandler(
      request: AskableAgentRequest,
      _messages: AskableChatMessage[],
      emit: (chunk: string) => void,
    ) {
      emit(request.question);
    }) as unknown as AskableChatStreamHandler;
    const first = holder.chat!.append('first', handler);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = holder.chat!.append('second', handler);
    await Promise.all([first, second]);

    expect(holder.chat!.messages.value.map(({ role, content }) => ({ role, content })))
      .toEqual([
        { role: 'user', content: 'second' },
        { role: 'assistant', content: 'second' },
      ]);
    expect(holder.chat!.status.value).toBe('idle');
    expect(holder.chat!.isStreaming.value).toBe(false);
  });

  it('handles stream and chat preflight failures without invoking transports', async () => {
    const provided = noSerialize(createAskableContext())!;
    provided.toAgentRequest = async () => {
      throw new Error('preflight failed');
    };
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
    await waitForMountedContext(holder.stream!, provided);
    await waitForMountedContext(holder.chat!, provided);

    const streamHandler = (() => {
      throw new Error('stream handler must not run');
    }) as unknown as AskableStreamHandler;
    const chatHandler = (() => {
      throw new Error('chat handler must not run');
    }) as unknown as AskableChatStreamHandler;

    await expect(holder.stream!.stream('question', streamHandler)).resolves.toBeUndefined();
    await expect(holder.chat!.append('question', chatHandler)).resolves.toBeUndefined();

    expect(holder.stream!.status.value).toBe('error');
    expect(holder.stream!.error.value).toEqual(new Error('preflight failed'));
    expect(holder.stream!.isStreaming.value).toBe(false);
    expect(holder.chat!.messages.value).toEqual([]);
    expect(holder.chat!.status.value).toBe('error');
    expect(holder.chat!.error.value).toEqual(new Error('preflight failed'));
    expect(holder.chat!.isStreaming.value).toBe(false);
  });

  it('aborts active stream and chat handlers when their component unmounts', async () => {
    const holder: {
      stream?: UseAskableStreamResult;
      chat?: UseAskableChatResult;
    } = {};
    const signals: AbortSignal[] = [];
    const Consumer = component$(() => {
      holder.stream = useAskableStream();
      holder.chat = useAskableChat();
      return <div>ready</div>;
    });

    const { render, screen } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    const rendered = await render(<Consumer />);
    await vi.waitFor(() => {
      expect(holder.stream!.ctx).toBeDefined();
      expect(holder.chat!.ctx).toBeDefined();
    });

    const streamHandler = (async function streamCleanupHandler(
      _request: AskableAgentRequest,
      _emit: (chunk: string) => void,
      signal: AbortSignal,
    ) {
      signals.push(signal);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }) as unknown as AskableStreamHandler;
    const chatHandler = (async function chatCleanupHandler(
      _request: AskableAgentRequest,
      _messages: AskableChatMessage[],
      _emit: (chunk: string) => void,
      signal: AbortSignal,
    ) {
      signals.push(signal);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }) as unknown as AskableChatStreamHandler;

    const streamPending = holder.stream!.stream('stream', streamHandler);
    const chatPending = holder.chat!.append('chat', chatHandler);
    await vi.waitFor(() => expect(signals).toHaveLength(2));
    rendered.cleanup();

    await vi.waitFor(() => {
      expect(signals.every((signal) => signal.aborted)).toBe(true);
    });
    await Promise.all([streamPending, chatPending]);
  });

  it('prevents late async source factories from registering after unregister', async () => {
    const provided = noSerialize(createAskableContext())!;
    const holder: {
      source?: UseAskableSourceResult;
      started?: ReturnType<typeof useSignal<boolean>>;
    } = {};
    const Consumer = component$(() => {
      const started = useSignal(false);
      holder.started = started;
      holder.source = useAskableSource(
        'delayed',
        $(async () => {
          started.value = true;
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { resolve: () => ({ ready: true }) };
        }),
        { ctx: provided },
      );
      return <div>ready</div>;
    });

    const { render } = await createDOM();
    await render(<Consumer />);
    await vi.waitFor(() => expect(holder.started?.value).toBe(true));
    await holder.source!.unregister();
    await new Promise((resolve) => setTimeout(resolve, 75));

    expect(provided.hasSource('delayed')).toBe(false);
  });

  it('executes generic source actions from an optimizer-generated event QRL', async () => {
    const Consumer = component$(() => {
      const resolved = useSignal('');
      const source = useAskableSource(
        'orders',
        $(() => ({ resolve: () => ({ count: 2 }) })),
      );
      return (
        <>
          <button onClick$={async () => {
            const value = await source.resolve();
            resolved.value = String((value.data as { count: number }).count);
          }}>Resolve source</button>
          <output>{resolved.value}</output>
        </>
      );
    });

    const { render, screen, userEvent } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);
    await vi.waitFor(() => expect(screen.ownerDocument.body.textContent).toContain('Resolve source'));
    await userEvent('button', 'click');

    await vi.waitFor(() => expect(screen.querySelector('output')?.textContent).toBe('2'));
  });

  it('executes source-helper actions from an optimizer-generated event QRL', async () => {
    const Consumer = component$(() => {
      const notifications = useAskableNotificationSource();
      return (
        <>
          <button onClick$={() => notifications.push({
            message: 'Saved',
            severity: 'success',
          })}>Push notification</button>
          <output>{notifications.notifications.value[0]?.message}</output>
        </>
      );
    });

    const { render, screen, userEvent } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);
    await userEvent('button', 'click');

    await vi.waitFor(() => expect(screen.querySelector('output')?.textContent).toBe('Saved'));
  });

  it('executes agent actions from an optimizer-generated event QRL', async () => {
    const Consumer = component$(() => {
      const agent = useAskableAgent<string>();
      const handler = $((_request: AskableAgentRequest) => 'answer');
      return (
        <>
          <button onClick$={() => agent.send('question', handler)}>Run agent</button>
          <output>{agent.data.value}</output>
        </>
      );
    });

    const { render, screen, userEvent } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);
    await userEvent('button', 'click');

    await vi.waitFor(() => expect(screen.querySelector('output')?.textContent).toBe('answer'));
  });

  it('executes all mutable source-helper actions from event QRLs', async () => {
    const Consumer = component$(() => {
      const cart = useAskableCartSource();
      const errors = useAskableErrorSource();
      const steps = useAskableMultistepSource({
        steps: [{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }],
      });
      return (
        <>
          <button id="cart" onClick$={() => cart.addItem({
            id: 'sku',
            name: 'Item',
            price: 10,
            quantity: 1,
          })}>Add cart item</button>
          <button id="error" onClick$={() => errors.addError({
            key: 'email',
            message: 'Required',
          })}>Add error</button>
          <button id="step" onClick$={() => steps.next()}>Next step</button>
          <output id="cart-output">{cart.snapshot.value?.itemCount}</output>
          <output id="error-output">{errors.errors.value[0]?.message}</output>
          <output id="step-output">{steps.snapshot.value?.currentIndex}</output>
        </>
      );
    });

    const { render, screen, userEvent } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);
    await userEvent('#cart', 'click');
    await userEvent('#error', 'click');
    await userEvent('#step', 'click');

    await vi.waitFor(() => {
      expect(screen.querySelector('#cart-output')?.textContent).toBe('1');
      expect(screen.querySelector('#error-output')?.textContent).toBe('Required');
      expect(screen.querySelector('#step-output')?.textContent).toBe('1');
    });
  });

  it('preserves direct page roots and form factories for client-only mounts', async () => {
    const holder: {
      page?: ReturnType<typeof useAskablePageSource>;
      form?: ReturnType<typeof useAskableFormSource>;
      factoryForm?: ReturnType<typeof useAskableFormSource>;
    } = {};
    const Consumer = component$(() => {
      const pageValue = useSignal('');
      const formValue = useSignal('');
      const page = useAskablePageSource({
        root: document.body,
        textExtractor: sync$((root) => root.textContent ?? ''),
      });
      const directForm = document.createElement('form');
      const form = useAskableFormSource({ form: directForm });
      const factoryForm = useAskableFormSource({
        id: 'factory-form',
        form: () => undefined,
      });
      holder.page = page;
      holder.form = form;
      holder.factoryForm = factoryForm;
      return (
        <>
          <article>Client root content</article>
          <button id="resolve-client-sources" onClick$={async () => {
            const pageResult = await page.resolve({ mode: 'all' });
            pageValue.value = String((pageResult.data as { text?: string }).text?.includes('Client root content'));
            formValue.value = String(form.ctx.hasSource('form'));
          }}>Resolve client sources</button>
          <output id="page-client-output">{pageValue.value}</output>
          <output id="form-client-output">{formValue.value}</output>
        </>
      );
    });

    const { render, screen, userEvent } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    await render(<Consumer />);
    await vi.waitFor(() => {
      expect(holder.page!.ctx.hasSource('page')).toBe(true);
      expect(holder.form!.ctx.hasSource('form')).toBe(true);
      expect(holder.factoryForm!.ctx.hasSource('factory-form')).toBe(true);
    });
    await userEvent('#resolve-client-sources', 'click');

    await vi.waitFor(() => {
      expect(screen.querySelector('#page-client-output')?.textContent).toBe('true');
      expect(screen.querySelector('#form-client-output')?.textContent).toBe('true');
    });
  });

  it('reconstructs stateless source helpers from QRL factories', async () => {
    const Consumer = component$(() => {
      const navigationValue = useSignal('');
      const tableValue = useSignal('');
      const navigation = useAskableNavigationSource({
        getPath: sync$(() => '/resumed'),
      });
      const table = useAskableTableSource({
        rows: $(() => Array.from({ length: 101 }, (_, index) => ({ id: `row-${index}` }))),
      });
      return (
        <>
          <button id="navigation" onClick$={async () => {
            const value = await navigation.resolve();
            navigationValue.value = String((value.data as { currentPath: string }).currentPath);
          }}>Resolve navigation</button>
          <button id="table" onClick$={async () => {
            const value = await table.resolve({ mode: 'all' });
            const data = value.data as { items?: Array<{ id: string }> };
            tableValue.value = `${data.items?.[0]?.id ?? ''}:${data.items?.length ?? 0}`;
          }}>Resolve table</button>
          <output id="navigation-output">{navigationValue.value}</output>
          <output id="table-output">{tableValue.value}</output>
        </>
      );
    });

    const { render, screen, userEvent } = await createDOM();
    vi.stubGlobal('document', screen.ownerDocument);
    vi.stubGlobal('window', screen.ownerDocument.defaultView);
    await render(<Consumer />);
    await vi.waitFor(() => expect(screen.ownerDocument.body.textContent).toContain('Resolve table'));
    await userEvent('#navigation', 'click');
    await userEvent('#table', 'click');

    await vi.waitFor(() => {
      expect(screen.querySelector('#navigation-output')?.textContent).toBe('/resumed');
      expect(screen.querySelector('#table-output')?.textContent).toBe('row-0:100');
    });
  });

  // Keep this teardown assertion last: Qwik's createDOM cleanup closes its
  // render scheduler and intentionally cannot be followed by another render.
  it('unregisters a source exactly once across manual release and cleanup', async () => {
    const provided = noSerialize(createAskableContext())!;
    const unregister = vi.fn();
    const registerSource = provided.registerSource.bind(provided);
    vi.spyOn(provided, 'registerSource').mockImplementation((
      id: string,
      source: AskableContextSource,
    ) => {
      const handle = registerSource(id, source);
      return {
        ...handle,
        unregister: () => {
          unregister();
          handle.unregister();
        },
      };
    });
    const holder: { source?: UseAskableSourceResult } = {};
    const Consumer = component$(() => {
      holder.source = useAskableSource(
        'once',
        $(() => ({ resolve: () => ({ ready: true }) })),
        { ctx: provided },
      );
      return <div>ready</div>;
    });

    const { render } = await createDOM();
    const rendered = await render(<Consumer />);
    await vi.waitFor(() => expect(provided.hasSource('once')).toBe(true));
    await holder.source!.unregister();
    rendered.cleanup();

    expect(unregister).toHaveBeenCalledTimes(1);
  });

});
