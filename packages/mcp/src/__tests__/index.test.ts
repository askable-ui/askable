import { describe, expect, it, vi } from 'vitest';
import { createWebContextPacket } from '@askable-ui/context';
import {
  createAskableMcpContextProvider,
  defaultPromptFormatter,
  type AskableMcpSourceContext,
} from '../index.js';

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
    ].join('\n'));
  });
});
