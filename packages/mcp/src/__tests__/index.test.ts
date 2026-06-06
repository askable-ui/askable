import { describe, expect, it, vi } from 'vitest';
import { createWebContextPacket } from '@askable-ui/context';
import {
  ASKABLE_MCP_PAGE_BRIDGE_CHANNEL,
  ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL,
  ASKABLE_MCP_PAGE_BRIDGE_VERSION,
  createAskableMcpContextProvider,
  createAskableMcpPageBridge,
  createAskableMcpServer,
  createAskableMcpWebHandler,
  defaultPromptFormatter,
  type AskableMcpContextProvider,
  type AskableMcpPageBridgeResponse,
  type AskableMcpPageBridgeWindow,
  type AskableMcpSourceContext,
} from '../index.js';

type McpToolHandler = (args: Record<string, unknown>) => Promise<{
  isError?: boolean;
  content: Array<{ type: string; text: string }>;
}>;

function getToolHandler(provider: AskableMcpContextProvider, toolName: string): McpToolHandler {
  const server = createAskableMcpServer({ provider });
  const tools = (server as unknown as { _registeredTools: Record<string, { handler: McpToolHandler }> })._registeredTools;
  const tool = tools[toolName];
  if (!tool) throw new Error(`Tool ${toolName} not registered`);
  return tool.handler;
}

class FakePageBridgeWindow implements AskableMcpPageBridgeWindow {
  location = { origin: 'https://app.example' };
  listeners = new Set<(event: MessageEvent) => void>();
  posted: Array<{ message: AskableMcpPageBridgeResponse; targetOrigin: string }> = [];

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this.listeners.delete(listener);
  }

  postMessage(message: AskableMcpPageBridgeResponse, targetOrigin: string): void {
    this.posted.push({ message, targetOrigin });
  }

  emit(data: unknown, origin = this.location.origin): void {
    for (const listener of this.listeners) {
      listener({ data, origin } as MessageEvent);
    }
  }
}

