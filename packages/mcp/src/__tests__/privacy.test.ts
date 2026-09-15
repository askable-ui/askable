import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebContextPacket, type WebContextPacket } from '@askable-ui/context';
import { createAskableContext } from '../../../core/src/index.js';
import {
  ASKABLE_MCP_CURRENT_CONTEXT_RESOURCE_URI,
  ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL,
  ASKABLE_MCP_PAGE_BRIDGE_VERSION,
  createAskableMcpContextProvider,
  createAskableMcpPageBridge,
  createAskableMcpRemoteProvider,
  createAskableMcpWebHandler,
  type AskableMcpContextProvider,
  type AskableMcpPageBridgeRequestType,
  type AskableMcpPageBridgeResponse,
  type AskableMcpPageBridgeWindow,
} from '../index.js';

const privateText = 'private-fixture-value';

function packet(): WebContextPacket {
  return createWebContextPacket({
    source: { app: 'host-app', timestamp: '2026-01-01T00:00:00.000Z' },
    capture: { mode: 'semantic' },
    target: { text: privateText },
    surrounding: { sources: [{ label: 'host-source', metadata: { value: privateText } }] },
    privacy: { redacted: true, consent: 'explicit' },
  });
}

const invalidPrivacy = [
  ['missing privacy', undefined],
  ['null privacy', null],
  ['empty privacy', {}],
  ['missing redacted', { consent: 'explicit' }],
  ['string redacted', { redacted: 'true', consent: 'explicit' }],
  ['numeric redacted', { redacted: 1, consent: 'explicit' }],
  ['null redacted', { redacted: null, consent: 'explicit' }],
  ['missing consent', { redacted: true }],
  ['invalid consent', { redacted: true, consent: 'approved' }],
  ['invalid omitted list', { redacted: true, consent: 'explicit', omitted: [42] }],
] as const;

