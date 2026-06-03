import { describe, expect, it, vi } from 'vitest';
import { createWebContextPacket } from '@askable-ui/context';
import {
  createAskableMcpContextProvider,
  createAskableMcpServer,
  defaultPromptFormatter,
  type AskableMcpContextProvider,
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
