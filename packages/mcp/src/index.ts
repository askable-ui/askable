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
  responseHeaders?: AskableMcpWebResponseHeaders;
  telemetry?: AskableMcpWebTelemetry;
  requestOptions?:
    | HandleRequestOptions
    | ((request: Request) => HandleRequestOptions | Promise<HandleRequestOptions>);
  onError?: (error: unknown, request: Request) => void;
}

export type AskableMcpWebHandler = (request: Request) => Promise<Response>;

export type AskableMcpSourceContext = Pick<AskableContext, 'toContextPacket' | 'toContext'> &
  Partial<Pick<AskableContext, 'toContextPacketAsync' | 'toContextAsync'>>;

export interface CreateAskableMcpContextProviderOptions extends AskableMcpContextOptions {}

const defaultWebResponseHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

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
