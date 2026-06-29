import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { webContextPacketSchema } from '@askable-ui/context';
import type { WebContextPacket } from '@askable-ui/context';
import type {
  HandleRequestOptions,
  WebStandardStreamableHTTPServerTransportOptions,
} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type {
  AskableAsyncContextOutputOptions,
  AskableAsyncContextPacketOptions,
  AskableContext,
  AskableContextOutputOptions,
  AskableContextSourceErrorMode,
  AskableContextSourceInclude,
  AskableContextSourceMode,
  AskablePromptFormat,
  AskablePromptPreset,
} from '@askable-ui/core';

export interface AskableMcpContextOptions extends AskableAsyncContextPacketOptions {
  currentLabel?: string;
  historyLabel?: string;
  sourceLabel?: string;
}

export interface AskableMcpContextProvider {
  getContext(options?: AskableMcpContextOptions): WebContextPacket | Promise<WebContextPacket>;
  formatContextForPrompt?(
    packet: WebContextPacket,
    options?: AskableMcpContextOptions,
  ): string | Promise<string>;
}

export interface AskableMcpServerOptions {
  name?: string;
  version?: string;
  provider: AskableMcpContextProvider;
  /**
   * When `true`, tool calls that return a packet with `privacy.redacted === false`
   * will fail with an error instead of forwarding potentially-unredacted data to
   * the MCP client. Defaults to `false` for backwards compatibility — set to `true`
   * when your app captures user-entered or sensitive content in `data-askable` attributes.
   */
  requireRedacted?: boolean;
}

export type AskableMcpStatelessTransportOptions = Omit<
  WebStandardStreamableHTTPServerTransportOptions,
  'sessionIdGenerator' | 'onsessioninitialized' | 'onsessionclosed'
>;

export type AskableMcpAuthorizeResult =
  | boolean
  | Response
  | HandleRequestOptions
  | void;

export type AskableMcpCorsOriginResult = boolean | string | null | undefined;

export type AskableMcpCorsOrigin =
  | boolean
  | string
  | string[]
  | ((origin: string | null, request: Request) => AskableMcpCorsOriginResult | Promise<AskableMcpCorsOriginResult>);