const invalidPackets: Array<[string, unknown]> = [
  ['null packet', null],
  ['array packet', []],
  ['string packet', privateText],
  ['empty packet', {}],
  ['wrong protocol', { ...packet(), protocol: 'other.context' }],
  ['wrong version', { ...packet(), version: 'invalid' }],
  ['missing timestamp', { ...packet(), source: { app: 'host-app' } }],
  ['invalid source field', { ...packet(), source: { ...packet().source, url: 42 } }],
  ['invalid capture', { ...packet(), capture: { mode: 'invalid' } }],
  ['invalid provenance', { ...packet(), provenance: { producer: 'host', method: 'invalid' } }],
  ['invalid target', { ...packet(), target: { text: 42 } }],
  ['invalid bounds', { ...packet(), target: { bounds: { x: 0, y: 0, width: 'wide', height: 1 } } }],
  ['invalid screenshot', { ...packet(), target: { screenshot: { mimeType: 'text/plain' } } }],
  ['invalid surrounding source', { ...packet(), surrounding: { sources: [{ label: 42 }] } }],
  ['unknown packet field', { ...packet(), extra: privateText }],
  ['unknown target field', { ...packet(), target: { text: privateText, extra: privateText } }],
  ...invalidPrivacy.map(([name, privacy]): [string, unknown] => [name, { ...packet(), privacy }]),
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('remote packet schema validation', () => {
  it.each(invalidPackets)('rejects %s without returning packet contents', async (_name, value) => {
    const provider = createAskableMcpRemoteProvider({
      url: 'https://app.example/context',
      fetch: vi.fn(async () => Response.json(value)),
    });

    await expect(provider.getContext()).rejects.toThrow('Invalid Context packet');
    await expect(provider.getContext()).rejects.not.toThrow(privateText);
  });

  it.each([false, true])('preserves a valid packet with redacted=%s', async (redacted) => {
    const value = packet();
    value.privacy.redacted = redacted;
    value.target = {
      text: 'Public text',
      role: 'region',
      bounds: { x: 0, y: 0, width: 20, height: 10 },
      metadata: { nested: { count: 1 }, values: [null, false, 'public'] },
      screenshot: { mimeType: 'image/png', url: 'https://app.example/preview.png' },
    };
    const provider = createAskableMcpRemoteProvider({
      url: 'https://app.example/context',
      fetch: vi.fn(async () => Response.json(value)),
    });

    await expect(provider.getContext()).resolves.toEqual(value);
  });
});

const toolNames = ['get_current_context', 'list_context_sources', 'format_context_for_prompt'] as const;

async function callMcp(
  provider: AskableMcpContextProvider,
  method: string,
  params: Record<string, unknown>,
  requireRedacted = true,
) {
  const response = await createAskableMcpWebHandler({ provider, requireRedacted })(
    new Request('https://app.example/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-06-18',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
  expect(response.status).toBe(200);
  return response.json();
}

describe('MCP output privacy boundary', () => {
  it.each([
    ['unredacted', { ...packet(), privacy: { redacted: false, consent: 'implicit' } }],
    ...invalidPackets,
  ])('blocks %s through every context tool and resource', async (_name, value) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = {
      getContext: vi.fn().mockResolvedValue(value),
      formatContextForPrompt: vi.fn(() => privateText),
    };

    for (const name of toolNames) {
      const body = await callMcp(provider, 'tools/call', { name, arguments: {} });
      expect(body.result.isError).toBe(true);
      expect(JSON.stringify(body)).not.toContain(privateText);
    }

    const body = await callMcp(provider, 'resources/read', { uri: ASKABLE_MCP_CURRENT_CONTEXT_RESOURCE_URI });
    expect(body.error).toBeDefined();
    expect(body.result).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(privateText);
    expect(provider.formatContextForPrompt).not.toHaveBeenCalled();
  });

  it.each([false, true])('still rejects malformed packets when requireRedacted=%s', async (requireRedacted) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider = { getContext: vi.fn().mockResolvedValue({ ...packet(), privacy: undefined }) };
    for (const name of toolNames) {
      const body = await callMcp(provider, 'tools/call', { name, arguments: {} }, requireRedacted);
      expect(body.result.isError).toBe(true);
    }
    const body = await callMcp(provider, 'resources/read', { uri: ASKABLE_MCP_CURRENT_CONTEXT_RESOURCE_URI }, requireRedacted);
    expect(body.error).toBeDefined();
  });

  it.each([false, true])('allows schema-valid output with requireRedacted=%s', async (requireRedacted) => {
    const value = packet();
    value.privacy.redacted = requireRedacted;
    const provider = {
      getContext: vi.fn(() => value),
      formatContextForPrompt: vi.fn(() => 'Public prompt'),
    };

    for (const name of toolNames) {
      const body = await callMcp(provider, 'tools/call', { name, arguments: {} }, requireRedacted);
      expect(body.error).toBeUndefined();
      expect(body.result.isError).toBeFalsy();
    }
    const body = await callMcp(provider, 'resources/read', { uri: ASKABLE_MCP_CURRENT_CONTEXT_RESOURCE_URI }, requireRedacted);
    expect(JSON.parse(body.result.contents[0].text)).toEqual(value);
    expect(provider.formatContextForPrompt).toHaveBeenCalledOnce();
  });

  it('leaves schema tools and resources available without reading app context', async () => {
    const provider = { getContext: vi.fn() };
    const tool = await callMcp(provider, 'tools/call', { name: 'get_context_schema', arguments: {} });
    const resource = await callMcp(provider, 'resources/read', { uri: 'context://schema' });
    expect(tool.result.isError).toBeFalsy();
    expect(resource.error).toBeUndefined();
    expect(provider.getContext).not.toHaveBeenCalled();
  });
});

class PageWindow implements AskableMcpPageBridgeWindow {
  location = { origin: 'https://app.example' };
  listeners = new Set<(event: MessageEvent) => void>();
  posted: AskableMcpPageBridgeResponse[] = [];

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }

  postMessage(response: AskableMcpPageBridgeResponse, origin: string) {
    expect(origin).toBe(this.location.origin);
    this.posted.push(response);
  }

  async request(type: AskableMcpPageBridgeRequestType, options?: Record<string, unknown>) {
    const count = this.posted.length;
    for (const listener of this.listeners) {
      listener({
        origin: this.location.origin,
        data: {
          protocol: ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL,
          version: ASKABLE_MCP_PAGE_BRIDGE_VERSION,
          requestId: 'privacy-regression',
          type,
          options,
        },
      } as MessageEvent);
    }
    await vi.waitFor(() => expect(this.posted).toHaveLength(count + 1), { interval: 1 });
    return this.posted[count];
  }
}

