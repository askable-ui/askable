import type { WebContextPacket } from '@askable-ui/context';
import { isWebContextPacket } from '@askable-ui/context';

export const ASKABLE_BRIDGE_PROTOCOL = 'askable.bridge';
export const ASKABLE_BRIDGE_VERSION = '0.1';
export const ASKABLE_BRIDGE_CHANNEL = 'askable:bridge';

export type AskableBridgeDestinationKind =
  | 'app-chat'
  | 'browser-extension'
  | 'local-mcp'
  | 'remote-mcp'
  | 'webhook'
  | 'clipboard'
  | 'custom';

export interface AskableBridgeDestination {
  id?: string;
  kind: AskableBridgeDestinationKind;
  label?: string;
  target?: string;
}

export interface AskableBridgeSource {
  id?: string;
  app?: string;
  route?: string;
  url?: string;
}

export interface AskableBridgePayload {
  packet: WebContextPacket;
  prompt?: string;
  question?: string;
}

export interface AskableBridgeEnvelope {
  protocol: typeof ASKABLE_BRIDGE_PROTOCOL;
  version: typeof ASKABLE_BRIDGE_VERSION;
  channel: typeof ASKABLE_BRIDGE_CHANNEL;
  requestId: string;
  timestamp: string;
  source?: AskableBridgeSource;
  destination?: AskableBridgeDestination;
  consent: WebContextPacket['privacy']['consent'];
  payload: AskableBridgePayload;
}

export interface AskableBridgeAck {
  ok: boolean;
  requestId: string;
  transportId: string;
  message?: string;
  response?: unknown;
}

export interface AskableBridgeSendOptions {
  requestId?: string;
  source?: AskableBridgeSource;
  destination?: AskableBridgeDestination;
  question?: string;
  prompt?: string;
  signal?: AbortSignal;
}

export interface AskableBridgeTransport {
  id: string;
  send(envelope: AskableBridgeEnvelope, options?: AskableBridgeSendOptions): Promise<AskableBridgeAck>;
}

export interface AskableBridgeContextProvider {
  getPacket(): WebContextPacket | Promise<WebContextPacket>;
  formatPrompt?(packet: WebContextPacket, options?: AskableBridgeSendOptions): string | Promise<string>;
}

export interface AskableBridgeOptions {
  provider?: AskableBridgeContextProvider;
  transports?: AskableBridgeTransport[];
  source?: AskableBridgeSource;
  destination?: AskableBridgeDestination;
}

export interface AskableBridge {
  send(packet: WebContextPacket, options?: AskableBridgeSendOptions): Promise<AskableBridgeAck[]>;
  sendCurrent(options?: AskableBridgeSendOptions): Promise<AskableBridgeAck[]>;
  sendPrompt(question: string, options?: AskableBridgeSendOptions): Promise<AskableBridgeAck[]>;
  registerTransport(transport: AskableBridgeTransport): () => void;
  dispose(): void;
}

export interface AskableFunctionTransportOptions {
  id?: string;
}

export interface AskablePostMessageTransportOptions {
  id?: string;
  targetWindow?: Window;
  targetOrigin?: string;
  messageType?: string;
}

export interface AskableBrowserRuntime {
  sendMessage(message: unknown): Promise<unknown> | void;
}

export interface AskableBrowserExtensionTransportOptions {
  id?: string;
  runtime?: AskableBrowserRuntime;
  messageType?: string;
}

export interface AskableHttpTransportOptions {
  id?: string;
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  fetch?: typeof fetch;
}

export type AskableFunctionTransportHandler = (
  envelope: AskableBridgeEnvelope,
  options?: AskableBridgeSendOptions,
) => unknown | Promise<unknown>;

export function createAskableBridgeEnvelope(
  packet: WebContextPacket,
  options: AskableBridgeSendOptions = {},
): AskableBridgeEnvelope {
  assertWebContextPacket(packet);

  return {
    protocol: ASKABLE_BRIDGE_PROTOCOL,
    version: ASKABLE_BRIDGE_VERSION,
    channel: ASKABLE_BRIDGE_CHANNEL,
    requestId: options.requestId ?? createRequestId(),
    timestamp: new Date().toISOString(),
    ...(options.source ? { source: options.source } : {}),
    ...(options.destination ? { destination: options.destination } : {}),
    consent: packet.privacy.consent,
    payload: {
      packet,
      ...(options.prompt ? { prompt: options.prompt } : {}),
      ...(options.question ? { question: options.question } : {}),
    },
  };
}

export function isAskableBridgeEnvelope(value: unknown): value is AskableBridgeEnvelope {
  if (!isRecord(value)) return false;
  if (value.protocol !== ASKABLE_BRIDGE_PROTOCOL) return false;
  if (value.version !== ASKABLE_BRIDGE_VERSION) return false;
  if (value.channel !== ASKABLE_BRIDGE_CHANNEL) return false;
  if (typeof value.requestId !== 'string') return false;
  if (typeof value.timestamp !== 'string') return false;
  if (!isRecord(value.payload)) return false;
  return isWebContextPacket(value.payload.packet);
}

