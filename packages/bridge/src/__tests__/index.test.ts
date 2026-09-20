import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebContextPacket } from '@askable-ui/context';
import {
  ASKABLE_BRIDGE_CHANNEL,
  ASKABLE_BRIDGE_PROTOCOL,
  ASKABLE_BRIDGE_VERSION,
  createAskableBridge,
  createAskableBridgeEnvelope,
  createBrowserExtensionTransport,
  createFunctionTransport,
  createHttpTransport,
  createPostMessageTransport,
  isAskableBridgeEnvelope,
  isAskableBridgeVersionSupported,
} from '../index';
import type { AskableBridgeTransport } from '../index';

const packet = createWebContextPacket({
  capture: { mode: 'element-focus', gesture: 'click' },
  target: {
    label: 'Revenue card',
    text: '$24k MRR',
    metadata: { metric: 'mrr', value: 24000 },
  },
  privacy: { consent: 'explicit', redacted: true },
});

const unredactedPacket = createWebContextPacket({
  capture: { mode: 'element-focus' },
  privacy: { consent: 'implicit', redacted: false },
});

function stubTransport(id: string, send: AskableBridgeTransport['send']): AskableBridgeTransport {
  return { id, send };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('@askable-ui/bridge', () => {
  it('creates a versioned bridge envelope around a context packet', () => {
    const envelope = createAskableBridgeEnvelope(packet, {
      requestId: 'req_1',
      question: 'What changed?',
      prompt: 'Use the selected revenue card.',
      destination: { kind: 'app-chat', label: 'Support chat' },
    });

    expect(envelope).toMatchObject({
      protocol: ASKABLE_BRIDGE_PROTOCOL,
      version: ASKABLE_BRIDGE_VERSION,
      channel: ASKABLE_BRIDGE_CHANNEL,
      requestId: 'req_1',
      consent: 'explicit',
      destination: { kind: 'app-chat', label: 'Support chat' },
      payload: {
        packet,
        question: 'What changed?',
        prompt: 'Use the selected revenue card.',
      },
    });
    expect(isAskableBridgeEnvelope(envelope)).toBe(true);
  });

  it('sends current context through registered transports', async () => {
    const handler = vi.fn();
    const bridge = createAskableBridge({
      provider: {
        getPacket: () => packet,
        formatPrompt: (current) => `Current selection: ${current.target?.label}`,
      },
      transports: [createFunctionTransport(handler, { id: 'capture' })],
    });

    const result = await bridge.sendPrompt('Summarize this', { requestId: 'req_2' });

    expect(result).toEqual([{ ok: true, requestId: 'req_2', transportId: 'capture', response: undefined }]);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req_2',
        payload: expect.objectContaining({
          question: 'Summarize this',
          prompt: 'Current selection: Revenue card',
        }),
      }),
      expect.objectContaining({ requestId: 'req_2', question: 'Summarize this' }),
    );
  });

  it('posts bridge messages to a supplied window target', async () => {
    const postMessage = vi.fn();
    const transport = createPostMessageTransport({
      targetWindow: { postMessage } as unknown as Window,
      targetOrigin: 'https://example.com',
    });

    const ack = await transport.send(createAskableBridgeEnvelope(packet, { requestId: 'req_3' }));

    expect(ack).toEqual({ ok: true, requestId: 'req_3', transportId: 'postmessage' });
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'askable:bridge:context',
        envelope: expect.objectContaining({ requestId: 'req_3' }),
      },
      'https://example.com',
    );
  });

  it('sends context through browser extension runtimes', async () => {
    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({ received: true }),
    };
    const transport = createBrowserExtensionTransport({ runtime });

    const ack = await transport.send(createAskableBridgeEnvelope(packet, { requestId: 'req_4' }));

    expect(runtime.sendMessage).toHaveBeenCalledWith({
      type: 'askable:bridge:context',
      envelope: expect.objectContaining({ requestId: 'req_4' }),
    });
    expect(ack).toEqual({
      ok: true,
      requestId: 'req_4',
      transportId: 'browser-extension',
      response: { received: true },
    });
  });

  it('sends context to HTTP destinations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accepted: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const transport = createHttpTransport({
      url: 'https://api.example.com/context',
      headers: { authorization: 'Bearer secret' },
      fetch: fetchMock,
    });

    const ack = await transport.send(createAskableBridgeEnvelope(packet, { requestId: 'req_5' }));

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/context',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer secret',
          'content-type': 'application/json',
        }),
      }),
    );
    expect(ack).toEqual({
      ok: true,
      requestId: 'req_5',
      transportId: 'http',
      response: { accepted: true },
    });
  });
});