const pageRequests = [
  { type: 'get_current_context' },
  { type: 'format_context_for_prompt' },
  { type: 'read_current_resource', resource: { format: 'packet', includePacket: true } },
  { type: 'read_current_resource', resource: { format: 'prompt', includePacket: true } },
] as const;

describe('page output privacy boundary', () => {
  it.each([
    ['unredacted', { ...packet(), privacy: { redacted: false, consent: 'implicit' } }],
    ...invalidPackets,
  ])('blocks %s through every page response format', async (_name, value) => {
    const provider = {
      getContext: vi.fn().mockResolvedValue(value),
      formatContextForPrompt: vi.fn(() => privateText),
    };
    const window = new PageWindow();
    const bridge = createAskableMcpPageBridge({ provider, window, requireRedacted: true });
    try {
      for (const request of pageRequests) {
        const response = await window.request(request.type, request);
        expect(response.type).toBe(`${request.type}:error`);
        expect(response).not.toHaveProperty('packet');
        expect(response).not.toHaveProperty('text');
        expect(response).not.toHaveProperty('resource');
        expect(JSON.stringify(response)).not.toContain(privateText);
      }
      expect(provider.formatContextForPrompt).not.toHaveBeenCalled();
    } finally {
      bridge.dispose();
    }
  });
});

