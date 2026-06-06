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

export interface AskableMcpWebHandlerOptions extends AskableMcpServerOptions {
  transport?: AskableMcpStatelessTransportOptions;
  requestOptions?:
    | HandleRequestOptions
    | ((request: Request) => HandleRequestOptions | Promise<HandleRequestOptions>);
  onError?: (error: unknown, request: Request) => void;
}

export type AskableMcpWebHandler = (request: Request) => Promise<Response>;

export type AskableMcpSourceContext = Pick<AskableContext, 'toContextPacket' | 'toContext'> &
  Partial<Pick<AskableContext, 'toContextPacketAsync' | 'toContextAsync'>>;

export interface CreateAskableMcpContextProviderOptions extends AskableMcpContextOptions {}

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
    try {
      const server = createAskableMcpServer(options);
      const transport = new WebStandardStreamableHTTPServerTransport({
        enableJsonResponse: true,
        ...options.transport,
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      const requestOptions = typeof options.requestOptions === 'function'
        ? await options.requestOptions(request)
        : options.requestOptions;

      return transport.handleRequest(request, requestOptions);
    } catch (error) {
      options.onError?.(error, request);
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Askable MCP handler failed.',
        },
        id: null,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
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