describe('postMessage target origin', () => {
  it('falls back to the sending page origin instead of broadcasting', async () => {
    const postMessage = vi.fn();
    vi.stubGlobal('window', { location: { origin: 'https://app.example' } });

    const transport = createPostMessageTransport({ targetWindow: { postMessage } as unknown as Window });
    await transport.send(createAskableBridgeEnvelope(packet, { requestId: 'req_origin' }));

    expect(postMessage).toHaveBeenCalledWith(expect.anything(), 'https://app.example');
  });

  it('throws rather than broadcasting when no origin can be determined', async () => {
    const transport = createPostMessageTransport({
      targetWindow: { postMessage: vi.fn() } as unknown as Window,
    });

    await expect(transport.send(createAskableBridgeEnvelope(packet))).rejects.toThrow(/target origin/i);
  });

  it('broadcasts to every origin only when explicitly opted in', async () => {
    const postMessage = vi.fn();
    const transport = createPostMessageTransport({
      targetWindow: { postMessage } as unknown as Window,
      allowAnyOrigin: true,
    });

    await transport.send(createAskableBridgeEnvelope(packet, { requestId: 'req_any' }));

    expect(postMessage).toHaveBeenCalledWith(expect.anything(), '*');
  });
});

describe('HTTP transport headers', () => {
  const cases: Array<[string, HeadersInit]> = [
    ['plain object', { authorization: 'Bearer secret' }],
    ['Headers instance', new Headers({ authorization: 'Bearer secret' })],
    ['entry array', [['authorization', 'Bearer secret']]],
  ];

  it.each(cases)('forwards auth headers supplied as a %s', async (_label, headers) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const transport = createHttpTransport({ url: 'https://api.example.com', headers, fetch: fetchMock });
    await transport.send(createAskableBridgeEnvelope(packet));

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      authorization: 'Bearer secret',
      'content-type': 'application/json',
    });
  });

  it('resolves headers returned from a function', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const transport = createHttpTransport({
      url: 'https://api.example.com',
      headers: () => new Headers({ authorization: 'Bearer rotated' }),
      fetch: fetchMock,
    });
    await transport.send(createAskableBridgeEnvelope(packet));

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ authorization: 'Bearer rotated' });
  });

  it('reports the response body on a failed request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('token expired', { status: 403, statusText: 'Forbidden' }),
    );

    const transport = createHttpTransport({ url: 'https://api.example.com', fetch: fetchMock });
    const ack = await transport.send(createAskableBridgeEnvelope(packet, { requestId: 'req_403' }));

    expect(ack).toEqual({
      ok: false,
      requestId: 'req_403',
      transportId: 'http',
      message: 'HTTP 403 Forbidden: token expired',
      response: 'token expired',
    });
  });

  it('truncates long error bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('x'.repeat(100), { status: 500 }));
    const transport = createHttpTransport({
      url: 'https://api.example.com',
      fetch: fetchMock,
      maxErrorBodyChars: 10,
    });

    const ack = await transport.send(createAskableBridgeEnvelope(packet));

    expect(ack.response).toBe(`${'x'.repeat(10)}…`);
  });
});