function flushPageBridge(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createAskableMcpContextProvider', () => {
  it('adapts an Askable context to an MCP context provider', async () => {
    const packet = createWebContextPacket({
      source: { app: 'test-app' },
      capture: { mode: 'element-focus' },
      privacy: { consent: 'explicit' },
    });
    const ctx = {
      toContextPacket: vi.fn(() => packet),
      toContext: vi.fn(() => 'Prompt context'),
    } satisfies AskableMcpSourceContext;

    const provider = createAskableMcpContextProvider(ctx, {
      history: 2,
      includeViewport: true,
      source: { app: 'default-app' },
      privacy: { consent: 'implicit' },
      provenance: { producer: 'default-producer' },
    });

    await expect(Promise.resolve(provider.getContext({
      intent: 'explain selected UI',
      privacy: { consent: 'explicit', omitted: ['email'] },
      provenance: { method: 'mcp' },
    }))).resolves.toBe(packet);

    expect(ctx.toContextPacket).toHaveBeenCalledWith({
      history: 2,
      includeViewport: true,
      intent: 'explain selected UI',
      source: { app: 'default-app' },
      privacy: { consent: 'explicit', omitted: ['email'] },
      provenance: { producer: 'default-producer', method: 'mcp' },
    });
  });

  it('uses async packet and prompt methods when available', async () => {
    const packet = createWebContextPacket({
      capture: { mode: 'semantic' },
      surrounding: {
        sources: [
          {
            label: 'accounts',
            role: 'collection',
            metadata: { id: 'accounts', mode: 'summary', data: { total: 12 } },
          },
        ],
      },
    });
    const ctx = {
      toContextPacket: vi.fn(() => createWebContextPacket({ capture: { mode: 'element-focus' } })),
      toContextPacketAsync: vi.fn(async () => packet),
      toContext: vi.fn(() => 'Sync prompt'),
      toContextAsync: vi.fn(async () => 'Async prompt with sources'),
    } satisfies AskableMcpSourceContext;
    const provider = createAskableMcpContextProvider(ctx, {
      sources: [{ id: 'accounts', mode: 'summary', timeoutMs: 750 }],
      sourceErrorMode: 'include',
    });

    await expect(Promise.resolve(provider.getContext({
      sourceMode: 'summary',
    }))).resolves.toBe(packet);
    await expect(Promise.resolve(provider.formatContextForPrompt?.(packet, {
      sourceLabel: 'App sources',
    }))).resolves.toBe('Async prompt with sources');

    expect(ctx.toContextPacketAsync).toHaveBeenCalledWith({
      sources: [{ id: 'accounts', mode: 'summary', timeoutMs: 750 }],
      sourceErrorMode: 'include',
      sourceMode: 'summary',
    });
    expect(ctx.toContextPacket).not.toHaveBeenCalled();
    expect(ctx.toContextAsync).toHaveBeenCalledWith({
      sources: [{ id: 'accounts', mode: 'summary', timeoutMs: 750 }],
      sourceErrorMode: 'include',
      sourceLabel: 'App sources',
    });
    expect(ctx.toContext).not.toHaveBeenCalled();
  });

  it('removes source options when falling back to sync packet and prompt methods', async () => {
    const packet = createWebContextPacket({
      capture: { mode: 'element-focus' },
    });
    const ctx = {
      toContextPacket: vi.fn(() => packet),
      toContext: vi.fn(() => 'Sync prompt'),
    } satisfies AskableMcpSourceContext;
    const provider = createAskableMcpContextProvider(ctx, {
      sources: ['accounts'],
      sourceMode: 'summary',
      sourceErrorMode: 'include',
      sourceLabel: 'Sources',
      currentLabel: 'Current UI',
    });

    await provider.getContext();
    await provider.formatContextForPrompt?.(packet);

    expect(ctx.toContextPacket).toHaveBeenCalledWith({});
    expect(ctx.toContext).toHaveBeenCalledWith({
      currentLabel: 'Current UI',
    });
  });

  it('formats prompt text from the source context with prompt-safe options', async () => {
    const packet = createWebContextPacket({
      capture: { mode: 'element-focus' },
    });
    const ctx = {
      toContextPacket: vi.fn(() => packet),
      toContext: vi.fn(() => 'Scoped prompt context'),
    } satisfies AskableMcpSourceContext;
    const provider = createAskableMcpContextProvider(ctx, {
      currentLabel: 'Current UI',
      includeViewport: true,
      source: { app: 'dashboard' },
    });

    await expect(Promise.resolve(provider.formatContextForPrompt?.(packet, {
      history: 3,
      intent: 'summarize this region',
      scope: 'analytics',
      includeText: false,
      maxTokens: 50,
    }))).resolves.toBe('Scoped prompt context');

    expect(ctx.toContext).toHaveBeenCalledWith({
      currentLabel: 'Current UI',
      history: 3,
      scope: 'analytics',
      includeText: false,
      maxTokens: 50,
    });
  });
});

describe('createAskableMcpServer', () => {
  it('returns isError when get_current_context provider throws', async () => {
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockRejectedValue(new Error('provider crashed')),
    };
    const handler = getToolHandler(provider, 'get_current_context');
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to get context');
  });

  it('returns isError when format_context_for_prompt provider throws', async () => {
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockRejectedValue(new Error('context unavailable')),
    };
    const handler = getToolHandler(provider, 'format_context_for_prompt');
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to format context');
  });

  it('returns isError when formatContextForPrompt throws after getContext succeeds', async () => {
    const packet = createWebContextPacket({ capture: { mode: 'element-focus' } });
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockResolvedValue(packet),
      formatContextForPrompt: vi.fn().mockRejectedValue(new Error('format failed')),
    };
    const handler = getToolHandler(provider, 'format_context_for_prompt');
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to format context');
  });

  it('passes recognized context options to the provider', async () => {
    const packet = createWebContextPacket({ capture: { mode: 'element-focus' } });
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockResolvedValue(packet),
    };
    const handler = getToolHandler(provider, 'get_current_context');
    await handler({ intent: 'test intent', history: 3 });
    expect(provider.getContext).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'test intent', history: 3 }),
    );
  });

  it('uses defaultPromptFormatter when provider has no formatContextForPrompt', async () => {
    const packet = createWebContextPacket({
      source: { url: 'https://example.com' },
      capture: { mode: 'element-focus', intent: 'test' },
    });
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockResolvedValue(packet),
    };
    const handler = getToolHandler(provider, 'format_context_for_prompt');
    const result = await handler({});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Context mode: element-focus');
    expect(result.content[0].text).toContain('User intent: test');
    expect(result.content[0].text).toContain('URL: https://example.com');
  });
});