describe('host-owned page context options with the real core adapter', () => {
  it.each(['sync', 'async'] as const)('cannot forge redaction with a %s provider', async (mode) => {
    const ctx = createAskableContext();
    ctx.push({ label: 'Private fixture' }, privateText);
    const source = mode === 'async' ? ctx : {
      toContextPacket: ctx.toContextPacket.bind(ctx),
      toContext: ctx.toContext.bind(ctx),
    };
    const provider = createAskableMcpContextProvider(source, {
      privacy: { redacted: false, consent: 'none' },
      provenance: { producer: 'host-app', method: 'app' },
    });
    const format = vi.spyOn(provider, 'formatContextForPrompt');
    const window = new PageWindow();
    const bridge = createAskableMcpPageBridge({ provider, window, requireRedacted: true });
    try {
      for (const request of pageRequests) {
        const response = await window.request(request.type, {
          ...request,
          privacy: { redacted: true, consent: 'explicit', omitted: [] },
          provenance: { producer: 'caller', method: 'manual' },
        });
        expect(response.type).toBe(`${request.type}:error`);
        expect(JSON.stringify(response)).not.toContain(privateText);
      }
      expect(format).not.toHaveBeenCalled();
    } finally {
      bridge.dispose();
      ctx.destroy();
    }
  });

  it('does not infer host redaction from caller options when the host leaves privacy unset', async () => {
    const ctx = createAskableContext();
    ctx.push({}, privateText);
    const provider = createAskableMcpContextProvider(ctx);
    const window = new PageWindow();
    const bridge = createAskableMcpPageBridge({ provider, window, requireRedacted: true });
    try {
      const response = await window.request('get_current_context', { privacy: { redacted: true } });
      expect(response.type).toBe('get_current_context:error');
      expect(JSON.stringify(response)).not.toContain(privateText);
    } finally {
      bridge.dispose();
      ctx.destroy();
    }
  });

  it.each([false, true])('preserves host policy and legitimate options with requireRedacted=%s', async (requireRedacted) => {
    const ctx = createAskableContext({ sanitizeText: () => 'Public text' });
    ctx.push({ label: 'Public label', internal: privateText }, privateText);
    const defaults = {
      source: { app: 'host-app', url: 'https://app.example', title: 'Host page' },
      privacy: { redacted: true, consent: 'implicit' as const, omitted: ['internal'] },
      provenance: { producer: 'host-app', method: 'app' as const },
      excludeKeys: ['internal'],
    };
    const provider = createAskableMcpContextProvider(ctx, defaults);
    const getContext = vi.spyOn(provider, 'getContext');
    const format = vi.spyOn(provider, 'formatContextForPrompt');
    const window = new PageWindow();
    const bridge = createAskableMcpPageBridge({ provider, window, requireRedacted });
    const allowed = { intent: 'Explain public context', history: 1, maxTokens: 200, sources: [] };
    try {
      for (const request of pageRequests) {
        const response = await window.request(request.type, {
          ...request,
          ...allowed,
          privacy: { redacted: false, consent: 'none', omitted: [] },
          provenance: { producer: 'caller', method: 'extension' },
          source: { app: 'caller-app', url: 'https://caller.example', timestamp: 'caller' },
          target: { text: privateText },
          mode: 'custom',
          gesture: 'custom',
          excludeKeys: [],
          unknownOption: privateText,
        });
        expect(response.type).toBe(`${request.type}:result`);
        expect(JSON.stringify(response)).not.toContain(privateText);
        expect(getContext).toHaveBeenLastCalledWith(allowed);
        if ('packet' in response && response.packet) {
          expect(response.packet).toMatchObject(defaultsToPacket());
        }
        if ('resource' in response && response.resource?.packet) {
          expect(response.resource.packet).toMatchObject(defaultsToPacket());
        }
      }
      expect(format).toHaveBeenCalledTimes(2);
      expect(format.mock.lastCall?.[0]).toMatchObject(defaultsToPacket());
      expect(format.mock.lastCall?.[1]).toEqual(allowed);
    } finally {
      bridge.dispose();
      ctx.destroy();
    }

    function defaultsToPacket() {
      return { source: defaults.source, privacy: defaults.privacy, provenance: defaults.provenance };
    }
  });

  it.each([{ history: -1 }, { includeText: 'yes' }, { sources: [{ id: 42 }] }])(
    'rejects invalid allowed options before reading app context: %j',
    async (options) => {
      const provider = { getContext: vi.fn(() => packet()) };
      const window = new PageWindow();
      const bridge = createAskableMcpPageBridge({ provider, window });
      try {
        expect((await window.request('get_current_context', options)).type).toBe('get_current_context:error');
        expect(provider.getContext).not.toHaveBeenCalled();
      } finally {
        bridge.dispose();
      }
    },
  );

  it('keeps direct app-owned source, privacy, provenance and target overrides working', async () => {
    const ctx = createAskableContext();
    const provider = createAskableMcpContextProvider(ctx, {
      source: { app: 'host-app' },
      privacy: { redacted: false, consent: 'none' },
      provenance: { producer: 'host-app', method: 'app' },
    });
    try {
      const value = await provider.getContext({
        source: { title: 'Approved view' },
        privacy: { redacted: true, consent: 'explicit' },
        provenance: { method: 'manual' },
        target: { text: 'Approved text' },
        mode: 'region',
      });
      expect(value).toMatchObject({
        source: { app: 'host-app', title: 'Approved view' },
        privacy: { redacted: true, consent: 'explicit' },
        provenance: { producer: 'host-app', method: 'manual' },
        target: { text: 'Approved text' },
        capture: { mode: 'region' },
      });
    } finally {
      ctx.destroy();
    }
  });
});
