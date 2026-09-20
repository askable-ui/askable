import {
  createAskableContext,
  type AskableResolvedContextSource,
  type AskableContextSourceResolveRequest,
  type AskableContextSourceRequest,
} from '../index.js';

describe('agent request source snapshots', () => {
  it.each([false, true])('shares a sanitized source result with contextFromPacket=%s', async (contextFromPacket) => {
    const sanitizeSource = vi.fn((source: AskableResolvedContextSource) => ({ ...source, description: 'Safe source' }));
    const ctx = createAskableContext({ sanitizeSource });
    ctx.push({ record: 'first' }, 'First record');
    let revision = 0;
    const resolve = vi.fn(() => ({ revision: ++revision, secret: 'private' }));
    const getState = vi.fn(() => ({ revision }));
    const describe = vi.fn(() => 'Source description');
    const sanitize = vi.fn((source: AskableResolvedContextSource) => ({
      ...source,
      data: { revision: (source.data as { revision: number }).revision },
    }));
    ctx.registerSource('records', { resolve, getState, describe, sanitize });

    const request = await ctx.toAgentRequest('Explain', {
      sources: ['records'], packet: true, contextFromPacket, format: 'json',
    });
    const promptSource = JSON.parse(request.context).sources[0];
    const packetSource = request.packet!.surrounding!.sources![0];

    expect(resolve).toHaveBeenCalledOnce();
    expect(getState).toHaveBeenCalledOnce();
    expect(describe).toHaveBeenCalledOnce();
    expect(sanitize).toHaveBeenCalledOnce();
    expect(sanitizeSource).toHaveBeenCalledOnce();
    expect(promptSource.data).toEqual({ revision: 1 });
    expect(packetSource.metadata).toMatchObject({ data: promptSource.data, state: promptSource.state });
    expect(promptSource.description).toBe('Safe source');
    expect(packetSource.text).toBe('Safe source');
    expect(JSON.stringify(request)).not.toContain('private');
    ctx.destroy();
  });

  it('passes the generated packet selection to the one shared resolver call', async () => {
    const ctx = createAskableContext();
    ctx.push({ record: 'selected' }, 'Selected record');
    const resolve = vi.fn(({ selection, mode }: AskableContextSourceResolveRequest) => ({ selection, mode }));
    ctx.registerSource('records', { resolve });

    const request = await ctx.toAgentRequest('Explain', {
      sources: ['records'], packet: true, selectionFromPacket: true, format: 'json',
    });

    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve.mock.calls[0][0]).toMatchObject({
      mode: 'selected', selection: { target: { metadata: { record: 'selected' } } },
    });
    expect(request.packet!.surrounding!.sources![0].metadata).toMatchObject({
      data: JSON.parse(request.context).sources[0].data,
    });
    ctx.destroy();
  });

  it('captures prompt, history, and focus before waiting for sources', async () => {
    const ctx = createAskableContext();
    ctx.push({ record: 'first' }, 'First record');
    let finish!: (data: unknown) => void;
    const data = new Promise((resolve) => { finish = resolve; });
    const firstFocus = ctx.getFocus();
    const resolve = vi.fn((_request: AskableContextSourceResolveRequest) => data);
    ctx.registerSource('records', { resolve });

    const pending = ctx.toAgentRequest('Explain', { sources: ['records'], packet: true, history: 1 });
    ctx.push({ record: 'second' }, 'Second record');
    finish({ count: 1 });
    const request = await pending;

    expect(request.context).toContain('First record');
    expect(request.context).not.toContain('Second record');
    expect(request.focus?.meta).toEqual({ record: 'first' });
    expect(request.packet?.target?.metadata).toEqual({ record: 'first' });
    expect(resolve.mock.calls[0][0].focus).toBe(firstFocus);
    ctx.destroy();
  });

  it('shares matching queries despite different output formatting and privacy options', async () => {
    const ctx = createAskableContext();
    ctx.push({ record: 'first' }, 'First record');
    const resolve = vi.fn(() => ({ value: 42 }));
    ctx.registerSource('records', { resolve });

    const request = await ctx.toAgentRequest('Explain', {
      sources: [{ id: ' records ', mode: 'summary' }],
      format: 'json',
      currentLabel: 'Approved',
      packet: {
        sources: ['records'], includeText: false,
        privacy: { consent: 'explicit', redacted: false },
      },
    });

    expect(resolve).toHaveBeenCalledOnce();
    expect(request.packet?.target?.text).toBeUndefined();
    expect(request.packet?.privacy).toMatchObject({ consent: 'explicit', redacted: false });
    expect(JSON.parse(request.context).sources[0].data).toEqual({ value: 42 });
    ctx.destroy();
  });

  it.each(['mode', 'selection', 'maxItems', 'maxTokens', 'timeoutMs', 'signal'] as const)(
    'keeps requests with a different %s separate', async (field) => {
      const ctx = createAskableContext();
      let revision = 0;
      const resolve = vi.fn(() => ({ revision: ++revision }));
      ctx.registerSource('records', { resolve });
      const packetQuery: AskableContextSourceRequest = {
        id: 'records', mode: 'summary', selection: { id: 1 }, maxItems: 3,
        maxTokens: 40, timeoutMs: 1000, signal: new AbortController().signal,
      };
      const differences: Partial<AskableContextSourceRequest> = {
        mode: 'all', selection: { id: 1 }, maxItems: 5, maxTokens: 80,
        timeoutMs: 2000, signal: new AbortController().signal,
      };
      const promptQuery = { ...packetQuery, [field]: differences[field] };
      const request = await ctx.toAgentRequest('Explain', {
        sources: [promptQuery], packet: { sources: [packetQuery] }, format: 'json',
      });

      expect(resolve).toHaveBeenCalledTimes(2);
      expect(request.packet!.surrounding!.sources![0].metadata).toMatchObject({ data: { revision: 1 } });
      expect(JSON.parse(request.context).sources[0].data).toEqual({ revision: 2 });
      ctx.destroy();
    },
  );

  it.each([undefined, null, { ids: ['approved'] }])('respects selection override %j', async (selection) => {
    const ctx = createAskableContext();
    ctx.push({ record: 'first' }, 'First record');
    const resolve = vi.fn((_request: AskableContextSourceResolveRequest) => 'data');
    ctx.registerSource('records', { resolve });
    await ctx.toAgentRequest('Explain', {
      sources: [{ id: 'records', selection }],
      packet: true, selectionFromPacket: true, sourceMode: 'summary',
    });

    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve.mock.calls[0][0].mode).toBe('summary');
    if (selection === undefined) {
      expect(resolve.mock.calls[0][0].selection).toMatchObject({ target: { metadata: { record: 'first' } } });
    } else {
      expect(resolve.mock.calls[0][0].selection).toBe(selection);
    }
    ctx.destroy();
  });

  it('keeps explicit packet source options independent of prompt source options', async () => {
    const ctx = createAskableContext();
    const resolve = vi.fn(({ mode }: AskableContextSourceResolveRequest) => mode);
    ctx.registerSource('records', { resolve });
    const promptOnly = await ctx.toAgentRequest('Explain', { sources: ['records'], packet: {}, format: 'json' });
    expect(promptOnly.packet?.surrounding?.sources).toBeUndefined();
    expect(JSON.parse(promptOnly.context).sources).toHaveLength(1);
    const packetOnly = await ctx.toAgentRequest('Explain', { packet: { sources: ['records'] } });
    expect(packetOnly.packet?.surrounding?.sources).toHaveLength(1);
    expect(packetOnly.context).not.toContain('Context sources');

    const differentDefaults = await ctx.toAgentRequest('Explain', {
      sources: ['records'], selectionFromPacket: true, format: 'json',
      packet: { sources: ['records'] },
    });
    expect(differentDefaults.packet!.surrounding!.sources![0].metadata).toMatchObject({ mode: 'summary' });
    expect(JSON.parse(differentDefaults.context).sources[0].mode).toBe('selected');
    ctx.destroy();
  });

  it('does not replace sources or identity in an existing capture packet', async () => {
    const ctx = createAskableContext();
    let revision = 0;
    const resolve = vi.fn(() => ({ revision: ++revision }));
    ctx.registerSource('records', { resolve });
    const packet = await ctx.toContextPacketAsync({ sources: ['records'] });
    const before = JSON.stringify(packet);

    const request = await ctx.toAgentRequest('Explain', {
      packet, contextFromPacket: true, sources: ['records'], format: 'json',
    });

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(request.packet).toBe(packet);
    expect(JSON.stringify(packet)).toBe(before);
    expect(JSON.parse(request.context).sources[0].data).toEqual({ revision: 2 });
    ctx.destroy();
  });

  it('does not serialize unused live history for packet-grounded prompts', async () => {
    const ctx = createAskableContext();
    ctx.push({ unsafeHistory: BigInt(1) }, 'Old record');
    ctx.push({ record: 'safe' }, 'Safe record');
    const packet = ctx.toContextPacket();

    const request = await ctx.toAgentRequest('Explain', {
      packet, contextFromPacket: true, format: 'json', history: 2,
    });

    expect(JSON.stringify(request)).not.toContain('unsafeHistory');
    expect(JSON.parse(request.context).target.text).toBe('Safe record');
    ctx.destroy();
  });

  it.each(['natural', 'json'] as const)('captures the pinned packet prompt before waiting (%s)', async (format) => {
    const ctx = createAskableContext();
    let finish!: (value: unknown) => void;
    ctx.registerSource('records', { resolve: () => new Promise((resolve) => { finish = resolve; }) });
    const packet = ctx.toContextPacket({ target: { text: 'Approved selection' } });

    const pending = ctx.toAgentRequest('Explain', {
      packet, contextFromPacket: true, sources: ['records'], format,
    });
    packet.target!.text = 'Later selection';
    await Promise.resolve();
    finish({ count: 1 });
    const request = await pending;

    expect(request.context).toContain('Approved selection');
    expect(request.context).not.toContain('Later selection');
    expect(request.packet).toBe(packet);
    ctx.destroy();
  });

  it.each([['include', 'omit'], ['omit', 'include']] as const)(
    'shares failure with packet=%s and prompt=%s without leaking details', async (packetPolicy, promptPolicy) => {
      const ctx = createAskableContext();
      const resolve = vi.fn(() => { throw new Error('Private access token'); });
      ctx.registerSource('records', { resolve });
      const request = await ctx.toAgentRequest('Explain', {
        sources: ['records'], sourceErrorMode: promptPolicy,
        packet: { sources: ['records'], sourceErrorMode: packetPolicy },
      });

      expect(resolve).toHaveBeenCalledOnce();
      expect(request.packet?.surrounding?.sources?.length ?? 0).toBe(packetPolicy === 'include' ? 1 : 0);
      expect(request.context.includes('Context source unavailable.')).toBe(promptPolicy === 'include');
      expect(JSON.stringify(request)).not.toContain('Private access token');
      ctx.destroy();
    },
  );

  it('does not let packet omission swallow a prompt throw policy', async () => {
    const ctx = createAskableContext();
    const failure = new Error('Unavailable');
    const resolve = vi.fn(() => { throw failure; });
    ctx.registerSource('records', { resolve });

    await expect(ctx.toAgentRequest('Explain', {
      sources: ['records'], sourceErrorMode: 'throw',
      packet: { sources: ['records'], sourceErrorMode: 'omit' },
    })).rejects.toBe(failure);
    expect(resolve).toHaveBeenCalledOnce();
    ctx.destroy();
  });

  it('honors cancellation of a shared resolution', async () => {
    const ctx = createAskableContext();
    const controller = new AbortController();
    const resolve = vi.fn(() => new Promise(() => {}));
    ctx.registerSource('records', { resolve });
    const pending = ctx.toAgentRequest('Explain', {
      sources: [{ id: 'records', signal: controller.signal }],
      packet: true, sourceErrorMode: 'throw',
    });
    const rejected = expect(pending).rejects.toThrow('Context source request aborted.');
    await Promise.resolve();
    controller.abort();
    await rejected;
    expect(resolve).toHaveBeenCalledOnce();
    ctx.destroy();
  });

  it('preserves source order and duplicate output entries', async () => {
    const ctx = createAskableContext();
    const first = vi.fn(() => 'A');
    const second = vi.fn(() => 'B');
    ctx.registerSource('a', { resolve: first });
    ctx.registerSource('b', { resolve: second });
    const request = await ctx.toAgentRequest('Explain', {
      sources: ['b', 'a', 'a'], packet: { sources: ['a', 'b'] }, format: 'json',
    });

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(JSON.parse(request.context).sources.map((source: { id: string }) => source.id)).toEqual(['b', 'a', 'a']);
    expect(request.packet!.surrounding!.sources!.map((source) => source.label)).toEqual(['a', 'b']);
    ctx.destroy();
  });

  it('keeps timeout handling and error policies on a shared request', async () => {
    vi.useFakeTimers();
    const ctx = createAskableContext();
    try {
      const resolve = vi.fn(() => new Promise(() => {}));
      ctx.registerSource('records', { resolve });
      const sources = [{ id: 'records', timeoutMs: 10 }];
      const pending = ctx.toAgentRequest('Explain', {
        sources, sourceErrorMode: 'omit',
        packet: { sources, sourceErrorMode: 'include' },
      });
      await vi.advanceTimersByTimeAsync(10);
      const request = await pending;

      expect(resolve).toHaveBeenCalledOnce();
      expect(request.context).not.toContain('Context source unavailable.');
      expect(request.packet!.surrounding!.sources![0].metadata).toMatchObject({
        error: { message: 'Context source unavailable.' },
      });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      ctx.destroy();
      vi.useRealTimers();
    }
  });

  it('does not reuse results across successive or overlapping requests', async () => {
    const ctx = createAskableContext();
    let revision = 0;
    const resolve = vi.fn(() => ({ revision: ++revision }));
    ctx.registerSource('records', { resolve });
    const options = { sources: 'all' as const, packet: true as const, format: 'json' as const };
    const first = ctx.toAgentRequest('First', options);
    const second = ctx.toAgentRequest('Second', options);
    const requests = [await first, await second, await ctx.toAgentRequest('Third', options)];

    expect(resolve).toHaveBeenCalledTimes(3);
    expect(requests.map((request) => JSON.parse(request.context).sources[0].data.revision)).toEqual([1, 2, 3]);
    ctx.destroy();
  });
});