export interface AskableMcpCorsOptions {
  origin?: AskableMcpCorsOrigin;
  methods?: string[];
  headers?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export type AskableMcpWebResponseHeaders =
  | HeadersInit
  | ((request: Request, response: Response) => HeadersInit | void | Promise<HeadersInit | void>);

export type AskableMcpWebOutcome =
  | 'success'
  | 'preflight'
  | 'cors_rejected'
  | 'unauthorized'
  | 'payload_too_large'
  | 'error';

export interface AskableMcpWebTelemetryEvent {
  method: string;
  url: string;
  path: string;
  status: number;
  outcome: AskableMcpWebOutcome;
  durationMs: number;
  origin?: string;
  userAgent?: string;
  requestId?: string;
}

export type AskableMcpWebTelemetry =
  (event: AskableMcpWebTelemetryEvent) => void | Promise<void>;

export interface AskableMcpWebHandlerOptions extends AskableMcpServerOptions {
  transport?: AskableMcpStatelessTransportOptions;
  authorize?: (request: Request) => AskableMcpAuthorizeResult | Promise<AskableMcpAuthorizeResult>;
  cors?: boolean | AskableMcpCorsOptions;
  maxRequestBodyBytes?: number | false;
  responseHeaders?: AskableMcpWebResponseHeaders;
  telemetry?: AskableMcpWebTelemetry;
  requestOptions?:
    | HandleRequestOptions
    | ((request: Request) => HandleRequestOptions | Promise<HandleRequestOptions>);
  onError?: (error: unknown, request: Request) => void;
}

export type AskableMcpWebHandler = (request: Request) => Promise<Response>;

export const ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL = 'askable.mcp.page_bridge';
export const ASKABLE_MCP_PAGE_BRIDGE_VERSION = '0.1';
export const ASKABLE_MCP_PAGE_BRIDGE_CHANNEL = 'askable:mcp';
export const ASKABLE_MCP_CURRENT_CONTEXT_RESOURCE_URI = 'askable://current';

export type AskableMcpPageBridgeRequestType =
  | 'get_current_context'
  | 'format_context_for_prompt'
  | 'read_current_resource';

export type AskableMcpPageResourceFormat = 'packet' | 'prompt';

export interface AskableMcpPageResourceOptions {
  uri?: string;
  name?: string;
  title?: string;
  description?: string;
  mimeType?: string;
  format?: AskableMcpPageResourceFormat;
  includePacket?: boolean;
}

export interface AskableMcpPageBridgeRequestOptions extends AskableMcpContextOptions {
  resource?: AskableMcpPageResourceOptions;
}

export interface AskableMcpPageBridgeRequest {
  protocol: typeof ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL;
  version: typeof ASKABLE_MCP_PAGE_BRIDGE_VERSION;
  channel?: string;
  type: AskableMcpPageBridgeRequestType;
  requestId: string;
  options?: AskableMcpPageBridgeRequestOptions;
}

export interface AskableMcpPageResource {
  uri: string;
  name: string;
  title: string;
  description?: string;
  mimeType: string;
  text: string;
  packet?: WebContextPacket;
}

export interface AskableMcpPageBridgeSuccessResponse {
  protocol: typeof ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL;
  version: typeof ASKABLE_MCP_PAGE_BRIDGE_VERSION;
  channel?: string;
  type: `${AskableMcpPageBridgeRequestType}:result`;
  requestId: string;
  packet?: WebContextPacket;
  text?: string;
  resource?: AskableMcpPageResource;
}

export interface AskableMcpPageBridgeErrorResponse {
  protocol: typeof ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL;
  version: typeof ASKABLE_MCP_PAGE_BRIDGE_VERSION;
  channel?: string;
  type: `${AskableMcpPageBridgeRequestType}:error`;
  requestId: string;
  error: {
    message: string;
  };
}

export type AskableMcpPageBridgeResponse =
  | AskableMcpPageBridgeSuccessResponse
  | AskableMcpPageBridgeErrorResponse;

export type AskableMcpPageBridgeAllowedOrigins =
  | string[]
  | ((origin: string, event: MessageEvent) => boolean | Promise<boolean>);

export interface AskableMcpPageBridgeWindow {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  postMessage(message: AskableMcpPageBridgeResponse, targetOrigin: string): void;
  location?: {
    origin?: string;
  };
}

export interface AskableMcpPageBridgeOptions {
  provider: AskableMcpContextProvider;
  channel?: string;
  targetOrigin?: string;
  allowedOrigins?: AskableMcpPageBridgeAllowedOrigins;
  window?: AskableMcpPageBridgeWindow;
  onError?: (error: unknown, event: MessageEvent) => void;
  /**
   * When `true`, page-bridge requests that resolve to a packet with
   * `privacy.redacted === false` respond with an error instead of forwarding
   * potentially-unredacted data — matching {@link AskableMcpServerOptions.requireRedacted}.
   * Defaults to `false` for backwards compatibility. Set to `true` when the page
   * captures user-entered or sensitive content in `data-askable` attributes.
   */
  requireRedacted?: boolean;
}

export interface AskableMcpPageBridge {
  dispose(): void;
}

export type AskableMcpSourceContext = Pick<AskableContext, 'toContextPacket' | 'toContext'> &
  Partial<Pick<AskableContext, 'toContextPacketAsync' | 'toContextAsync'>>;

export interface CreateAskableMcpContextProviderOptions extends AskableMcpContextOptions {}

const defaultWebResponseHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const defaultMaxRequestBodyBytes = 1_048_576;

const contextOptionsShape = {
  scope: z.string().optional(),
  preset: z.enum(['compact', 'verbose', 'json']).optional(),
  format: z.enum(['natural', 'json']).optional(),
  includeText: z.boolean().optional(),
  maxTextLength: z.number().int().min(0).max(100_000).optional(),
  maxTokens: z.number().int().min(1).max(100_000).optional(),
  hierarchyDepth: z.number().int().min(0).max(50).optional(),
  history: z.number().int().min(0).max(50).optional(),
  includeViewport: z.boolean().optional(),
  intent: z.string().optional(),
  currentLabel: z.string().optional(),
  historyLabel: z.string().optional(),
  sourceMode: z.string().optional(),
  sourceErrorMode: z.enum(['include', 'omit', 'throw']).optional(),
  sourceLabel: z.string().optional(),
  sources: z.union([
    z.literal('all'),
    z.array(z.union([
      z.string(),
      z.object({
        id: z.string(),
        mode: z.string().optional(),
        maxItems: z.number().int().min(0).max(100_000).optional(),
        maxTokens: z.number().int().min(1).max(100_000).optional(),
        timeoutMs: z.number().int().min(0).max(60_000).optional(),
      }),
    ])),
  ]).optional(),
};

export function createAskableMcpContextProvider(
  ctx: AskableMcpSourceContext,
  defaults: CreateAskableMcpContextProviderOptions = {},
): AskableMcpContextProvider {
  return {
    getContext(options) {
      const merged = mergeContextOptions(defaults, options);
      return ctx.toContextPacketAsync
        ? ctx.toContextPacketAsync(merged)
        : ctx.toContextPacket(toPacketOptions(merged));
    },
    formatContextForPrompt(_packet, options) {
      const merged = mergeContextOptions(defaults, options);
      return ctx.toContextAsync
        ? ctx.toContextAsync(toAsyncPromptOptions(merged))
        : ctx.toContext(toPromptOptions(merged));
    },
  };
}

export interface AskableMcpRemoteProviderOptions {
  /** URL of an endpoint that returns the current Context packet as JSON on GET. */
  url: string;
  /** Extra request headers, e.g. an Authorization header. */
  headers?: Record<string, string>;
  /** Inject a custom fetch implementation (defaults to the global `fetch`). */
  fetch?: typeof fetch;
}

/**
 * Builds an {@link AskableMcpContextProvider} that fetches the current Context
 * packet from a remote HTTP endpoint. Useful for connecting a stdio MCP server
 * (e.g. the `askable-mcp` CLI) to a running app that exposes its packet at a URL.
 */
export function createAskableMcpRemoteProvider(
  options: AskableMcpRemoteProviderOptions,
): AskableMcpContextProvider {
  const doFetch = options.fetch ?? fetch;
  return {
    async getContext() {
      const response = await doFetch(options.url, { headers: options.headers });
      if (!response.ok) {
        throw new Error(`askable-mcp: context endpoint ${options.url} returned ${response.status}`);
      }
      return (await response.json()) as WebContextPacket;
    },
  };
}

export function createAskableMcpServer(options: AskableMcpServerOptions): McpServer {
  const server = new McpServer({
    name: options.name ?? 'askable-context',
    version: options.version ?? '0.1.0',
  });

  server.registerResource(
    'context-schema',
    'context://schema',
    {
      title: 'Context packet schema',
      description: 'JSON Schema for Context packets.',
      mimeType: 'application/schema+json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/schema+json',
          text: JSON.stringify(webContextPacketSchema, null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    'current_context',
    ASKABLE_MCP_CURRENT_CONTEXT_RESOURCE_URI,
    {
      title: 'Current Askable context',
      description: 'The current selected, focused, or visible Context packet from the active app.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const packet = await options.provider.getContext();
      if (options.requireRedacted && packet.privacy?.redacted === false) {
        throw new Error('Context packet has not been redacted. Set requireRedacted: false to allow, or redact the packet before serving.');
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(packet, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    'get_current_context',
    {
      title: 'Get current Context packet',
      description: 'Return the current selected, focused, or visible Context packet.',
      inputSchema: contextOptionsShape,
    },
    async (args) => {
      try {
        const packet = await options.provider.getContext(args);
        if (options.requireRedacted && packet.privacy?.redacted === false) {
          console.warn('[askable-mcp] get_current_context blocked: packet has privacy.redacted=false');
          return {
            isError: true,
            content: [{ type: 'text', text: 'Context packet has not been redacted. Configure a sanitizer or set requireRedacted: false.' }],
          };
        }
        return {
          content: [
            {
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify(packet, null, 2),
            },
          ],
        };
      } catch (err) {
        console.error('[askable-mcp] get_current_context failed:', err);
        return {
          isError: true,
          content: [{ type: 'text', text: 'Failed to get context. Check server logs for details.' }],
        };
      }
    },
  );

  server.registerTool(
    'list_context_sources',
    {
      title: 'List app context sources',
      description: 'List the app-owned context sources currently available (label, role, and metadata) so the agent can decide which to request.',
      inputSchema: contextOptionsShape,
    },
    async (args) => {
      try {
        const packet = await options.provider.getContext(args);
        if (options.requireRedacted && packet.privacy?.redacted === false) {
          console.warn('[askable-mcp] list_context_sources blocked: packet has privacy.redacted=false');
          return {
            isError: true,
            content: [{ type: 'text', text: 'Context packet has not been redacted. Configure a sanitizer or set requireRedacted: false.' }],
          };
        }
        const sources = packet.surrounding?.sources ?? [];
        return {
          content: [
            {
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify(sources, null, 2),
            },
          ],
        };
      } catch (err) {
        console.error('[askable-mcp] list_context_sources failed:', err);
        return {
          isError: true,
          content: [{ type: 'text', text: 'Failed to list context sources. Check server logs for details.' }],
        };
      }
    },
  );

  server.registerTool(
    'get_context_schema',
    {
      title: 'Get Context schema',
      description: 'Return the JSON Schema for packets emitted by Context runtimes.',
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: 'text',
          mimeType: 'application/schema+json',
          text: JSON.stringify(webContextPacketSchema, null, 2),
        },
      ],
    }),
  );

  server.registerTool(
    'format_context_for_prompt',
    {
      title: 'Format current context for a prompt',
      description: 'Return a prompt-ready text rendering of the current Context packet.',
      inputSchema: contextOptionsShape,
    },
    async (args) => {
      try {
        const packet = await options.provider.getContext(args);
        if (options.requireRedacted && packet.privacy?.redacted === false) {
          console.warn('[askable-mcp] format_context_for_prompt blocked: packet has privacy.redacted=false');
          return {
            isError: true,
            content: [{ type: 'text', text: 'Context packet has not been redacted. Configure a sanitizer or set requireRedacted: false.' }],
          };
        }
        const text = options.provider.formatContextForPrompt
          ? await options.provider.formatContextForPrompt(packet, args)
          : defaultPromptFormatter(packet);

        return {
          content: [
            {
              type: 'text',
              text,
            },
          ],
        };
      } catch (err) {
        console.error('[askable-mcp] format_context_for_prompt failed:', err);
        return {
          isError: true,
          content: [{ type: 'text', text: 'Failed to format context. Check server logs for details.' }],
        };
      }
    },
  );

  return server;
}

export function createAskableMcpWebHandler(options: AskableMcpWebHandlerOptions): AskableMcpWebHandler {
  return async (request) => {
    const startedAt = Date.now();
    let corsHeaders: Headers | undefined;
    const finalize = (
      response: Response,
      outcome: AskableMcpWebOutcome,
      nextCorsHeaders = corsHeaders,
    ) => finalizeAskableMcpWebResponse(request, response, options, {
      corsHeaders: nextCorsHeaders,
      outcome,
      startedAt,
    });

    try {
      const cors = await resolveCorsHeaders(options.cors, request);
      if (cors === false) {
        return finalize(
          request.method === 'OPTIONS'
            ? new Response(null, { status: 403 })
            : createAskableMcpErrorResponse(403, -32003, 'CORS origin not allowed.'),
          'cors_rejected',
        );
      }
      corsHeaders = cors;

      if (request.method === 'OPTIONS' && options.cors) {
        return finalize(
          new Response(null, { status: 204 }),
          'preflight',
        );
      }

      if (isRequestBodyTooLarge(request, resolveMaxRequestBodyBytes(options.maxRequestBodyBytes))) {
        return finalize(
          createAskableMcpErrorResponse(413, -32004, 'MCP request body is too large.'),
          'payload_too_large',
        );
      }

      const authorization = options.authorize ? await options.authorize(request) : undefined;
      if (authorization instanceof Response) {
        return finalize(authorization, authorization.status >= 400 ? 'unauthorized' : 'success');
      }
      if (authorization === false) {
        return finalize(
          createAskableMcpErrorResponse(401, -32001, 'Unauthorized MCP request.'),
          'unauthorized',
        );
      }

      const server = createAskableMcpServer(options);
      const transport = new WebStandardStreamableHTTPServerTransport({
        enableJsonResponse: true,
        ...options.transport,
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      const configuredRequestOptions = typeof options.requestOptions === 'function'
        ? await options.requestOptions(request)
        : options.requestOptions;
      const requestOptions = mergeHandleRequestOptions(
        authorization && typeof authorization === 'object' ? authorization : undefined,
        configuredRequestOptions,
      );

      return finalize(
        await transport.handleRequest(request, requestOptions),
        'success',
      );
    } catch (error) {
      options.onError?.(error, request);
      return finalize(
        createAskableMcpErrorResponse(500, -32000, 'Askable MCP handler failed.'),
        'error',
      );
    }
  };
}

export function createAskableMcpPageBridge(options: AskableMcpPageBridgeOptions): AskableMcpPageBridge {
  const bridgeWindow = options.window ?? getBrowserWindow();
  if (!bridgeWindow) {
    return { dispose() {} };
  }

  const channel = options.channel ?? ASKABLE_MCP_PAGE_BRIDGE_CHANNEL;
  const listener = (event: MessageEvent) => {
    void handleAskableMcpPageBridgeMessage(event, bridgeWindow, options, channel);
  };

  bridgeWindow.addEventListener('message', listener);

  return {
    dispose() {
      bridgeWindow.removeEventListener('message', listener);
    },
  };
}

export function defaultPromptFormatter(packet: WebContextPacket): string {
  const parts = [
    `Context mode: ${packet.capture.mode}`,
    packet.capture.intent ? `User intent: ${packet.capture.intent}` : undefined,
    packet.source.url ? `URL: ${packet.source.url}` : undefined,
    packet.source.title ? `Title: ${packet.source.title}` : undefined,
    packet.target?.text ? `Target text: ${packet.target.text}` : undefined,
    packet.target?.metadata ? `Target metadata: ${JSON.stringify(packet.target.metadata)}` : undefined,
    packet.surrounding?.visible?.length ? `Visible context: ${JSON.stringify(packet.surrounding.visible)}` : undefined,
    packet.surrounding?.history?.length ? `Recent context: ${JSON.stringify(packet.surrounding.history)}` : undefined,
    packet.surrounding?.sources?.length ? `Source context: ${JSON.stringify(packet.surrounding.sources)}` : undefined,
  ];

  return parts.filter((part): part is string => Boolean(part)).join('\n');
}

function getBrowserWindow(): AskableMcpPageBridgeWindow | undefined {
  return typeof window === 'undefined'
    ? undefined
    : window;
}

async function handleAskableMcpPageBridgeMessage(
  event: MessageEvent,
  bridgeWindow: AskableMcpPageBridgeWindow,
  options: AskableMcpPageBridgeOptions,
  channel: string,
): Promise<void> {
  const request = parseAskableMcpPageBridgeRequest(event.data, channel);
  if (!request) return;

  if (!await isAskableMcpPageBridgeOriginAllowed(event, bridgeWindow, options.allowedOrigins)) {
    return;
  }

  try {
    const contextOptions = getAskableMcpPageBridgeContextOptions(request.options);
    const packet = await options.provider.getContext(contextOptions);

    if (options.requireRedacted && packet.privacy?.redacted === false) {
      bridgeWindow.postMessage({
        ...createAskableMcpPageBridgeResponseBase(request),
        type: `${request.type}:error`,
        error: { message: 'Context packet has not been redacted. Set requireRedacted: false to allow, or redact the packet before sending.' },
      }, resolveAskableMcpPageBridgeTargetOrigin(event, options));
      return;
    }

    const responseBase = createAskableMcpPageBridgeResponseBase(request);
    let response: AskableMcpPageBridgeSuccessResponse;

    if (request.type === 'format_context_for_prompt') {
      response = {
        ...responseBase,
        type: 'format_context_for_prompt:result',
        text: await formatAskableMcpContextForPrompt(options.provider, packet, contextOptions),
      };
    } else if (request.type === 'read_current_resource') {
      response = {
        ...responseBase,
        type: 'read_current_resource:result',
        resource: await createAskableMcpCurrentContextPageResource(
          options.provider,
          packet,
          contextOptions,
          request.options?.resource,
        ),
      };
    } else {
      response = {
        ...responseBase,
        type: 'get_current_context:result',
        packet,
      };
    }

    bridgeWindow.postMessage(response, resolveAskableMcpPageBridgeTargetOrigin(event, options));
  } catch (error) {
    options.onError?.(error, event);
    bridgeWindow.postMessage({
      ...createAskableMcpPageBridgeResponseBase(request),
      type: `${request.type}:error`,
      error: { message: 'Askable MCP page bridge failed.' },
    }, resolveAskableMcpPageBridgeTargetOrigin(event, options));
  }
}

function parseAskableMcpPageBridgeRequest(
  data: unknown,
  channel: string,
): AskableMcpPageBridgeRequest | undefined {
  if (!isRecord(data)) return undefined;
  if (data.protocol !== ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL) return undefined;
  if (data.version !== ASKABLE_MCP_PAGE_BRIDGE_VERSION) return undefined;
  if ((data.channel ?? ASKABLE_MCP_PAGE_BRIDGE_CHANNEL) !== channel) return undefined;
  if (
    data.type !== 'get_current_context'
    && data.type !== 'format_context_for_prompt'
    && data.type !== 'read_current_resource'
  ) return undefined;
  if (typeof data.requestId !== 'string' || !data.requestId) return undefined;
  if (data.options !== undefined && !isRecord(data.options)) return undefined;
  if (!isValidAskableMcpPageBridgeResourceOptions(data.options)) return undefined;

  return {
    ...data,
    channel: data.channel ?? ASKABLE_MCP_PAGE_BRIDGE_CHANNEL,
  } as unknown as AskableMcpPageBridgeRequest;
}

function getAskableMcpPageBridgeContextOptions(
  options: AskableMcpPageBridgeRequestOptions | undefined,
): AskableMcpContextOptions | undefined {
  if (!options) return undefined;
  const { resource: _resource, ...contextOptions } = options;
  return contextOptions;
}

async function formatAskableMcpContextForPrompt(
  provider: AskableMcpContextProvider,
  packet: WebContextPacket,
  options: AskableMcpContextOptions | undefined,
): Promise<string> {
  return provider.formatContextForPrompt
    ? provider.formatContextForPrompt(packet, options)
    : defaultPromptFormatter(packet);
}

async function createAskableMcpCurrentContextPageResource(
  provider: AskableMcpContextProvider,
  packet: WebContextPacket,
  contextOptions: AskableMcpContextOptions | undefined,
  resourceOptions: AskableMcpPageResourceOptions | undefined,
): Promise<AskableMcpPageResource> {
  const format = resourceOptions?.format ?? 'packet';
  const text = format === 'prompt'
    ? await formatAskableMcpContextForPrompt(provider, packet, contextOptions)
    : JSON.stringify(packet, null, 2);
  const mimeType = resourceOptions?.mimeType
    ?? (format === 'prompt' ? 'text/plain' : 'application/json');
  const resource: AskableMcpPageResource = {
    uri: resourceOptions?.uri ?? ASKABLE_MCP_CURRENT_CONTEXT_RESOURCE_URI,
    name: resourceOptions?.name ?? 'current_context',
    title: resourceOptions?.title ?? 'Current Askable context',
    description: resourceOptions?.description ?? 'Approved context from the active page.',
    mimeType,
    text,
  };

  return resourceOptions?.includePacket ? { ...resource, packet } : resource;
}

function isValidAskableMcpPageBridgeResourceOptions(options: unknown): boolean {
  if (options === undefined) return true;
  if (!isRecord(options)) return false;
  if (options.resource === undefined) return true;
  if (!isRecord(options.resource)) return false;

  const resource = options.resource;
  if (resource.uri !== undefined && typeof resource.uri !== 'string') return false;
  if (resource.name !== undefined && typeof resource.name !== 'string') return false;
  if (resource.title !== undefined && typeof resource.title !== 'string') return false;
  if (resource.description !== undefined && typeof resource.description !== 'string') return false;
  if (resource.mimeType !== undefined && typeof resource.mimeType !== 'string') return false;
  if (
    resource.format !== undefined
    && resource.format !== 'packet'
    && resource.format !== 'prompt'
  ) return false;
  if (resource.includePacket !== undefined && typeof resource.includePacket !== 'boolean') return false;

  return true;
}

async function isAskableMcpPageBridgeOriginAllowed(
  event: MessageEvent,
  bridgeWindow: AskableMcpPageBridgeWindow,
  allowedOrigins: AskableMcpPageBridgeAllowedOrigins | undefined,
): Promise<boolean> {
  const origin = event.origin || bridgeWindow.location?.origin || '';
  if (!allowedOrigins) {
    return !bridgeWindow.location?.origin || origin === bridgeWindow.location.origin;
  }

  if (Array.isArray(allowedOrigins)) {
    return allowedOrigins.includes(origin);
  }

  return allowedOrigins(origin, event);
}

function createAskableMcpPageBridgeResponseBase(
  request: AskableMcpPageBridgeRequest,
): Omit<AskableMcpPageBridgeSuccessResponse, 'type'> {
  return {
    protocol: ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL,
    version: ASKABLE_MCP_PAGE_BRIDGE_VERSION,
    ...(request.channel ? { channel: request.channel } : {}),
    requestId: request.requestId,
  };
}

function resolveAskableMcpPageBridgeTargetOrigin(
  event: MessageEvent,
  options: AskableMcpPageBridgeOptions,
): string {
  return options.targetOrigin ?? (event.origin || '*');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeContextOptions(
  defaults: AskableMcpContextOptions,
  options?: AskableMcpContextOptions,
): AskableMcpContextOptions {
  return {
    ...defaults,
    ...options,
    ...(defaults.source || options?.source
      ? { source: { ...defaults.source, ...options?.source } }
      : {}),
    ...(defaults.privacy || options?.privacy
      ? { privacy: { ...defaults.privacy, ...options?.privacy } }
      : {}),
    ...(defaults.provenance || options?.provenance
      ? { provenance: { ...defaults.provenance, ...options?.provenance } }
      : {}),
  };
}

function toPromptOptions(options: AskableMcpContextOptions): AskableContextOutputOptions {
  const {
    includeViewport: _includeViewport,
    intent: _intent,
    mode: _mode,
    gesture: _gesture,
    target: _target,
    source: _source,
    sources: _sources,
    sourceMode: _sourceMode,
    sourceErrorMode: _sourceErrorMode,
    sourceLabel: _sourceLabel,
    privacy: _privacy,
    provenance: _provenance,
    ...promptOptions
  } = options;

  return {
    ...promptOptions,
    ...(promptOptions.preset ? { preset: promptOptions.preset as AskablePromptPreset } : {}),
    ...(promptOptions.format ? { format: promptOptions.format as AskablePromptFormat } : {}),
  };
}

function toAsyncPromptOptions(options: AskableMcpContextOptions): AskableAsyncContextOutputOptions {
  const promptOptions = toPromptOptions(options) as AskableAsyncContextOutputOptions;
  return {
    ...promptOptions,
    ...(options.sources ? { sources: options.sources as 'all' | AskableContextSourceInclude[] } : {}),
    ...(options.sourceMode ? { sourceMode: options.sourceMode as AskableContextSourceMode } : {}),
    ...(options.sourceErrorMode ? { sourceErrorMode: options.sourceErrorMode as AskableContextSourceErrorMode } : {}),
    ...(options.sourceLabel ? { sourceLabel: options.sourceLabel } : {}),
  };
}

function toPacketOptions(options: AskableMcpContextOptions): AskableMcpContextOptions {
  const {
    sources: _sources,
    sourceMode: _sourceMode,
    sourceErrorMode: _sourceErrorMode,
    sourceLabel: _sourceLabel,
    currentLabel: _currentLabel,
    historyLabel: _historyLabel,
    ...packetOptions
  } = options;

  return packetOptions;
}

function mergeHandleRequestOptions(
  first?: HandleRequestOptions,
  second?: HandleRequestOptions,
): HandleRequestOptions | undefined {
  if (!first) return second;
  if (!second) return first;

  return {
    ...first,
    ...second,
    ...(first.authInfo || second.authInfo
      ? { authInfo: second.authInfo ?? first.authInfo }
      : {}),
  };
}

function createAskableMcpErrorResponse(status: number, code: number, message: string): Response {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    error: {
      code,
      message,
    },
    id: null,
  }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resolveMaxRequestBodyBytes(value: AskableMcpWebHandlerOptions['maxRequestBodyBytes']): number | false {
  if (value === false) return false;
  if (typeof value === 'number') return Math.max(0, Math.floor(value));
  return defaultMaxRequestBodyBytes;
}

function isRequestBodyTooLarge(request: Request, maxRequestBodyBytes: number | false): boolean {
  if (maxRequestBodyBytes === false || !requestMayHaveBody(request)) return false;

  const contentLength = request.headers.get('Content-Length');
  if (!contentLength) return false;

  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > maxRequestBodyBytes;
}

function requestMayHaveBody(request: Request): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
}

async function resolveCorsHeaders(
  cors: AskableMcpWebHandlerOptions['cors'],
  request: Request,
): Promise<Headers | undefined | false> {
  if (!cors) return undefined;

  const config = cors === true ? {} : cors;
  const origin = request.headers.get('Origin');
  const allowedOrigin = await resolveAllowedOrigin(config.origin ?? true, origin, request);
  if (!allowedOrigin) return origin ? false : undefined;

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  if (allowedOrigin !== '*') headers.set('Vary', 'Origin');
  if (config.credentials) headers.set('Access-Control-Allow-Credentials', 'true');

  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', (config.methods ?? [
      'GET',
      'POST',
      'DELETE',
      'OPTIONS',
    ]).join(', '));
    headers.set(
      'Access-Control-Allow-Headers',
      (config.headers ?? request.headers.get('Access-Control-Request-Headers')?.split(',').map((header) => header.trim()).filter(Boolean) ?? [
        'Authorization',
        'Content-Type',
        'MCP-Protocol-Version',
      ]).join(', '),
    );
    if (typeof config.maxAge === 'number') {
      headers.set('Access-Control-Max-Age', String(config.maxAge));
    }
  }

  if (config.exposedHeaders?.length) {
    headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
  }

  return headers;
}

async function resolveAllowedOrigin(
  allowed: AskableMcpCorsOrigin,
  origin: string | null,
  request: Request,
): Promise<string | undefined> {
  if (typeof allowed === 'function') {
    const result = await allowed(origin, request);
    if (typeof result === 'string') return result;
    if (result === true) return origin ?? '*';
    return undefined;
  }

  if (allowed === true) return origin ?? '*';
  if (allowed === false) return undefined;
  if (typeof allowed === 'string') return origin === allowed ? allowed : undefined;
  return origin && allowed.includes(origin) ? origin : undefined;
}

async function finalizeAskableMcpWebResponse(
  request: Request,
  response: Response,
  options: AskableMcpWebHandlerOptions,
  metadata: {
    corsHeaders?: Headers;
    outcome: AskableMcpWebOutcome;
    startedAt: number;
  },
): Promise<Response> {
  const headers = new Headers(response.headers);
  setMissingHeaders(headers, defaultWebResponseHeaders);
  if (metadata.corsHeaders) mergeHeaders(headers, metadata.corsHeaders);

  const configuredHeaders = typeof options.responseHeaders === 'function'
    ? await options.responseHeaders(request, response)
    : options.responseHeaders;
  if (configuredHeaders) mergeHeaders(headers, new Headers(configuredHeaders));

  const finalized = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  await emitAskableMcpTelemetry(request, finalized, options, metadata);
  return finalized;
}

async function emitAskableMcpTelemetry(
  request: Request,
  response: Response,
  options: AskableMcpWebHandlerOptions,
  metadata: {
    outcome: AskableMcpWebOutcome;
    startedAt: number;
  },
): Promise<void> {
  if (!options.telemetry) return;

  const url = new URL(request.url);
  try {
    await options.telemetry({
      method: request.method,
      url: `${url.origin}${url.pathname}`,
      path: url.pathname,
      status: response.status,
      outcome: metadata.outcome,
      durationMs: Math.max(0, Date.now() - metadata.startedAt),
      ...(request.headers.get('Origin') ? { origin: request.headers.get('Origin') ?? undefined } : {}),
      ...(request.headers.get('User-Agent') ? { userAgent: request.headers.get('User-Agent') ?? undefined } : {}),
      ...(request.headers.get('X-Request-Id') ? { requestId: request.headers.get('X-Request-Id') ?? undefined } : {}),
    });
  } catch (error) {
    options.onError?.(error, request);
  }
}

function setMissingHeaders(headers: Headers, next: HeadersInit): void {
  for (const [key, value] of new Headers(next)) {
    if (!headers.has(key)) headers.set(key, value);
  }
}

function mergeHeaders(headers: Headers, next: Headers): void {
  for (const [key, value] of next) {
    if (key.toLowerCase() === 'vary' && headers.has('Vary')) {
      headers.set('Vary', mergeHeaderValues(headers.get('Vary'), value));
    } else {
      headers.set(key, value);
    }
  }
}

function mergeHeaderValues(first: string | null, second: string): string {
  const values = new Set([
    ...(first?.split(',') ?? []),
    ...second.split(','),
  ].map((value) => value.trim()).filter(Boolean));

  return Array.from(values).join(', ');
}
