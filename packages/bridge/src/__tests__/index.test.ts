import { describe, expect, it, vi } from 'vitest';
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
} from '../index';

const packet = createWebContextPacket({
  capture: { mode: 'element-focus', gesture: 'click' },
  target: {
    label: 'Revenue card',
    text: '$24k MRR',
    metadata: { metric: 'mrr', value: 24000 },
  },
  privacy: { consent: 'explicit', redacted: true },
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
