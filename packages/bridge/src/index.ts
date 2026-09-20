import type { WebContextPacket } from '@askable-ui/context';
import { isWebContextPacket } from '@askable-ui/context';

export const ASKABLE_BRIDGE_PROTOCOL = 'askable.bridge';
export const ASKABLE_BRIDGE_VERSION = '0.1';
export const ASKABLE_BRIDGE_CHANNEL = 'askable:bridge';

export type AskableBridgeConsent = WebContextPacket['privacy']['consent'];

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
  /** App-owned metadata. Mirrors `AskableAgentRequest.metadata` from `@askable-ui/core`. */
  metadata?: Record<string, unknown>;
}

export interface AskableBridgeEnvelope {
  protocol: typeof ASKABLE_BRIDGE_PROTOCOL;
  /**
   * Producer version. Always `ASKABLE_BRIDGE_VERSION` when this package builds
   * the envelope, but typed as `string` because receivers accept any envelope
   * from the same major version. Check `isAskableBridgeVersionSupported()` or
   * compare against `ASKABLE_BRIDGE_VERSION` directly when you need to pin.
   */
  version: string;
  channel: typeof ASKABLE_BRIDGE_CHANNEL;
  requestId: string;
  timestamp: string;
  source?: AskableBridgeSource;
  destination?: AskableBridgeDestination;
  consent: AskableBridgeConsent;
  payload: AskableBridgePayload;
}

export interface AskableBridgeAck {
  /**
   * The transport dispatched the envelope without throwing. This is **not**
   * proof that a receiver consumed it — `postMessage`, function, and extension
   * transports all resolve `ok: true` even when nothing is listening. Only the
   * HTTP transport observes a real response from the other side.
   */
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
  metadata?: Record<string, unknown>;
  /**
   * Aborts the send. Honored by every built-in transport before dispatch, and
   * passed through to `fetch()` by the HTTP transport for in-flight requests.
   */
  signal?: AbortSignal;
}

export interface AskableBridgeTransport {
  id: string;
  /**
   * Dispatches one envelope. Resolve with `ok: false` for a receiver-reported
   * failure; throw for a transport-level failure. `createAskableBridge()`
   * converts thrown errors into `ok: false` acks so one broken transport never
   * hides the others.
   */
  send(envelope: AskableBridgeEnvelope, options?: AskableBridgeSendOptions): Promise<AskableBridgeAck>;
}

export interface AskableBridgeContextProvider {
  /**
   * Returns the packet to send. Prefer `ctx.toContextPacketAsync()` over the
   * synchronous `ctx.toContextPacket()` — only the async form resolves app
   * registered context sources into `surrounding.sources`.
   */
  getPacket(): WebContextPacket | Promise<WebContextPacket>;
  formatPrompt?(packet: WebContextPacket, options?: AskableBridgeSendOptions): string | Promise<string>;
}

/**
 * Structural shape of `AskableAgentRequest` from `@askable-ui/core`, accepted
 * by `bridge.sendAgentRequest()`. Duck-typed so this package keeps zero
 * dependencies on core.
 */
export interface AskableBridgeAgentRequestLike {
  requestId?: string;
  question: string;
  /** Prompt-ready context string. Maps to `payload.prompt` on the envelope. */
  context?: string;
  packet?: WebContextPacket;
  metadata?: Record<string, unknown>;
}

export interface AskableBridgeOptions {
  provider?: AskableBridgeContextProvider;
  transports?: AskableBridgeTransport[];
  source?: AskableBridgeSource;
  destination?: AskableBridgeDestination;
  /**
   * Refuse to send packets with `privacy.redacted === false`. Defaults to
   * `false` to match `@askable-ui/mcp`. Turn it on whenever packets can carry
   * user-entered or otherwise sensitive content — note that
   * `ctx.toContextPacket()` only reports `redacted: true` when a `sanitizeMeta`
   * or `sanitizeText` function is registered on the context.
   */
  requireRedacted?: boolean;
  /**
   * Only send packets whose `privacy.consent` is in this list. Defaults to
   * allowing every consent value. `ctx.toContextPacket()` stamps `'implicit'`
   * unless the caller overrides it, so pass `['explicit']` only when the app
   * actually sets explicit consent on capture.
   */
  allowedConsent?: ReadonlyArray<AskableBridgeConsent>;
  /**
   * Reject envelopes whose serialized size exceeds this many bytes. Off by
   * default. Context packets carrying `target.screenshot.data` are base64 and
   * can reach multiple megabytes.
   */
  maxEnvelopeBytes?: number;
}