describe('createAskableMcpWebHandler', () => {
  it('handles stateless Streamable HTTP tool calls', async () => {
    const packet = createWebContextPacket({
      source: { app: 'dashboard' },
      capture: { mode: 'region' },
      privacy: { consent: 'explicit' },
    });
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockResolvedValue(packet),
    };
    const handler = createAskableMcpWebHandler({ provider });

    const response = await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-06-18',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'get_current_context',
          arguments: { intent: 'inspect selected dashboard' },
        },
      }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json() as {
      result: { content: Array<{ type: string; text: string }> };
    };
    expect(body.result.content[0].type).toBe('text');
    expect(JSON.parse(body.result.content[0].text)).toMatchObject({
      source: { app: 'dashboard' },
      capture: { mode: 'region' },
      privacy: { consent: 'explicit' },
    });
    expect(provider.getContext).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'inspect selected dashboard' }),
    );
  });

  it('accepts per-request transport options', async () => {
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockResolvedValue(createWebContextPacket({
        capture: { mode: 'semantic' },
      })),
    };
    const handler = createAskableMcpWebHandler({
      provider,
      requestOptions: () => ({
        parsedBody: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'get_current_context', arguments: {} },
        },
      }),
    });

    const response = await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-06-18',
      },
      body: 'not-json',
    }));

    expect(response.status).toBe(200);
    expect(provider.getContext).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthorized requests before context is read', async () => {
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn(),
    };
    const handler = createAskableMcpWebHandler({
      provider,
      authorize: () => false,
    });

    const response = await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_current_context', arguments: {} },
      }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32001, message: 'Unauthorized MCP request.' },
    });
    expect(provider.getContext).not.toHaveBeenCalled();
  });

  it('allows custom authorization responses', async () => {
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn(),
    };
    const handler = createAskableMcpWebHandler({
      provider,
      authorize: () => new Response('token expired', {
        status: 403,
        headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' },
      }),
    });

    const response = await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: '{}',
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer error="invalid_token"');
    await expect(response.text()).resolves.toBe('token expired');
    expect(provider.getContext).not.toHaveBeenCalled();
  });

  it('uses authorized request options before reading the request body', async () => {
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockResolvedValue(createWebContextPacket({
        capture: { mode: 'semantic' },
      })),
    };
    const handler = createAskableMcpWebHandler({
      provider,
      authorize: (request) => ({
        parsedBody: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'get_current_context',
            arguments: { intent: request.headers.get('x-intent') ?? undefined },
          },
        },
      }),
    });

    const response = await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-06-18',
        'x-intent': 'inspect authorized context',
      },
      body: 'not-json',
    }));

    expect(response.status).toBe(200);
    expect(provider.getContext).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'inspect authorized context' }),
    );
  });

  it('handles CORS preflight requests without reading context', async () => {
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn(),
    };
    const handler = createAskableMcpWebHandler({
      provider,
      cors: {
        origin: 'https://app.example',
        headers: ['Authorization', 'Content-Type'],
        credentials: true,
        maxAge: 600,
      },
    });

    const response = await handler(new Request('https://example.com/mcp', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.example',
        'Access-Control-Request-Headers': 'Authorization, Content-Type',
      },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, Content-Type');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(response.headers.get('Access-Control-Max-Age')).toBe('600');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(provider.getContext).not.toHaveBeenCalled();
  });

  it('rejects disallowed CORS origins before authorization runs', async () => {
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn(),
    };
    const authorize = vi.fn();
    const handler = createAskableMcpWebHandler({
      provider,
      authorize,
      cors: { origin: ['https://app.example'] },
    });

    const response = await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        Origin: 'https://evil.example',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_current_context', arguments: {} },
      }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32003, message: 'CORS origin not allowed.' },
    });
    expect(authorize).not.toHaveBeenCalled();
    expect(provider.getContext).not.toHaveBeenCalled();
  });

  it('rejects oversized MCP requests before authorization or context is read', async () => {
    const telemetry = vi.fn();
    const authorize = vi.fn();
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn(),
    };
    const handler = createAskableMcpWebHandler({
      provider,
      authorize,
      telemetry,
    });

    const response = await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'Content-Length': '1048577',
      },
      body: '{}',
    }));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32004, message: 'MCP request body is too large.' },
    });
    expect(authorize).not.toHaveBeenCalled();
    expect(provider.getContext).not.toHaveBeenCalled();
    expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      status: 413,
      outcome: 'payload_too_large',
    }));
  });

  it('supports custom and disabled MCP request body limits', async () => {
    const packet = createWebContextPacket({
      capture: { mode: 'semantic' },
    });
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockResolvedValue(packet),
    };
    const smallLimit = createAskableMcpWebHandler({
      provider,
      maxRequestBodyBytes: 10,
    });
    const disabledLimit = createAskableMcpWebHandler({
      provider,
      maxRequestBodyBytes: false,
    });
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'get_current_context', arguments: {} },
    });

    const rejected = await smallLimit(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'Content-Length': String(body.length),
      },
      body,
    }));
    const accepted = await disabledLimit(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-06-18',
        'Content-Length': String(body.length),
      },
      body,
    }));

    expect(rejected.status).toBe(413);
    expect(accepted.status).toBe(200);
    expect(provider.getContext).toHaveBeenCalledTimes(1);
  });

  it('adds CORS and response headers to MCP responses', async () => {
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockResolvedValue(createWebContextPacket({
        capture: { mode: 'semantic' },
      })),
    };
    const handler = createAskableMcpWebHandler({
      provider,
      cors: {
        origin: true,
        exposedHeaders: ['Mcp-Session-Id'],
      },
      responseHeaders: {
        'X-Askable-Deployment': 'production',
      },
    });

    const response = await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-06-18',
        Origin: 'https://app.example',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_current_context', arguments: {} },
      }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('Mcp-Session-Id');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Askable-Deployment')).toBe('production');
    expect(provider.getContext).toHaveBeenCalledTimes(1);
  });

  it('lets responseHeaders derive headers from the request and response', async () => {
    const handler = createAskableMcpWebHandler({
      provider: {
        getContext: vi.fn(),
      },
      authorize: () => false,
      responseHeaders: (request, response) => ({
        'X-Mcp-Path': new URL(request.url).pathname,
        'X-Mcp-Status': String(response.status),
      }),
    });

    const response = await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: '{}',
    }));

    expect(response.status).toBe(401);
    expect(response.headers.get('X-Mcp-Path')).toBe('/mcp');
    expect(response.headers.get('X-Mcp-Status')).toBe('401');
  });

  it('emits sanitized telemetry for successful MCP responses', async () => {
    const telemetry = vi.fn();
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockResolvedValue(createWebContextPacket({
        capture: { mode: 'semantic' },
      })),
    };
    const handler = createAskableMcpWebHandler({
      provider,
      telemetry,
    });

    const response = await handler(new Request('https://example.com/mcp?token=secret', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-06-18',
        Origin: 'https://app.example',
        'User-Agent': 'test-agent',
        'X-Request-Id': 'req-1',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_current_context', arguments: {} },
      }),
    }));

    expect(response.status).toBe(200);
    expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: 'https://example.com/mcp',
      path: '/mcp',
      status: 200,
      outcome: 'success',
      origin: 'https://app.example',
      userAgent: 'test-agent',
      requestId: 'req-1',
    }));
    expect(telemetry.mock.calls[0][0].durationMs).toEqual(expect.any(Number));
    expect(telemetry.mock.calls[0][0].url).not.toContain('secret');
    expect(telemetry.mock.calls[0][0]).not.toHaveProperty('body');
    expect(telemetry.mock.calls[0][0]).not.toHaveProperty('packet');
  });

  it('emits telemetry for preflight and rejected requests', async () => {
    const telemetry = vi.fn();
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn(),
    };
    const handler = createAskableMcpWebHandler({
      provider,
      authorize: () => false,
      cors: { origin: ['https://app.example'] },
      telemetry,
    });

    await handler(new Request('https://example.com/mcp', {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example' },
    }));
    await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        Origin: 'https://evil.example',
      },
      body: '{}',
    }));
    await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        Origin: 'https://app.example',
      },
      body: '{}',
    }));

    expect(telemetry).toHaveBeenCalledTimes(3);
    expect(telemetry.mock.calls[0][0]).toMatchObject({
      method: 'OPTIONS',
      status: 204,
      outcome: 'preflight',
    });
    expect(telemetry.mock.calls[1][0]).toMatchObject({
      method: 'POST',
      status: 403,
      outcome: 'cors_rejected',
      origin: 'https://evil.example',
    });
    expect(telemetry.mock.calls[2][0]).toMatchObject({
      method: 'POST',
      status: 401,
      outcome: 'unauthorized',
      origin: 'https://app.example',
    });
    expect(provider.getContext).not.toHaveBeenCalled();
  });

  it('emits telemetry for setup errors', async () => {
    const telemetry = vi.fn();
    const handler = createAskableMcpWebHandler({
      provider: {
        getContext: vi.fn(),
      },
      requestOptions: () => {
        throw new Error('request setup failed');
      },
      telemetry,
    });

    const response = await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: '{}',
    }));

    expect(response.status).toBe(500);
    expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({
      status: 500,
      outcome: 'error',
      path: '/mcp',
    }));
  });

  it('does not fail the response when telemetry throws', async () => {
    const onError = vi.fn();
    const handler = createAskableMcpWebHandler({
      provider: {
        getContext: vi.fn(),
      },
      authorize: () => false,
      telemetry: () => {
        throw new Error('telemetry unavailable');
      },
      onError,
    });

    const response = await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: '{}',
    }));

    expect(response.status).toBe(401);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('returns a JSON-RPC error response when setup fails', async () => {
    const onError = vi.fn();
    const handler = createAskableMcpWebHandler({
      provider: {
        getContext: vi.fn(),
      },
      requestOptions: () => {
        throw new Error('request setup failed');
      },
      onError,
    });

    const response = await handler(new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { message: 'Askable MCP handler failed.' },
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('createAskableMcpPageBridge', () => {
  it('responds to same-origin page bridge context requests', async () => {
    const packet = createWebContextPacket({
      source: { app: 'dashboard' },
      capture: { mode: 'region' },
      privacy: { consent: 'explicit' },
    });
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockResolvedValue(packet),
    };
    const fakeWindow = new FakePageBridgeWindow();
    createAskableMcpPageBridge({ provider, window: fakeWindow });

    fakeWindow.emit({
      protocol: ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL,
      version: ASKABLE_MCP_PAGE_BRIDGE_VERSION,
      channel: ASKABLE_MCP_PAGE_BRIDGE_CHANNEL,
      type: 'get_current_context',
      requestId: 'req-1',
      options: { intent: 'inspect selected chart', history: 2 },
    });
    await flushPageBridge();

    expect(provider.getContext).toHaveBeenCalledWith({
      intent: 'inspect selected chart',
      history: 2,
    });
    expect(fakeWindow.posted).toEqual([
      {
        targetOrigin: 'https://app.example',
        message: expect.objectContaining({
          protocol: ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL,
          version: ASKABLE_MCP_PAGE_BRIDGE_VERSION,
          channel: ASKABLE_MCP_PAGE_BRIDGE_CHANNEL,
          type: 'get_current_context:result',
          requestId: 'req-1',
          packet,
        }),
      },
    ]);
  });

  it('formats context for prompt requests', async () => {
    const packet = createWebContextPacket({
      capture: { mode: 'text-selection' },
      target: { text: 'Quarterly revenue rose 12%' },
    });
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockResolvedValue(packet),
      formatContextForPrompt: vi.fn().mockResolvedValue('Prompt-ready selection'),
    };
    const fakeWindow = new FakePageBridgeWindow();
    createAskableMcpPageBridge({
      provider,
      window: fakeWindow,
      targetOrigin: 'https://extension.example',
    });

    fakeWindow.emit({
      protocol: ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL,
      version: ASKABLE_MCP_PAGE_BRIDGE_VERSION,
      type: 'format_context_for_prompt',
      requestId: 'req-2',
      options: { maxTokens: 100 },
    });
    await flushPageBridge();

    expect(provider.formatContextForPrompt).toHaveBeenCalledWith(packet, { maxTokens: 100 });
    expect(fakeWindow.posted[0]).toEqual({
      targetOrigin: 'https://extension.example',
      message: expect.objectContaining({
        type: 'format_context_for_prompt:result',
        requestId: 'req-2',
        text: 'Prompt-ready selection',
      }),
    });
  });

  it('ignores invalid channels and disallowed origins', async () => {
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn(),
    };
    const fakeWindow = new FakePageBridgeWindow();
    createAskableMcpPageBridge({
      provider,
      window: fakeWindow,
      channel: 'private-channel',
      allowedOrigins: ['https://trusted.example'],
    });

    fakeWindow.emit({
      protocol: ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL,
      version: ASKABLE_MCP_PAGE_BRIDGE_VERSION,
      channel: 'wrong-channel',
      type: 'get_current_context',
      requestId: 'req-3',
    }, 'https://trusted.example');
    fakeWindow.emit({
      protocol: ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL,
      version: ASKABLE_MCP_PAGE_BRIDGE_VERSION,
      channel: 'private-channel',
      type: 'get_current_context',
      requestId: 'req-4',
    }, 'https://evil.example');
    await flushPageBridge();

    expect(provider.getContext).not.toHaveBeenCalled();
    expect(fakeWindow.posted).toHaveLength(0);
  });

  it('posts a bridge error response when provider resolution fails', async () => {
    const onError = vi.fn();
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn().mockRejectedValue(new Error('context unavailable')),
    };
    const fakeWindow = new FakePageBridgeWindow();
    createAskableMcpPageBridge({ provider, window: fakeWindow, onError });

    fakeWindow.emit({
      protocol: ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL,
      version: ASKABLE_MCP_PAGE_BRIDGE_VERSION,
      type: 'get_current_context',
      requestId: 'req-5',
    });
    await flushPageBridge();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(fakeWindow.posted[0]).toEqual({
      targetOrigin: 'https://app.example',
      message: expect.objectContaining({
        type: 'get_current_context:error',
        requestId: 'req-5',
        error: { message: 'Askable MCP page bridge failed.' },
      }),
    });
  });

  it('removes the page bridge listener on dispose', async () => {
    const provider: AskableMcpContextProvider = {
      getContext: vi.fn(),
    };
    const fakeWindow = new FakePageBridgeWindow();
    const bridge = createAskableMcpPageBridge({ provider, window: fakeWindow });
    bridge.dispose();

    fakeWindow.emit({
      protocol: ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL,
      version: ASKABLE_MCP_PAGE_BRIDGE_VERSION,
      type: 'get_current_context',
      requestId: 'req-6',
    });
    await flushPageBridge();

    expect(provider.getContext).not.toHaveBeenCalled();
    expect(fakeWindow.listeners.size).toBe(0);
  });
});

