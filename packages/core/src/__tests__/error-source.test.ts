import { describe, expect, it } from 'vitest';
import { createAskableContext, createAskableErrorSource } from '../index.js';
import type { AskableErrorEntry } from '../index.js';

const ERRORS: AskableErrorEntry[] = [
  { key: 'email', message: 'Invalid email address' },
  { key: 'card', message: ['Card is required', 'Must be 16 digits'] },
];

const MIXED: AskableErrorEntry[] = [
  { key: 'apiError', message: 'Server returned 500', severity: 'error' },
  { key: 'rateLimit', message: 'You are being rate limited', severity: 'warning' },
  { key: 'hint', message: 'Consider adding a phone number', severity: 'info' },
];

describe('createAskableErrorSource', () => {
  it('exposes state mode', () => {
    const source = createAskableErrorSource({ getErrors: () => ERRORS });
    expect(source.modes).toContain('state');
  });

  it('getState() returns error and warning counts', async () => {
    const source = createAskableErrorSource({ getErrors: () => ERRORS });
    const state = await Promise.resolve(source.getState?.()) as {
      total: number;
      errorCount: number;
      hasErrors: boolean;
    };
    expect(state.total).toBe(2);
    expect(state.errorCount).toBe(2);
    expect(state.hasErrors).toBe(true);
  });

  it('resolve() returns errors and warnings separated', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('errors', createAskableErrorSource({ getErrors: () => MIXED }));

    const resolved = await ctx.resolveSource('errors');
    const data = resolved.data as {
      errors: AskableErrorEntry[];
      warnings: AskableErrorEntry[];
      hasErrors: boolean;
      hasWarnings: boolean;
    };
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].key).toBe('apiError');
    expect(data.warnings).toHaveLength(1);
    expect(data.warnings[0].key).toBe('rateLimit');
    expect(data.hasErrors).toBe(true);
    expect(data.hasWarnings).toBe(true);

    ctx.destroy();
  });

  it('reports hasErrors: false when no errors', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('errors', createAskableErrorSource({ getErrors: () => [] }));

    const resolved = await ctx.resolveSource('errors');
    const data = resolved.data as { hasErrors: boolean; total: number };
    expect(data.hasErrors).toBe(false);
    expect(data.total).toBe(0);

    ctx.destroy();
  });

  it('accepts async getErrors', async () => {
    const ctx = createAskableContext();
    ctx.registerSource(
      'errors',
      createAskableErrorSource({
        getErrors: async () => [{ key: 'async', message: 'Loaded asynchronously' }],
      }),
    );

    const resolved = await ctx.resolveSource('errors');
    const data = resolved.data as { errors: AskableErrorEntry[] };
    expect(data.errors[0].key).toBe('async');

    ctx.destroy();
  });

  it('uses custom describe and kind', async () => {
    const ctx = createAskableContext();
    ctx.registerSource(
      'form-errors',
      createAskableErrorSource({
        getErrors: () => ERRORS,
        describe: 'Checkout form errors',
        kind: 'form-errors',
      }),
    );

    const resolved = await ctx.resolveSource('form-errors');
    expect(resolved.kind).toBe('form-errors');
    expect(resolved.description).toBe('Checkout form errors');

    ctx.destroy();
  });

  it('treats entries without severity as "error"', async () => {
    const ctx = createAskableContext();
    ctx.registerSource(
      'errors',
      createAskableErrorSource({
        getErrors: () => [
          { key: 'x', message: 'no severity' },
          { key: 'y', message: 'explicit error', severity: 'error' },
        ],
      }),
    );

    const state = (await ctx.resolveSource('errors', { mode: 'state' }))
      .state as { errorCount: number };
    expect(state.errorCount).toBe(2);

    ctx.destroy();
  });
});
