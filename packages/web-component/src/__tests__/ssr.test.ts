// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('server import', () => {
  it('loads without browser element globals', async () => {
    const module = await import('../index.js');

    expect(module.AskableContextElement).toBeTypeOf('function');
    expect(module.defineAskableContext).toBeTypeOf('function');
  });
});