describe('defaultPromptFormatter', () => {
  it('renders the packet fields that are useful for prompts', () => {
    const packet = createWebContextPacket({
      source: {
        url: 'https://example.com/dashboard',
        title: 'Analytics',
      },
      capture: {
        mode: 'region',
        intent: 'explain the highlighted chart',
      },
      target: {
        text: 'Revenue rose 12%',
        metadata: { metric: 'revenue', delta: '+12%' },
      },
      surrounding: {
        visible: [{ metadata: { metric: 'churn' }, text: 'Churn is 4.2%' }],
        history: [{ metadata: { metric: 'pipeline' }, text: 'Pipeline is $8.1M' }],
        sources: [{ label: 'accounts', role: 'collection', metadata: { data: { total: 12 } } }],
      },
    });

    expect(defaultPromptFormatter(packet)).toBe([
      'Context mode: region',
      'User intent: explain the highlighted chart',
      'URL: https://example.com/dashboard',
      'Title: Analytics',
      'Target text: Revenue rose 12%',
      'Target metadata: {"metric":"revenue","delta":"+12%"}',
      'Visible context: [{"metadata":{"metric":"churn"},"text":"Churn is 4.2%"}]',
      'Recent context: [{"metadata":{"metric":"pipeline"},"text":"Pipeline is $8.1M"}]',
      'Source context: [{"label":"accounts","role":"collection","metadata":{"data":{"total":12}}}]',
    ].join('\n'));
  });
});