export interface AskableBridge {
  send(packet: WebContextPacket, options?: AskableBridgeSendOptions): Promise<AskableBridgeAck[]>;
  sendCurrent(options?: AskableBridgeSendOptions): Promise<AskableBridgeAck[]>;
  sendPrompt(question: string, options?: AskableBridgeSendOptions): Promise<AskableBridgeAck[]>;
  /** Sends an existing `ctx.toAgentRequest()` payload without re-resolving context. */
  sendAgentRequest(
    request: AskableBridgeAgentRequestLike,
    options?: AskableBridgeSendOptions,
  ): Promise<AskableBridgeAck[]>;
  registerTransport(transport: AskableBridgeTransport): () => void;
  /** Removes every transport and aborts sends that are still in flight. */
  dispose(): void;
}

export interface AskableFunctionTransportOptions {
  id?: string;
}

export interface AskablePostMessageTransportOptions {
  id?: string;
  targetWindow?: Window;
  /**
   * Target origin for `postMessage`. Required for cross-origin targets. When
   * omitted, the transport falls back to the sending page's own origin — it
   * never broadcasts to `'*'` unless `allowAnyOrigin` is set.
   */
  targetOrigin?: string;
  /**
   * Opt in to `targetOrigin: '*'`. Broadcasts the full context packet to any
   * listener on any origin — only safe when the packet carries nothing private.
   */
  allowAnyOrigin?: boolean;
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
  /** Max characters of a failed response body to include on the ack. Defaults to 512. */
  maxErrorBodyChars?: number;
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
      ...(options.prompt !== undefined ? { prompt: options.prompt } : {}),
      ...(options.question !== undefined ? { question: options.question } : {}),
      ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
    },
  };
}

/**
 * True when an envelope version is compatible with this package. Receivers
 * accept any envelope sharing the current major version so a minor protocol
 * bump does not break every deployed extension and webhook at once.
 */
export function isAskableBridgeVersionSupported(version: unknown): boolean {
  if (typeof version !== 'string' || version.length === 0) return false;
  return version.split('.')[0] === ASKABLE_BRIDGE_VERSION.split('.')[0];
}

export function isAskableBridgeEnvelope(value: unknown): value is AskableBridgeEnvelope {
  if (!isRecord(value)) return false;
  if (value.protocol !== ASKABLE_BRIDGE_PROTOCOL) return false;
  if (!isAskableBridgeVersionSupported(value.version)) return false;
  if (value.channel !== ASKABLE_BRIDGE_CHANNEL) return false;
  if (typeof value.requestId !== 'string' || value.requestId.length === 0) return false;
  if (typeof value.timestamp !== 'string') return false;
  if (!isConsentValue(value.consent)) return false;
  if (!isRecord(value.payload)) return false;
  return isWebContextPacket(value.payload.packet);
}

