#!/usr/bin/env node
/**
 * askable-mcp — a turnkey stdio MCP server.
 *
 * Spawned by MCP clients (Claude Desktop, Cursor, …) that launch a command over
 * stdio rather than connecting to an HTTP URL. It exposes the askable context
 * tools/resources backed by a remote endpoint that serves the current Context
 * packet, or a static packet file.
 *
 * Claude Desktop (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "my-app": {
 *         "command": "npx",
 *         "args": ["-y", "@askable-ui/mcp", "--url", "http://localhost:3001/context"]
 *       }
 *     }
 *   }
 *
 * IMPORTANT: stdout is the MCP protocol channel — all human-facing logging goes
 * to stderr.
 */
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { WebContextPacket } from '@askable-ui/context';
import {
  createAskableMcpServer,
  createAskableMcpRemoteProvider,
  type AskableMcpContextProvider,
} from './index.js';

const HELP = `askable-mcp — expose your app's UI context to any MCP client over stdio

Usage:
  askable-mcp --url <endpoint> [options]
  askable-mcp --file <path> [options]

Context source (one required):
  --url <endpoint>      HTTP(S) endpoint that returns the current Context packet as JSON on GET
  --file <path>         Path to a static Context packet JSON file

Options:
  --header "K: V"       Extra request header for --url (repeatable), e.g. "Authorization: Bearer abc"
  --name <name>         Server name advertised to the client (default: askable-context)
  --require-redacted    Refuse to serve packets with privacy.redacted === false
  -h, --help            Show this help

Example (claude_desktop_config.json):
  { "mcpServers": { "my-app": {
      "command": "npx",
      "args": ["-y", "@askable-ui/mcp", "--url", "http://localhost:3001/context"] } } }
`;

export function parseHeaders(raw: string[] | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const entry of raw ?? []) {
    const idx = entry.indexOf(':');
    if (idx === -1) continue;
    const key = entry.slice(0, idx).trim();
    const value = entry.slice(idx + 1).trim();
    if (key) headers[key] = value;
  }
  return headers;
}

function createFileProvider(path: string): AskableMcpContextProvider {
  return {
    async getContext() {
      const raw = await readFile(path, 'utf8');
      return JSON.parse(raw) as WebContextPacket;
    },
  };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      url: { type: 'string' },
      file: { type: 'string' },
      header: { type: 'string', multiple: true },
      name: { type: 'string' },
      'require-redacted': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: false,
  });

  if (values.help) {
    process.stderr.write(HELP);
    return;
  }

  if (!values.url && !values.file) {
    process.stderr.write('askable-mcp: one of --url or --file is required.\n\n');
    process.stderr.write(HELP);
    process.exitCode = 1;
    return;
  }

  const provider = values.url
    ? createAskableMcpRemoteProvider({ url: values.url, headers: parseHeaders(values.header) })
    : createFileProvider(values.file as string);

  const server = createAskableMcpServer({
    provider,
    name: values.name,
    requireRedacted: values['require-redacted'],
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const sourceLabel = values.url ?? values.file;
  process.stderr.write(`askable-mcp: serving context from ${sourceLabel} over stdio.\n`);
}

// Run only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`askable-mcp: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