export function createAskableBridge(options: AskableBridgeOptions = {}): AskableBridge {
  const transports = new Map<string, AskableBridgeTransport>();

  for (const transport of options.transports ?? []) {
    transports.set(transport.id, transport);
  }

  const send = async (packet: WebContextPacket, sendOptions: AskableBridgeSendOptions = {}) => {
    assertWebContextPacket(packet);

    if (transports.size === 0) {
      throw new Error('Askable bridge has no transports. Register a transport before sending context.');
    }

    const envelope = createAskableBridgeEnvelope(packet, {
      ...sendOptions,
      source: sendOptions.source ?? options.source,
      destination: sendOptions.destination ?? options.destination,
    });

    return Promise.all([...transports.values()].map((transport) => transport.send(envelope, sendOptions)));
  };

  const sendCurrent = async (sendOptions: AskableBridgeSendOptions = {}) => {
    if (!options.provider) {
      throw new Error('Askable bridge sendCurrent() requires a context provider.');
    }

    const packet = await options.provider.getPacket();
    const prompt =
      sendOptions.prompt ??
      (options.provider.formatPrompt ? await options.provider.formatPrompt(packet, sendOptions) : undefined);

    return send(packet, { ...sendOptions, prompt });
  };

  const sendPrompt = async (question: string, sendOptions: AskableBridgeSendOptions = {}) => {
    return sendCurrent({ ...sendOptions, question });
  };

  return {
    send,
    sendCurrent,
    sendPrompt,
    registerTransport(transport) {
      transports.set(transport.id, transport);
      return () => {
        transports.delete(transport.id);
      };
    },
    dispose() {
      transports.clear();
    },
  };
}

export function createFunctionTransport(
  handler: AskableFunctionTransportHandler,
  options: AskableFunctionTransportOptions = {},
): AskableBridgeTransport {
  const id = options.id ?? 'function';

  return {
    id,
    async send(envelope, sendOptions) {
      const response = await handler(envelope, sendOptions);
      return { ok: true, requestId: envelope.requestId, transportId: id, response };
    },
  };
}

export function createPostMessageTransport(options: AskablePostMessageTransportOptions = {}): AskableBridgeTransport {
  const id = options.id ?? 'postmessage';
  const messageType = options.messageType ?? 'askable:bridge:context';

  return {
    id,
    async send(envelope) {
      const targetWindow = options.targetWindow ?? getWindow();
      if (!targetWindow) {
        throw new Error('PostMessage transport requires a browser window or explicit targetWindow.');
      }

      targetWindow.postMessage({ type: messageType, envelope }, options.targetOrigin ?? '*');
      return { ok: true, requestId: envelope.requestId, transportId: id };
    },
  };
}

export function createBrowserExtensionTransport(
  options: AskableBrowserExtensionTransportOptions = {},
): AskableBridgeTransport {
  const id = options.id ?? 'browser-extension';
  const messageType = options.messageType ?? 'askable:bridge:context';

  return {
    id,
    async send(envelope) {
      const runtime = options.runtime ?? getBrowserRuntime();
      if (!runtime) {
        throw new Error('Browser extension transport requires chrome.runtime, browser.runtime, or explicit runtime.');
      }

      const response = await runtime.sendMessage({ type: messageType, envelope });
      return { ok: true, requestId: envelope.requestId, transportId: id, response };
    },
  };
}

export function createHttpTransport(options: AskableHttpTransportOptions): AskableBridgeTransport {
  const id = options.id ?? 'http';
  const method = options.method ?? 'POST';

  return {
    id,
    async send(envelope, sendOptions) {
      const fetchImpl = options.fetch ?? getFetch();
      if (!fetchImpl) {
        throw new Error('HTTP transport requires fetch or an explicit fetch implementation.');
      }

      const headers = await resolveHeaders(options.headers);
      const response = await fetchImpl(options.url, {
        method,
        headers: {
          'content-type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(envelope),
        signal: sendOptions?.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          requestId: envelope.requestId,
          transportId: id,
          message: `HTTP ${response.status} ${response.statusText}`.trim(),
        };
      }

      return {
        ok: true,
        requestId: envelope.requestId,
        transportId: id,
        response: await readResponseBody(response),
      };
    },
  };
}

function assertWebContextPacket(packet: unknown): asserts packet is WebContextPacket {
  if (!isWebContextPacket(packet)) {
    throw new TypeError('Expected a valid Askable WebContextPacket.');
  }
}

function createRequestId() {
  const cryptoImpl = getCrypto();
  if (cryptoImpl?.randomUUID) return cryptoImpl.randomUUID();
  return `askable_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function getWindow(): Window | undefined {
  return typeof window === 'undefined' ? undefined : window;
}

function getFetch(): typeof fetch | undefined {
  return typeof fetch === 'undefined' ? undefined : fetch;
}

function getCrypto(): Crypto | undefined {
  return typeof crypto === 'undefined' ? undefined : crypto;
}

function getBrowserRuntime(): AskableBrowserRuntime | undefined {
  const globalValue = globalThis as typeof globalThis & {
    browser?: { runtime?: AskableBrowserRuntime };
    chrome?: { runtime?: AskableBrowserRuntime };
  };

  return globalValue.browser?.runtime ?? globalValue.chrome?.runtime;
}

async function resolveHeaders(headers: AskableHttpTransportOptions['headers']): Promise<HeadersInit> {
  if (!headers) return {};
  return typeof headers === 'function' ? headers() : headers;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