export function createAskableBridge(options: AskableBridgeOptions = {}): AskableBridge {
  const transports = new Map<string, AskableBridgeTransport>();
  const lifecycle = createAbortController();

  for (const transport of options.transports ?? []) {
    addTransport(transports, transport);
  }

  const send = async (packet: WebContextPacket, sendOptions: AskableBridgeSendOptions = {}) => {
    assertWebContextPacket(packet);
    assertPacketPolicy(packet, options);
    throwIfAborted(sendOptions.signal);

    if (transports.size === 0) {
      throw new Error('Askable bridge has no transports. Register a transport before sending context.');
    }

    const envelope = createAskableBridgeEnvelope(packet, {
      ...sendOptions,
      source: sendOptions.source ?? options.source,
      destination: sendOptions.destination ?? options.destination,
    });

    assertEnvelopeSize(envelope, options.maxEnvelopeBytes);

    const signal = mergeSignals(sendOptions.signal, lifecycle?.signal);
    const transportOptions = signal ? { ...sendOptions, signal } : sendOptions;
    const entries = [...transports.values()];

    // allSettled, not all: a transport that throws must not discard the acks of
    // the transports that succeeded.
    const results = await Promise.allSettled(
      entries.map((transport) => transport.send(envelope, transportOptions)),
    );

    return results.map((result, index): AskableBridgeAck => {
      if (result.status === 'fulfilled') return result.value;
      return {
        ok: false,
        requestId: envelope.requestId,
        transportId: entries[index].id,
        message: describeError(result.reason),
      };
    });
  };

  const sendCurrent = async (sendOptions: AskableBridgeSendOptions = {}) => {
    if (!options.provider) {
      throw new Error('Askable bridge sendCurrent() requires a context provider.');
    }

    throwIfAborted(sendOptions.signal);
    const packet = await options.provider.getPacket();
    throwIfAborted(sendOptions.signal);

    const prompt =
      sendOptions.prompt ??
      (options.provider.formatPrompt ? await options.provider.formatPrompt(packet, sendOptions) : undefined);

    return send(packet, { ...sendOptions, prompt });
  };

  const sendPrompt = async (question: string, sendOptions: AskableBridgeSendOptions = {}) => {
    return sendCurrent({ ...sendOptions, question });
  };

  const sendAgentRequest = async (
    request: AskableBridgeAgentRequestLike,
    sendOptions: AskableBridgeSendOptions = {},
  ) => {
    if (!isRecord(request) || typeof request.question !== 'string') {
      throw new TypeError('Askable bridge sendAgentRequest() expects an agent request with a question.');
    }

    const merged: AskableBridgeSendOptions = {
      ...sendOptions,
      requestId: sendOptions.requestId ?? request.requestId,
      question: sendOptions.question ?? request.question,
      prompt: sendOptions.prompt ?? request.context,
      metadata: sendOptions.metadata ?? request.metadata,
    };

    if (request.packet) return send(request.packet, merged);
    if (!options.provider) {
      throw new Error(
        'Askable bridge sendAgentRequest() needs a request built with packet: true, or a context provider.',
      );
    }

    return sendCurrent(merged);
  };

  return {
    send,
    sendCurrent,
    sendPrompt,
    sendAgentRequest,
    registerTransport(transport) {
      addTransport(transports, transport);
      return () => {
        // Delete by identity: a later transport may have claimed this id.
        if (transports.get(transport.id) === transport) transports.delete(transport.id);
      };
    },
    dispose() {
      transports.clear();
      lifecycle?.abort(new Error('Askable bridge disposed.'));
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
      throwIfAborted(sendOptions?.signal);
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
    async send(envelope, sendOptions) {
      throwIfAborted(sendOptions?.signal);

      const targetWindow = options.targetWindow ?? getWindow();
      if (!targetWindow) {
        throw new Error('PostMessage transport requires a browser window or explicit targetWindow.');
      }

      targetWindow.postMessage({ type: messageType, envelope }, resolveTargetOrigin(options));
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
    async send(envelope, sendOptions) {
      throwIfAborted(sendOptions?.signal);

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
  const maxErrorBodyChars = options.maxErrorBodyChars ?? 512;

  return {
    id,
    async send(envelope, sendOptions) {
      throwIfAborted(sendOptions?.signal);

      const fetchImpl = options.fetch ?? getFetch();
      if (!fetchImpl) {
        throw new Error('HTTP transport requires fetch or an explicit fetch implementation.');
      }

      const headers = normalizeHeaders(await resolveHeaders(options.headers));
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
        const detail = await readErrorBody(response, maxErrorBodyChars);
        const status = `HTTP ${response.status} ${response.statusText}`.trim();

        return {
          ok: false,
          requestId: envelope.requestId,
          transportId: id,
          message: detail ? `${status}: ${detail}` : status,
          ...(detail !== undefined ? { response: detail } : {}),
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

function addTransport(transports: Map<string, AskableBridgeTransport>, transport: AskableBridgeTransport): void {
  if (transports.has(transport.id)) {
    throw new Error(
      `Askable bridge already has a transport with id "${transport.id}". `
      + 'Pass a unique id when registering more than one transport of the same kind.',
    );
  }

  transports.set(transport.id, transport);
}

function assertWebContextPacket(packet: unknown): asserts packet is WebContextPacket {
  if (!isWebContextPacket(packet)) {
    throw new TypeError('Expected a valid Askable WebContextPacket.');
  }
}

function assertPacketPolicy(packet: WebContextPacket, options: AskableBridgeOptions): void {
  if (options.requireRedacted && packet.privacy.redacted === false) {
    throw new Error(
      'Askable bridge refused an unredacted context packet. Register sanitizeMeta/sanitizeText on the '
      + 'context, set privacy.redacted explicitly, or drop requireRedacted.',
    );
  }

  if (options.allowedConsent && !options.allowedConsent.includes(packet.privacy.consent)) {
    throw new Error(
      `Askable bridge refused a context packet with consent "${packet.privacy.consent}". `
      + `Allowed: ${options.allowedConsent.join(', ')}.`,
    );
  }
}

function assertEnvelopeSize(envelope: AskableBridgeEnvelope, maxEnvelopeBytes: number | undefined): void {
  if (maxEnvelopeBytes === undefined) return;

  const size = byteLength(JSON.stringify(envelope));
  if (size > maxEnvelopeBytes) {
    throw new Error(
      `Askable bridge envelope is ${size} bytes, over the ${maxEnvelopeBytes} byte limit. `
      + 'Drop screenshots, trim surrounding context, or raise maxEnvelopeBytes.',
    );
  }
}

function byteLength(value: string): number {
  if (typeof TextEncoder === 'undefined') return value.length;
  return new TextEncoder().encode(value).length;
}

function resolveTargetOrigin(options: AskablePostMessageTransportOptions): string {
  if (options.targetOrigin) return options.targetOrigin;
  if (options.allowAnyOrigin) return '*';

  // Never fall back to '*': context packets must not be broadcast to arbitrary
  // origins. Mirrors the invariant in @askable-ui/mcp's page bridge.
  const origin = getWindow()?.location?.origin;
  if (origin) return origin;

  throw new Error(
    'PostMessage transport could not determine a target origin. Pass targetOrigin for cross-origin '
    + 'targets, or set allowAnyOrigin: true to broadcast to every origin.',
  );
}

function createRequestId() {
  const cryptoImpl = getCrypto();
  if (cryptoImpl?.randomUUID) return cryptoImpl.randomUUID();
  return `askable_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function createAbortController(): AbortController | undefined {
  return typeof AbortController === 'undefined' ? undefined : new AbortController();
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new Error('Askable bridge send aborted.');
}

function mergeSignals(a: AbortSignal | undefined, b: AbortSignal | undefined): AbortSignal | undefined {
  if (!a) return b;
  if (!b) return a;

  const anySignal = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  if (typeof anySignal === 'function') return anySignal.call(AbortSignal, [a, b]);

  const controller = createAbortController();
  if (!controller) return a;

  for (const signal of [a, b]) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }

  return controller.signal;
}

function describeError(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return typeof reason === 'string' ? reason : 'Transport failed.';
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

async function resolveHeaders(headers: AskableHttpTransportOptions['headers']): Promise<HeadersInit | undefined> {
  if (!headers) return undefined;
  return typeof headers === 'function' ? headers() : headers;
}

/**
 * `HeadersInit` covers `Headers` instances and `[key, value][]` arrays, neither
 * of which survives object spread — spreading a `Headers` yields `{}`, silently
 * dropping Authorization. Normalize to a plain record first.
 */
function normalizeHeaders(init: HeadersInit | undefined): Record<string, string> {
  if (!init) return {};

  if (typeof Headers === 'undefined') {
    return Array.isArray(init) ? Object.fromEntries(init) : { ...(init as Record<string, string>) };
  }

  const normalized: Record<string, string> = {};
  new Headers(init).forEach((value, key) => {
    normalized[key] = value;
  });

  return normalized;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

async function readErrorBody(response: Response, maxChars: number): Promise<string | undefined> {
  if (maxChars <= 0) return undefined;

  try {
    const text = (await response.text()).trim();
    if (!text) return undefined;
    return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
  } catch {
    return undefined;
  }
}

function isConsentValue(value: unknown): value is AskableBridgeConsent {
  return value === 'explicit' || value === 'implicit' || value === 'none';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
