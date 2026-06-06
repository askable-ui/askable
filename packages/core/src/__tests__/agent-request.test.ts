import { describe, expect, it } from 'vitest';
import { createAskableContext, isAskableAgentRequest } from '../index.js';

describe('agent request helpers', () => {
  it('accepts requests produced by toAgentRequest()', async () => {
    const ctx = createAskableContext();
    ctx.push({ widget: 'accounts-table' }, 'Accounts table');

    const request = await ctx.toAgentRequest('Which account needs follow-up?', {
      requestId: 'req_123',
      metadata: { route: '/accounts' },
      packet: true,
    });

    expect(isAskableAgentRequest(request)).toBe(true);

    ctx.destroy();
  });

  it('accepts valid request payloads without optional fields', () => {
    expect(isAskableAgentRequest({
      question: 'What changed?',
      context: 'Current: User is focused on: widget: revenue',
      focus: null,
      timestamp: Date.now(),
    })).toBe(true);
  });

  it('rejects malformed or incomplete request payloads', () => {
    expect(isAskableAgentRequest(null)).toBe(false);
    expect(isAskableAgentRequest([])).toBe(false);
    expect(isAskableAgentRequest({
      question: '',
      context: 'Current context',
      focus: null,
      timestamp: Date.now(),
    })).toBe(false);
    expect(isAskableAgentRequest({
      question: 'What changed?',
      context: 'Current context',
      focus: null,
      timestamp: 'now',
    })).toBe(false);
    expect(isAskableAgentRequest({
      question: 'What changed?',
      context: 'Current context',
      focus: null,
      packet: { protocol: 'wrong' },
      timestamp: Date.now(),
    })).toBe(false);
    expect(isAskableAgentRequest({
      question: 'What changed?',
      context: 'Current context',
      focus: null,
      metadata: 'route=/accounts',
      timestamp: Date.now(),
    })).toBe(false);
  });
});