describe('transport registry', () => {
  it('rejects duplicate transport ids instead of silently replacing', () => {
    expect(() => createAskableBridge({
      transports: [
        createHttpTransport({ url: '/a', fetch: vi.fn() }),
        createHttpTransport({ url: '/b', fetch: vi.fn() }),
      ],
    })).toThrow(/already has a transport with id "http"/);
  });

  it('accepts several transports of the same kind under distinct ids', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const bridge = createAskableBridge({
      transports: [
        createFunctionTransport(first, { id: 'chat' }),
        createFunctionTransport(second, { id: 'audit' }),
      ],
    });

    const acks = await bridge.send(packet);

    expect(acks.map((ack) => ack.transportId)).toEqual(['chat', 'audit']);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('unregisters by identity, not by id', async () => {
    const original = createFunctionTransport(vi.fn(), { id: 'chat' });
    const bridge = createAskableBridge({});
    const unregister = bridge.registerTransport(original);

    unregister();
    const replacement = vi.fn();
    bridge.registerTransport(createFunctionTransport(replacement, { id: 'chat' }));
    unregister(); // stale handle must not remove the replacement

    await bridge.send(packet);
    expect(replacement).toHaveBeenCalledOnce();
  });

  it('throws when no transports are registered', async () => {
    const bridge = createAskableBridge({});
    await expect(bridge.send(packet)).rejects.toThrow(/no transports/i);
  });
});

describe('partial transport failure', () => {
  it('keeps acks from healthy transports when one throws', async () => {
    const bridge = createAskableBridge({
      transports: [
        stubTransport('broken', async () => {
          throw new Error('runtime unavailable');
        }),
        createFunctionTransport(() => 'delivered', { id: 'chat' }),
      ],
    });

    const acks = await bridge.send(packet, { requestId: 'req_partial' });

    expect(acks).toEqual([
      { ok: false, requestId: 'req_partial', transportId: 'broken', message: 'runtime unavailable' },
      { ok: true, requestId: 'req_partial', transportId: 'chat', response: 'delivered' },
    ]);
  });
});

describe('privacy policy', () => {
  it('refuses unredacted packets when requireRedacted is set', async () => {
    const handler = vi.fn();
    const bridge = createAskableBridge({
      requireRedacted: true,
      transports: [createFunctionTransport(handler)],
    });

    await expect(bridge.send(unredactedPacket)).rejects.toThrow(/unredacted/i);
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses packets outside the allowed consent list', async () => {
    const handler = vi.fn();
    const bridge = createAskableBridge({
      allowedConsent: ['explicit'],
      transports: [createFunctionTransport(handler)],
    });

    await expect(bridge.send(unredactedPacket)).rejects.toThrow(/consent "implicit"/);
    await expect(bridge.send(packet)).resolves.toHaveLength(1);
  });

  it('rejects envelopes over the configured size limit', async () => {
    const handler = vi.fn();
    const bridge = createAskableBridge({
      maxEnvelopeBytes: 32,
      transports: [createFunctionTransport(handler)],
    });

    await expect(bridge.send(packet)).rejects.toThrow(/over the 32 byte limit/);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('abort handling', () => {
  it('does not dispatch when the caller signal is already aborted', async () => {
    const handler = vi.fn();
    const bridge = createAskableBridge({ transports: [createFunctionTransport(handler)] });
    const controller = new AbortController();
    controller.abort(new Error('user cancelled'));

    await expect(bridge.send(packet, { signal: controller.signal })).rejects.toThrow('user cancelled');
    expect(handler).not.toHaveBeenCalled();
  });

  it('aborts in-flight sends on dispose', async () => {
    let observed: AbortSignal | undefined;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const bridge = createAskableBridge({
      transports: [
        stubTransport('slow', async (envelope, options) => {
          observed = options?.signal;
          await gate;
          return { ok: true, requestId: envelope.requestId, transportId: 'slow' };
        }),
      ],
    });

    const pending = bridge.send(packet);
    await Promise.resolve();

    expect(observed?.aborted).toBe(false);
    bridge.dispose();
    expect(observed?.aborted).toBe(true);

    release();
    await pending;
  });
});

describe('agent request interop', () => {
  it('sends a core toAgentRequest() payload without re-resolving context', async () => {
    const handler = vi.fn();
    const getPacket = vi.fn(() => packet);
    const bridge = createAskableBridge({
      provider: { getPacket },
      transports: [createFunctionTransport(handler, { id: 'chat' })],
    });

    await bridge.sendAgentRequest({
      requestId: 'req_agent',
      question: 'Why did this account churn?',
      context: 'Revenue card — $24k MRR',
      packet,
      metadata: { surface: 'cmd-k' },
    });

    expect(getPacket).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req_agent',
        payload: {
          packet,
          question: 'Why did this account churn?',
          prompt: 'Revenue card — $24k MRR',
          metadata: { surface: 'cmd-k' },
        },
      }),
      expect.anything(),
    );
  });

  it('falls back to the provider when the request carries no packet', async () => {
    const handler = vi.fn();
    const bridge = createAskableBridge({
      provider: { getPacket: () => packet },
      transports: [createFunctionTransport(handler, { id: 'chat' })],
    });

    await bridge.sendAgentRequest({ question: 'What is on screen?' });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ question: 'What is on screen?', packet }),
      }),
      expect.anything(),
    );
  });

  it('rejects a request without a question', async () => {
    const bridge = createAskableBridge({ transports: [createFunctionTransport(vi.fn())] });

    await expect(
      bridge.sendAgentRequest({ question: undefined as unknown as string }),
    ).rejects.toThrow(/question/);
  });
});

describe('envelope validation', () => {
  const envelope = createAskableBridgeEnvelope(packet, { requestId: 'req_guard' });

  it('accepts envelopes from the same major version', () => {
    expect(isAskableBridgeVersionSupported('0.1')).toBe(true);
    expect(isAskableBridgeVersionSupported('0.9')).toBe(true);
    expect(isAskableBridgeVersionSupported('1.0')).toBe(false);
    expect(isAskableBridgeVersionSupported(undefined)).toBe(false);
    expect(isAskableBridgeEnvelope({ ...envelope, version: '0.4' })).toBe(true);
    expect(isAskableBridgeEnvelope({ ...envelope, version: '1.0' })).toBe(false);
  });

  it.each([
    ['an array', []],
    ['a foreign protocol', { ...envelope, protocol: 'other' }],
    ['a foreign channel', { ...envelope, channel: 'other' }],
    ['an empty request id', { ...envelope, requestId: '' }],
    ['a missing consent value', { ...envelope, consent: undefined }],
    ['an invalid consent value', { ...envelope, consent: 'maybe' }],
    ['a missing packet', { ...envelope, payload: {} }],
    ['an array payload', { ...envelope, payload: [] }],
  ])('rejects %s', (_label, value) => {
    expect(isAskableBridgeEnvelope(value)).toBe(false);
  });
});
