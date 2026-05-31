import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { webContextPacketSchema } from '@askable-ui/context';
import type { WebContextPacket } from '@askable-ui/context';

export interface AskableMcpContextOptions {
  history?: number;
  includeViewport?: boolean;
  intent?: string;
}

export interface AskableMcpContextProvider {
  getContext(options?: AskableMcpContextOptions): WebContextPacket | Promise<WebContextPacket>;
  formatContextForPrompt?(packet: WebContextPacket): string | Promise<string>;
}

export interface AskableMcpServerOptions {
  name?: string;
  version?: string;
  provider: AskableMcpContextProvider;
}

const contextOptionsShape = {
  history: z.number().int().min(0).max(50).optional(),
  includeViewport: z.boolean().optional(),
  intent: z.string().optional(),
};

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
      const packet = await options.provider.getContext(args);
      const text = options.provider.formatContextForPrompt
        ? await options.provider.formatContextForPrompt(packet)
        : defaultPromptFormatter(packet);

      return {
        content: [
          {
            type: 'text',
            text,
          },
        ],
      };
    },
  );

  return server;
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
  ];

  return parts.filter((part): part is string => Boolean(part)).join('\n');
}
