import { describe, it, expect } from 'vitest';
import { createAskableContext } from '@askable-ui/core';

// Qwik hooks require a Qwik component context ($) and useVisibleTask$.
// These contract tests exercise the underlying core API directly —
// the same APIs useAskableAgent wraps — to verify the integration contract.

describe('useAskableAgent (Qwik) — contract tests', () => {
  it('toAgentRequest() returns a valid request shape', async () => {
    const ctx = createAskableContext();
    const req = await ctx.toAgentRequest('What is this?');
    expect(req.question).toBe('What is this?');
    expect(typeof req.context).toBe('string');
    expect(typeof req.timestamp).toBe('number');
    expect(req.focus === null || typeof req.focus === 'object').toBe(true);
    ctx.destroy();
  });

  it('toAgentRequest() includes focus when context is set', async () => {
    const ctx = createAskableContext();
    ctx.push({ metric: 'revenue', value: '$2.4M' }, 'Revenue KPI');
    const req = await ctx.toAgentRequest('Explain this metric');
    expect(req.context).toContain('revenue');
    expect(req.focus).not.toBeNull();
    ctx.destroy();
  });

  it('toAgentRequest() has a numeric timestamp per call', async () => {
    const ctx = createAskableContext();
    const before = Date.now();
    const req = await ctx.toAgentRequest('Q');
    const after = Date.now();
    expect(req.timestamp).toBeGreaterThanOrEqual(before);
    expect(req.timestamp).toBeLessThanOrEqual(after);
    ctx.destroy();
  });

  it('toAgentRequest() accepts metadata', async () => {
    const ctx = createAskableContext();
    const req = await ctx.toAgentRequest('Test', {
      metadata: { userId: 'u-42', route: '/dashboard' },
    });
    expect(req.metadata).toMatchObject({ userId: 'u-42', route: '/dashboard' });
    ctx.destroy();
  });
});
