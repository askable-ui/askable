import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAskableContext } from '../index.js';

function makeEl(meta: object | string, text = 'Hello'): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-askable', typeof meta === 'string' ? meta : JSON.stringify(meta));
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

function cleanup(el: HTMLElement) {
  document.body.removeChild(el);
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observed = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = (el: Element) => {
    this.observed.add(el);
  };

  unobserve = (el: Element) => {
    this.observed.delete(el);
  };

  disconnect = () => {
    this.observed.clear();
  };

  trigger(entries: Array<{ target: Element; isIntersecting: boolean }>) {
    this.callback(
      entries.map((entry) => ({
        target: entry.target,
        isIntersecting: entry.isIntersecting,
        intersectionRatio: entry.isIntersecting ? 1 : 0,
      })) as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    );
  }
}

afterEach(() => {
  MockIntersectionObserver.instances = [];
  vi.useRealTimers();
});

describe('createAskableContext', () => {
  it('reuses the same named context instance in the browser', () => {
    const tableA = createAskableContext({ name: 'table' });
    const tableB = createAskableContext({ name: 'table' });
    const chart = createAskableContext({ name: 'chart' });

    expect(tableA).toBe(tableB);
    expect(chart).not.toBe(tableA);

    tableA.destroy();
    chart.destroy();
  });

  it('keeps unnamed contexts independent', () => {
    const first = createAskableContext();
    const second = createAskableContext();

    expect(first).not.toBe(second);

    first.destroy();
    second.destroy();
  });

  it('returns an object with the expected methods', () => {
    const ctx = createAskableContext();
    expect(typeof ctx.observe).toBe('function');
    expect(typeof ctx.getFocus).toBe('function');
    expect(typeof ctx.on).toBe('function');
    expect(typeof ctx.off).toBe('function');
    expect(typeof ctx.toPromptContext).toBe('function');
    expect(typeof (ctx as any).serializeFocus).toBe('function');
    expect(typeof (ctx as any).getVisibleElements).toBe('function');
    expect(typeof (ctx as any).toViewportContext).toBe('function');
    expect(typeof ctx.hasSource).toBe('function');
    expect(typeof ctx.listSources).toBe('function');
    expect(typeof ctx.subscribe).toBe('function');
    expect(typeof ctx.destroy).toBe('function');
    ctx.destroy();
  });

  it('subscribes to serialized context updates for focus and clear events', () => {
    const first = makeEl({ widget: 'table' }, 'Table');
    const second = makeEl({ widget: 'chart' }, 'Chart');
    const ctx = createAskableContext();
    ctx.observe(document);

    const onContext = vi.fn();
    const unsubscribe = ctx.subscribe(onContext, { history: 1, currentLabel: 'Now' });

    first.click();
    second.click();
    ctx.clear();

    expect(onContext).toHaveBeenCalledTimes(3);
    expect(onContext.mock.calls[0][0]).toContain('Now: User is focused on: — widget: table — value "Table"');
    expect(onContext.mock.calls[0][1]?.meta).toEqual({ widget: 'table' });
    expect(onContext.mock.calls[1][0]).toContain('Recent interactions:');
    expect(onContext.mock.calls[1][1]?.meta).toEqual({ widget: 'chart' });
    expect(onContext.mock.calls[2][0]).toContain('Now: No UI element is currently focused.');
    expect(onContext.mock.calls[2][1]).toBeNull();

    unsubscribe();
    ctx.destroy();
    cleanup(first);
    cleanup(second);
  });

  it('debounces subscribed context updates', () => {
    vi.useFakeTimers();

    const first = makeEl({ widget: 'table' }, 'Table');
    const second = makeEl({ widget: 'chart' }, 'Chart');
    const ctx = createAskableContext();
    ctx.observe(document);

    const onContext = vi.fn();
    ctx.subscribe(onContext, { debounce: 50 });

    first.click();
    second.click();

    expect(onContext).not.toHaveBeenCalled();

    vi.advanceTimersByTime(49);
    expect(onContext).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onContext).toHaveBeenCalledTimes(1);
    expect(onContext.mock.calls[0][0]).toContain('widget: chart');
    expect(onContext.mock.calls[0][1]?.meta).toEqual({ widget: 'chart' });

    ctx.destroy();
    cleanup(first);
    cleanup(second);
  });

  it('stops subscribed context updates after unsubscribe', () => {
    const first = makeEl({ widget: 'table' }, 'Table');
    const second = makeEl({ widget: 'chart' }, 'Chart');
    const ctx = createAskableContext();
    ctx.observe(document);

    const onContext = vi.fn();
    const unsubscribe = ctx.subscribe(onContext);

    first.click();
    expect(onContext).toHaveBeenCalledTimes(1);

    unsubscribe();
    second.click();
    expect(onContext).toHaveBeenCalledTimes(1);

    ctx.destroy();
    cleanup(first);
    cleanup(second);
  });

  it('subscribes to source-backed async context updates', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('accounts', {
      kind: 'collection',
      getState: () => ({ filter: 'enterprise' }),
      resolve: ({ mode }) => ({ mode, totalMatching: 12 }),
    });

    const received = new Promise<[string, unknown]>((resolve) => {
      ctx.subscribeAsync((context, focus) => {
        resolve([context, focus?.meta]);
      }, {
        history: 1,
        sources: ['accounts'],
      });
    });

    ctx.push({ widget: 'accounts-table' }, 'Accounts');

    const [context, meta] = await received;
    expect(context).toContain('Current: User is focused on: — widget: accounts-table');
    expect(context).toContain('Context sources');
    expect(context).toContain('"filter":"enterprise"');
    expect(context).toContain('"totalMatching":12');
    expect(meta).toEqual({ widget: 'accounts-table' });

    ctx.destroy();
  });

  it('refreshes async subscriptions when a registered source changes', async () => {
    const ctx = createAskableContext();
    ctx.push({ widget: 'accounts-table' }, 'Accounts');
    let totalMatching = 12;
    const handle = ctx.registerSource('accounts', {
      kind: 'collection',
      resolve: ({ mode }) => ({ mode, totalMatching }),
    });

    const received: string[] = [];
    const receivedSecond = new Promise<void>((resolve) => {
      ctx.subscribeAsync((context) => {
        received.push(context);
        if (context.includes('"totalMatching":24')) resolve();
      }, {
        emitInitial: true,
        sources: ['accounts'],
      });
    });

    await vi.waitFor(() => expect(received[0]).toContain('"totalMatching":12'));
    totalMatching = 24;
    handle.notifyChanged();

    await receivedSecond;
    expect(received).toHaveLength(2);
    expect(received[1]).toContain('widget: accounts-table');
    expect(received[1]).toContain('"totalMatching":24');

    ctx.destroy();
  });

  it('does not refresh async subscriptions for unrelated source changes', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('accounts', {
      resolve: () => ({ totalMatching: 12 }),
    });
    const calendar = ctx.registerSource('calendar', {
      resolve: () => ({ events: 3 }),
    });
    const received: string[] = [];

    ctx.subscribeAsync((context) => {
      received.push(context);
    }, {
      emitInitial: true,
      sources: ['accounts'],
    });

    await vi.waitFor(() => expect(received).toHaveLength(1));
    calendar.notifyChanged();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(received).toHaveLength(1);
    expect(received[0]).toContain('accounts');
    expect(received[0]).not.toContain('calendar');

    ctx.destroy();
  });

  it('ignores stale async source results after a newer focus update', async () => {
    const ctx = createAskableContext();
    let resolveFirst: ((value: unknown) => void) | undefined;
    ctx.registerSource('active-panel', {
      resolve: ({ focus }) => {
        const widget = typeof focus?.meta === 'object' ? focus.meta.widget : undefined;
        if (widget === 'first') {
          return new Promise((resolve) => {
            resolveFirst = resolve;
          }).then(() => ({ widget }));
        }
        return { widget };
      },
    });

    const received: string[] = [];
    const receivedSecond = new Promise<void>((resolve) => {
      ctx.subscribeAsync((context) => {
        received.push(context);
        if (context.includes('"widget":"second"')) resolve();
      }, {
        sources: ['active-panel'],
      });
    });

    ctx.push({ widget: 'first' }, 'First panel');
    ctx.push({ widget: 'second' }, 'Second panel');

    await receivedSecond;
    resolveFirst?.({});
    await Promise.resolve();
    await Promise.resolve();

    expect(received).toHaveLength(1);
    expect(received[0]).toContain('widget: second');
    expect(received[0]).toContain('"widget":"second"');

    ctx.destroy();
  });

  it('reports async subscription errors without calling the subscriber', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('accounts', {
      resolve: () => {
        throw new Error('resolver failed');
      },
    });

    const onContext = vi.fn();
    const error = new Promise<unknown>((resolve) => {
      ctx.subscribeAsync(onContext, {
        sources: ['accounts'],
        sourceErrorMode: 'throw',
        onError: resolve,
      });
    });

    ctx.push({ widget: 'accounts-table' }, 'Accounts');

    await expect(error).resolves.toBeInstanceOf(Error);
    expect(onContext).not.toHaveBeenCalled();

    ctx.destroy();
  });

  it('omits a failing source in subscribeAsync when sourceErrorMode is omit', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('healthy', {
      resolve: () => ({ rows: 5 }),
    });
    ctx.registerSource('broken', {
      resolve: () => { throw new Error('db error'); },
    });

    let received = '';
    const done = new Promise<void>((resolve) => {
      ctx.subscribeAsync((context) => {
        received = context;
        resolve();
      }, {
        sources: ['healthy', 'broken'],
        sourceErrorMode: 'omit',
      });
    });

    ctx.push({ widget: 'table' }, 'Table');
    await done;

    expect(received).toContain('healthy');
    expect(received).toContain('"rows":5');
    expect(received).not.toContain('broken');
    expect(received).not.toContain('db error');

    ctx.destroy();
  });

  it('includes error text for a failing source when sourceErrorMode is include', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('broken', {
      resolve: () => { throw new Error('db unavailable'); },
    });

    let received = '';
    const done = new Promise<void>((resolve) => {
      ctx.subscribeAsync((context) => {
        received = context;
        resolve();
      }, {
        sources: ['broken'],
        sourceErrorMode: 'include',
      });
    });

    ctx.push({ widget: 'table' }, 'Table');
    await done;

    expect(received).toContain('broken');
    expect(received).toContain('Context source unavailable.');

    ctx.destroy();
  });

  it('emits context with healthy sources when one of two fails under sourceErrorMode omit', async () => {
    const ctx = createAskableContext();
    ctx.registerSource('good', {
      resolve: () => ({ value: 42 }),
    });
    ctx.registerSource('bad', {
      resolve: () => { throw new Error('fail'); },
    });

    let received = '';
    const done = new Promise<void>((resolve) => {
      ctx.subscribeAsync((context) => {
        received = context;
        resolve();
      }, {
        sources: ['good', 'bad'],
        sourceErrorMode: 'omit',
      });
    });

    ctx.push({ widget: 'x' }, 'X');
    await done;

    expect(received).toContain('"value":42');
    expect(received).not.toContain('bad');

    ctx.destroy();
  });

  it('packages a user question with source-backed context for agent requests', async () => {
    const ctx = createAskableContext();
    ctx.push({ widget: 'accounts-table', debug: 'internal' }, 'Accounts');
    ctx.registerSource('accounts', {
      kind: 'collection',
      getState: () => ({ filter: 'enterprise' }),
      resolve: ({ mode }) => ({ mode, totalMatching: 12 }),
    });

    const request = await ctx.toAgentRequest('Which accounts need follow-up?', {
      requestId: 'req_123',
      metadata: { route: '/accounts' },
      history: 1,
      sources: ['accounts'],
      excludeKeys: ['debug'],
      packet: true,
    });

    expect(request.requestId).toBe('req_123');
    expect(request.question).toBe('Which accounts need follow-up?');
    expect(request.context).toContain('Current: User is focused on: — widget: accounts-table');
    expect(request.context).toContain('Context sources');
    expect(request.context).toContain('"totalMatching":12');
    expect(request.context).not.toContain('internal');
    expect(request.focus?.meta).toEqual({ widget: 'accounts-table' });
    expect(request.packet?.target?.metadata).toEqual({ widget: 'accounts-table' });
    expect(request.packet?.surrounding?.sources?.[0]).toMatchObject({
      label: 'accounts',
      role: 'collection',
      metadata: {
        id: 'accounts',
        mode: 'summary',
        state: { filter: 'enterprise' },
        data: { mode: 'summary', totalMatching: 12 },
      },
    });
    expect(request.metadata).toEqual({ route: '/accounts' });
    expect(typeof request.timestamp).toBe('number');

    ctx.destroy();
  });

  it('allows explicit packet options in agent request payloads', async () => {
    const ctx = createAskableContext();
    ctx.push({ widget: 'chart' }, 'Revenue');
    ctx.registerSource('chart-data', {
      resolve: () => ({ points: 12 }),
    });

    const request = await ctx.toAgentRequest('Explain this chart', {
      sources: ['chart-data'],
      packet: {
        intent: 'inspect chart',
        includeText: false,
        sources: ['chart-data'],
        privacy: { consent: 'explicit' },
      },
    });

    expect(request.context).toContain('Context sources');
    expect(request.packet?.capture.intent).toBe('inspect chart');
    expect(request.packet?.privacy.consent).toBe('explicit');
    expect(request.packet?.target?.text).toBeUndefined();
    expect(request.packet?.surrounding?.sources?.[0].metadata).toMatchObject({
      id: 'chart-data',
      data: { points: 12 },
    });

    ctx.destroy();
  });

  it('accepts an existing capture packet in agent request payloads', async () => {
    const ctx = createAskableContext();
    ctx.push({ capture: 'lasso' }, 'lasso selected 1 dashboard item');
    const packet = ctx.toContextPacket({
      mode: 'lasso',
      gesture: 'drag',
      intent: 'ask about selected accounts',
      target: {
        label: 'lasso selection',
        text: 'Acme Corp',
        bounds: { x: 10, y: 20, width: 120, height: 80 },
        metadata: {
          selectedItems: [{ company: 'Acme Corp', mrr: '$8,400' }],
        },
      },
      privacy: { consent: 'explicit' },
    });

    const request = await ctx.toAgentRequest('Why is this account healthy?', {
      packet,
      metadata: { source: 'selection-composer' },
    });

    expect(request.packet).toBe(packet);
    expect(request.packet?.capture.mode).toBe('lasso');
    expect(request.packet?.capture.intent).toBe('ask about selected accounts');
    expect(request.packet?.target?.metadata).toEqual({
      selectedItems: [{ company: 'Acme Corp', mrr: '$8,400' }],
    });
    expect(request.context).toContain('lasso selected 1 dashboard item');
    expect(request.metadata).toEqual({ source: 'selection-composer' });

    ctx.destroy();
  });

  it('getFocus() returns null before any interaction', () => {
    const ctx = createAskableContext();
    ctx.observe(document);
    expect(ctx.getFocus()).toBeNull();
    ctx.destroy();
  });

  it('tracks visible annotated elements when viewport mode is enabled', () => {
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

    const first = makeEl({ widget: 'table' }, 'Table');
    const second = makeEl({ widget: 'chart' }, 'Chart');
    const ctx = createAskableContext({ viewport: true });
    ctx.observe(document);

    const observer = MockIntersectionObserver.instances[0];
    observer.trigger([
      { target: first, isIntersecting: true },
      { target: second, isIntersecting: true },
    ]);

    const visible = (ctx as any).getVisibleElements();
    expect(visible).toHaveLength(2);
    expect(visible.map((item: { meta: Record<string, unknown> }) => item.meta.widget)).toEqual(['table', 'chart']);
    expect((ctx as any).toViewportContext()).toContain('table');
    expect((ctx as any).toViewportContext()).toContain('chart');

    ctx.destroy();
    cleanup(first);
    cleanup(second);
    globalThis.IntersectionObserver = originalIntersectionObserver;
  });

  it('getFocus() returns correct data after simulated click', () => {
    const meta = { widget: 'revenue', value: '$2.3M' };
    const el = makeEl(meta, 'Revenue Chart');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const focus = ctx.getFocus();
    expect(focus).not.toBeNull();
    expect(focus!.meta).toEqual(meta);
    expect(focus!.text).toBe('Revenue Chart');
    expect(typeof focus!.timestamp).toBe('number');
    expect(focus!.element).toBe(el);

    ctx.destroy();
    cleanup(el);
  });

  it('serializeFocus() returns null when nothing is focused', () => {
    const ctx = createAskableContext();
    ctx.observe(document);
    expect((ctx as any).serializeFocus()).toBeNull();
    ctx.destroy();
  });

  it('serializeFocus() returns structured focused data', () => {
    const el = makeEl({ metric: 'churn', value: '4.2%' }, 'Churn Rate');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    expect((ctx as any).serializeFocus()).toEqual({
      meta: { metric: 'churn', value: '4.2%' },
      text: 'Churn Rate',
      timestamp: expect.any(Number),
    });

    ctx.destroy();
    cleanup(el);
  });

  it('toContextPacket() returns a structured Context packet for focused UI', () => {
    const el = makeEl({ metric: 'revenue', value: '$2.3M' }, 'Revenue Chart');
    el.setAttribute('aria-label', 'Revenue card');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    expect(ctx.toContextPacket({ source: { app: 'analytics' }, history: 1 })).toMatchObject({
      protocol: 'askable.context',
      version: '0.1',
      source: {
        app: 'analytics',
        timestamp: expect.any(String),
      },
      capture: {
        mode: 'element-focus',
        gesture: 'focus',
      },
      target: {
        text: 'Revenue Chart',
        label: 'Revenue card',
        metadata: { metric: 'revenue', value: '$2.3M' },
        selector: expect.any(String),
        bounds: {
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
        },
      },
      surrounding: {
        history: [
          expect.objectContaining({
            text: 'Revenue Chart',
            metadata: { metric: 'revenue', value: '$2.3M' },
          }),
        ],
      },
      privacy: {
        redacted: false,
        consent: 'implicit',
      },
      provenance: {
        producer: '@askable-ui/core',
        method: 'app',
      },
    });

    ctx.destroy();
    cleanup(el);
  });

  it('toContextPacket() includes privacy and viewport context when configured', () => {
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

    const first = makeEl({ widget: 'table', secret: 'remove' }, 'Table Secret');
    const ctx = createAskableContext({
      viewport: true,
      sanitizeMeta: ({ secret: _secret, ...safe }) => safe,
      sanitizeText: (text) => text.replace('Secret', '[redacted]'),
    });
    ctx.observe(document);

    const observer = MockIntersectionObserver.instances[0];
    observer.trigger([{ target: first, isIntersecting: true }]);
    first.click();

    const packet = ctx.toContextPacket({ includeViewport: true });
    expect(packet.privacy.redacted).toBe(true);
    expect(packet.target?.metadata).toEqual({ widget: 'table' });
    expect(packet.target?.text).toBe('Table [redacted]');
    expect(packet.surrounding?.visible?.[0]).toMatchObject({
      metadata: { widget: 'table' },
      text: 'Table [redacted]',
    });

    ctx.destroy();
    cleanup(first);
    globalThis.IntersectionObserver = originalIntersectionObserver;
  });

  it('serializeFocus() respects includeText and maxTextLength', () => {
    const el = makeEl({ metric: 'churn' }, 'ABCDEFGHIJ');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    expect((ctx as any).serializeFocus({ includeText: false })).toEqual({
      meta: { metric: 'churn' },
      timestamp: expect.any(Number),
    });

    expect((ctx as any).serializeFocus({ maxTextLength: 5 })).toEqual({
      meta: { metric: 'churn' },
      text: 'ABCDE',
      timestamp: expect.any(Number),
    });

    ctx.destroy();
    cleanup(el);
  });

  it('captures scope from data-askable-scope and filters prompt/history output by scope', () => {
    const analytics = makeEl({ metric: 'revenue' }, 'Revenue Chart');
    analytics.setAttribute('data-askable-scope', 'analytics');
    const form = makeEl({ field: 'email' }, 'Email input');
    form.setAttribute('data-askable-scope', 'form-helper');
    const unscoped = makeEl({ widget: 'global-help' }, 'Help tip');
    const ctx = createAskableContext();
    ctx.observe(document);

    analytics.click();
    form.click();
    unscoped.click();

    expect(ctx.getHistory().map((focus) => focus.scope)).toEqual([undefined, 'form-helper', 'analytics']);
    expect(ctx.toPromptContext({ scope: 'analytics' })).toContain('global-help');
    expect(ctx.toPromptContext({ scope: 'form-helper' })).toContain('global-help');
    expect(ctx.toHistoryContext(3, { scope: 'analytics' })).toContain('metric: revenue');
    expect(ctx.toHistoryContext(3, { scope: 'analytics' })).not.toContain('field: email');
    expect(ctx.toHistoryContext(3, { scope: 'form-helper' })).toContain('field: email');
    expect(ctx.toHistoryContext(3, { scope: 'form-helper' })).not.toContain('metric: revenue');

    ctx.destroy();
    cleanup(analytics);
    cleanup(form);
    cleanup(unscoped);
  });

  it('filters pushed focus/history by scope while keeping unscoped entries visible everywhere', () => {
    const ctx = createAskableContext();

    ctx.push({ metric: 'revenue' }, 'Revenue card', { scope: 'analytics' });
    ctx.push({ field: 'email' }, 'Email field', { scope: 'form-helper' });
    ctx.push({ widget: 'global-help' }, 'Help tip');

    expect(ctx.toPromptContext({ scope: 'analytics' })).toContain('global-help');
    expect(ctx.toPromptContext({ scope: 'form-helper' })).toContain('global-help');
    expect(ctx.toHistoryContext(3, { scope: 'analytics' })).toContain('metric: revenue');
    expect(ctx.toHistoryContext(3, { scope: 'analytics' })).not.toContain('field: email');
    expect(ctx.toHistoryContext(3, { scope: 'form-helper' })).toContain('field: email');
    expect(ctx.toHistoryContext(3, { scope: 'form-helper' })).not.toContain('metric: revenue');

    ctx.destroy();
  });

  it('includes ancestor chains from nested [data-askable] elements in prompt output', () => {
    const dashboard = makeEl({ view: 'dashboard' }, 'Dashboard');
    const finance = makeEl({ tab: 'finance' }, 'Finance');
    const revenue = makeEl({ metric: 'revenue', value: '$2.3M' }, 'Revenue card');
    dashboard.appendChild(finance);
    finance.appendChild(revenue);
    const ctx = createAskableContext();
    ctx.observe(document);

    revenue.click();

    expect(ctx.toPromptContext()).toContain('view: dashboard > tab: finance > metric: revenue, value: $2.3M');
    expect(ctx.toHistoryContext(1)).toContain('view: dashboard > tab: finance > metric: revenue, value: $2.3M');

    ctx.destroy();
    dashboard.remove();
  });

  it('supports explicit data-askable-parent links and hierarchy depth limits', () => {
    const dashboard = makeEl({ view: 'dashboard' }, 'Dashboard');
    dashboard.id = 'dashboard-root';
    const finance = makeEl({ tab: 'finance' }, 'Finance');
    finance.id = 'finance-tab';
    finance.setAttribute('data-askable-parent', '#dashboard-root');
    const revenue = makeEl({ metric: 'revenue', value: '$2.3M' }, 'Revenue card');
    revenue.setAttribute('data-askable-parent', '#finance-tab');
    const ctx = createAskableContext();
    ctx.observe(document);

    revenue.click();

    expect(ctx.toPromptContext()).toContain('view: dashboard > tab: finance > metric: revenue, value: $2.3M');
    expect(ctx.toPromptContext({ hierarchyDepth: 1 })).toContain('tab: finance > metric: revenue, value: $2.3M');
    expect(ctx.toPromptContext({ hierarchyDepth: 1 })).not.toContain('view: dashboard >');
    expect((ctx as any).serializeFocus({ hierarchyDepth: 1 })).toEqual({
      meta: { metric: 'revenue', value: '$2.3M' },
      ancestors: [
        { meta: { tab: 'finance' }, text: 'Finance' },
      ],
      text: 'Revenue card',
      timestamp: expect.any(Number),
    });

    ctx.destroy();
    dashboard.remove();
    finance.remove();
    revenue.remove();
  });

  it('serializes DOM hierarchy in JSON output and respects scope filtering for ancestors', () => {
    const dashboard = makeEl({ view: 'dashboard' }, 'Dashboard');
    dashboard.setAttribute('data-askable-scope', 'analytics');
    const finance = makeEl({ tab: 'finance' }, 'Finance');
    finance.setAttribute('data-askable-scope', 'analytics');
    const revenue = makeEl({ metric: 'revenue', value: '$2.3M' }, 'Revenue card');
    revenue.setAttribute('data-askable-scope', 'analytics');
    dashboard.appendChild(finance);
    finance.appendChild(revenue);
    const ctx = createAskableContext();
    ctx.observe(document);

    revenue.click();

    expect((ctx as any).serializeFocus()).toEqual({
      meta: { metric: 'revenue', value: '$2.3M' },
      scope: 'analytics',
      ancestors: [
        { meta: { view: 'dashboard' }, scope: 'analytics', text: 'DashboardFinanceRevenue card' },
        { meta: { tab: 'finance' }, scope: 'analytics', text: 'FinanceRevenue card' },
      ],
      text: 'Revenue card',
      timestamp: expect.any(Number),
    });
    expect(JSON.parse(ctx.toPromptContext({ format: 'json', hierarchyDepth: 1 }))).toEqual({
      meta: { metric: 'revenue', value: '$2.3M' },
      scope: 'analytics',
      ancestors: [
        { meta: { tab: 'finance' }, scope: 'analytics', text: 'FinanceRevenue card' },
      ],
      text: 'Revenue card',
      timestamp: expect.any(Number),
    });

    ctx.destroy();
    dashboard.remove();
  });

  it('serializes pushed ancestor chains and applies hierarchy depth limits', () => {
    const ctx = createAskableContext();

    ctx.push({ metric: 'revenue', value: '$2.3M' }, 'Revenue card', {
      scope: 'analytics',
      ancestors: [
        { meta: { view: 'dashboard' }, scope: 'analytics', text: 'Dashboard' },
        { meta: { tab: 'finance' }, scope: 'analytics', text: 'Finance' },
      ],
    });

    expect(ctx.toPromptContext()).toContain('view: dashboard > tab: finance > metric: revenue, value: $2.3M');
    expect(ctx.toPromptContext({ hierarchyDepth: 1 })).toContain('tab: finance > metric: revenue, value: $2.3M');
    expect((ctx as any).serializeFocus({ hierarchyDepth: 1 })).toEqual({
      meta: { metric: 'revenue', value: '$2.3M' },
      scope: 'analytics',
      ancestors: [
        { meta: { tab: 'finance' }, scope: 'analytics', text: 'Finance' },
      ],
      text: 'Revenue card',
      timestamp: expect.any(Number),
    });

    ctx.destroy();
  });

  it('serializeFocus() respects excludeKeys and keyOrder', () => {
    const el = makeEl({ z: 1, metric: 'churn', secret: 'x', value: '4.2%' }, 'Churn Rate');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    expect((ctx as any).serializeFocus({
      excludeKeys: ['secret'],
      keyOrder: ['metric', 'value'],
      includeText: false,
    })).toEqual({
      meta: { metric: 'churn', value: '4.2%', z: 1 },
      timestamp: expect.any(Number),
    });

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() returns the no-focus string when nothing is focused', () => {
    const ctx = createAskableContext();
    ctx.observe(document);
    expect(ctx.toPromptContext()).toBe('No UI element is currently focused.');
    ctx.destroy();
  });

  it('toPromptContext() returns a natural language string when focused', () => {
    const el = makeEl({ metric: 'churn', value: '4.2%' }, 'Churn Rate');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const prompt = ctx.toPromptContext();
    expect(prompt).toContain('User is focused on');
    expect(prompt).toContain('churn');
    expect(prompt).toContain('4.2%');

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() supports JSON output', () => {
    const el = makeEl({ metric: 'churn', value: '4.2%' }, 'Churn Rate');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const prompt = ctx.toPromptContext({ format: 'json' });
    expect(JSON.parse(prompt)).toEqual({
      meta: { metric: 'churn', value: '4.2%' },
      text: 'Churn Rate',
      timestamp: expect.any(Number),
    });

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() can omit text', () => {
    const el = makeEl({ metric: 'churn', value: '4.2%' }, 'Churn Rate');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const prompt = ctx.toPromptContext({ includeText: false });
    expect(prompt).toContain('metric: churn');
    expect(prompt).not.toContain('value "Churn Rate"');

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() can truncate text when requested', () => {
    const el = makeEl({ metric: 'churn' }, 'ABCDEFGHIJ');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const prompt = ctx.toPromptContext({ maxTextLength: 5 });
    expect(prompt).toContain('value "ABCDE"');

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() can exclude keys and order keys', () => {
    const el = makeEl({ z: 1, metric: 'churn', secret: 'x', value: '4.2%' }, 'Churn Rate');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const prompt = ctx.toPromptContext({
      excludeKeys: ['secret'],
      keyOrder: ['metric', 'value'],
      includeText: false,
    });
    expect(prompt).toContain('metric: churn, value: 4.2%, z: 1');
    expect(prompt).not.toContain('secret');

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() returns null in JSON mode when nothing is focused', () => {
    const ctx = createAskableContext();
    ctx.observe(document);
    expect(ctx.toPromptContext({ format: 'json' })).toBe('null');
    ctx.destroy();
  });

  it('on("focus") calls the handler when focus changes', () => {
    const el = makeEl({ action: 'delete' }, 'Delete');
    const ctx = createAskableContext();
    ctx.observe(document);

    const handler = vi.fn();
    ctx.on('focus', handler);
    el.click();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].meta).toEqual({ action: 'delete' });

    ctx.destroy();
    cleanup(el);
  });

  it('off("focus") stops the handler from being called', () => {
    const el = makeEl({ action: 'save' }, 'Save');
    const ctx = createAskableContext();
    ctx.observe(document);

    const handler = vi.fn();
    ctx.on('focus', handler);
    el.click();
    expect(handler).toHaveBeenCalledOnce();

    ctx.off('focus', handler);
    el.click();
    expect(handler).toHaveBeenCalledOnce();

    ctx.destroy();
    cleanup(el);
  });

  it('destroy() removes all listeners and resets focus', () => {
    const el = makeEl({ section: 'header' }, 'Header');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();
    expect(ctx.getFocus()).not.toBeNull();

    const handler = vi.fn();
    ctx.on('focus', handler);
    ctx.destroy();

    el.click();
    expect(handler).not.toHaveBeenCalled();
    expect(ctx.getFocus()).toBeNull();

    cleanup(el);
  });

  it('getHistory() returns focuses in newest-first order', () => {
    const el1 = makeEl({ id: 'a' }, 'A');
    const el2 = makeEl({ id: 'b' }, 'B');
    const el3 = makeEl({ id: 'c' }, 'C');
    const ctx = createAskableContext();
    ctx.observe(document);

    el1.click();
    el2.click();
    el3.click();

    const history = ctx.getHistory();
    expect(history).toHaveLength(3);
    expect((history[0].meta as Record<string, unknown>).id).toBe('c');
    expect((history[1].meta as Record<string, unknown>).id).toBe('b');
    expect((history[2].meta as Record<string, unknown>).id).toBe('a');

    ctx.destroy();
    cleanup(el1);
    cleanup(el2);
    cleanup(el3);
  });

  it('getHistory() respects the limit argument', () => {
    const el1 = makeEl({ id: 'a' }, 'A');
    const el2 = makeEl({ id: 'b' }, 'B');
    const el3 = makeEl({ id: 'c' }, 'C');
    const ctx = createAskableContext();
    ctx.observe(document);

    el1.click();
    el2.click();
    el3.click();

    const history = ctx.getHistory(2);
    expect(history).toHaveLength(2);
    expect((history[0].meta as Record<string, unknown>).id).toBe('c');

    ctx.destroy();
    cleanup(el1);
    cleanup(el2);
    cleanup(el3);
  });

  it('maxHistory option caps the history buffer', () => {
    const els = [makeEl({ id: 'a' }), makeEl({ id: 'b' }), makeEl({ id: 'c' }), makeEl({ id: 'd' })];
    const ctx = createAskableContext({ maxHistory: 2 });
    ctx.observe(document);
    els.forEach(el => el.click());
    const history = ctx.getHistory();
    expect(history).toHaveLength(2);
    expect((history[0].meta as Record<string, unknown>).id).toBe('d');
    expect((history[1].meta as Record<string, unknown>).id).toBe('c');
    ctx.destroy();
    els.forEach(cleanup);
  });

  it('maxHistory: 0 disables history entirely', () => {
    const el = makeEl({ id: 'x' });
    const ctx = createAskableContext({ maxHistory: 0 });
    ctx.observe(document);
    el.click();
    expect(ctx.getHistory()).toHaveLength(0);
    ctx.destroy();
    cleanup(el);
  });

  it('clear() resets focus to null and emits clear event', () => {
    const el = makeEl({ widget: 'chart' }, 'Chart');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();
    expect(ctx.getFocus()).not.toBeNull();

    const clearHandler = vi.fn();
    ctx.on('clear', clearHandler);
    ctx.clear();

    expect(ctx.getFocus()).toBeNull();
    expect(clearHandler).toHaveBeenCalledOnce();
    expect(clearHandler.mock.calls[0][0]).toBeNull();

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() truncates output when maxTokens is exceeded', () => {
    // meta value long enough to exceed a small token budget
    const longMeta = { description: 'A'.repeat(200) };
    const el = makeEl(longMeta, '');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const prompt = ctx.toPromptContext({ maxTokens: 10 });
    expect(prompt).toContain('[truncated]');
    expect(prompt.length).toBeLessThanOrEqual(10 * 4);

    ctx.destroy();
    cleanup(el);
  });

  it('toPromptContext() does not truncate when output fits within maxTokens', () => {
    const el = makeEl({ x: 1 }, 'short');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const full = ctx.toPromptContext();
    const prompt = ctx.toPromptContext({ maxTokens: 1000 });
    expect(prompt).toBe(full);

    ctx.destroy();
    cleanup(el);
  });

  it('toHistoryContext() returns no-history string when empty', () => {
    const ctx = createAskableContext();
    ctx.observe(document);
    expect(ctx.toHistoryContext()).toBe('No interaction history.');
    ctx.destroy();
  });

  it('toHistoryContext() serializes history newest-first with numbered entries', () => {
    const el1 = makeEl({ id: 'a' }, 'A');
    const el2 = makeEl({ id: 'b' }, 'B');
    const ctx = createAskableContext();
    ctx.observe(document);

    el1.click();
    el2.click();

    const history = ctx.toHistoryContext();
    const lines = history.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\[1\]/);
    expect(lines[0]).toContain('id: b');
    expect(lines[1]).toMatch(/^\[2\]/);
    expect(lines[1]).toContain('id: a');

    ctx.destroy();
    cleanup(el1);
    cleanup(el2);
  });

  it('toHistoryContext() respects limit', () => {
    const el1 = makeEl({ id: 'a' }, 'A');
    const el2 = makeEl({ id: 'b' }, 'B');
    const el3 = makeEl({ id: 'c' }, 'C');
    const ctx = createAskableContext();
    ctx.observe(document);

    el1.click();
    el2.click();
    el3.click();

    const history = ctx.toHistoryContext(2);
    const lines = history.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('id: c');

    ctx.destroy();
    cleanup(el1);
    cleanup(el2);
    cleanup(el3);
  });

  it('toHistoryContext() respects serialization options', () => {
    const el = makeEl({ metric: 'mrr', secret: 'x' }, 'MRR');
    const ctx = createAskableContext();
    ctx.observe(document);

    el.click();

    const history = ctx.toHistoryContext(undefined, { excludeKeys: ['secret'], includeText: false });
    expect(history).toContain('mrr');
    expect(history).not.toContain('secret');
    expect(history).not.toContain('MRR');

    ctx.destroy();
    cleanup(el);
  });

  it('toHistoryContext() truncates when maxTokens exceeded', () => {
    const el1 = makeEl({ id: 'a', description: 'A'.repeat(100) }, 'A');
    const el2 = makeEl({ id: 'b', description: 'B'.repeat(100) }, 'B');
    const ctx = createAskableContext();
    ctx.observe(document);

    el1.click();
    el2.click();

    const history = ctx.toHistoryContext(undefined, { maxTokens: 10 });
    expect(history).toContain('[truncated]');
    expect(history.length).toBeLessThanOrEqual(10 * 4);

    ctx.destroy();
    cleanup(el1);
    cleanup(el2);
  });

  describe('preset option', () => {
    it('compact preset omits text and uses natural format', () => {
      const el = makeEl({ metric: 'churn', value: '4.2%' }, 'Churn Rate');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const prompt = ctx.toPromptContext({ preset: 'compact' });
      expect(prompt).toContain('User is focused on');
      expect(prompt).toContain('metric: churn');
      expect(prompt).not.toContain('Churn Rate');

      ctx.destroy();
      cleanup(el);
    });

    it('verbose preset includes text and uses natural format', () => {
      const el = makeEl({ metric: 'churn' }, 'Churn Rate');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const prompt = ctx.toPromptContext({ preset: 'verbose' });
      expect(prompt).toContain('User is focused on');
      expect(prompt).toContain('Churn Rate');

      ctx.destroy();
      cleanup(el);
    });

    it('json preset returns JSON with text', () => {
      const el = makeEl({ metric: 'churn' }, 'Churn Rate');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const prompt = ctx.toPromptContext({ preset: 'json' });
      const parsed = JSON.parse(prompt);
      expect(parsed.meta).toEqual({ metric: 'churn' });
      expect(parsed.text).toBe('Churn Rate');

      ctx.destroy();
      cleanup(el);
    });

    it('individual options override the preset', () => {
      const el = makeEl({ metric: 'churn' }, 'Churn Rate');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      // compact sets includeText: false, but we override it to true
      const prompt = ctx.toPromptContext({ preset: 'compact', includeText: true });
      expect(prompt).toContain('Churn Rate');

      ctx.destroy();
      cleanup(el);
    });

    it('serializeFocus() respects preset', () => {
      const el = makeEl({ metric: 'churn' }, 'Churn Rate');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const serialized = (ctx as any).serializeFocus({ preset: 'compact' });
      expect(serialized.text).toBeUndefined();

      ctx.destroy();
      cleanup(el);
    });

    it('toHistoryContext() respects preset', () => {
      const el = makeEl({ metric: 'mrr' }, 'MRR');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const history = ctx.toHistoryContext(undefined, { preset: 'compact' });
      expect(history).toContain('mrr');
      expect(history).not.toContain('MRR');

      ctx.destroy();
      cleanup(el);
    });
  });

  describe('textExtractor option', () => {
    it('uses custom text extractor when provided', () => {
      const el = makeEl({ metric: 'revenue' }, 'Original text');
      el.setAttribute('aria-label', 'Custom label');
      const ctx = createAskableContext({
        textExtractor: (e) => e.getAttribute('aria-label') ?? e.textContent?.trim() ?? '',
      });
      ctx.observe(document);
      el.click();

      const focus = ctx.getFocus();
      expect(focus?.text).toBe('Custom label');

      ctx.destroy();
      cleanup(el);
    });

    it('uses default text extraction when no extractor provided', () => {
      const el = makeEl({ metric: 'revenue' }, 'Default text');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const focus = ctx.getFocus();
      expect(focus?.text).toBe('Default text');

      ctx.destroy();
      cleanup(el);
    });

    it('select() uses custom text extractor', () => {
      const el = makeEl({ metric: 'revenue' }, 'Original text');
      el.setAttribute('aria-label', 'Select label');
      const ctx = createAskableContext({
        textExtractor: (e) => e.getAttribute('aria-label') ?? '',
      });

      ctx.select(el);

      const focus = ctx.getFocus();
      expect(focus?.text).toBe('Select label');

      ctx.destroy();
      cleanup(el);
    });
  });

  describe('data-askable-text element-level override', () => {
    it('uses data-askable-text instead of textContent', () => {
      const el = makeEl({ metric: 'revenue' }, 'Raw text content');
      el.setAttribute('data-askable-text', 'Custom override');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      expect(ctx.getFocus()?.text).toBe('Custom override');
      ctx.destroy();
      cleanup(el);
    });

    it('empty data-askable-text suppresses text', () => {
      const el = makeEl({ metric: 'revenue' }, 'Sensitive content');
      el.setAttribute('data-askable-text', '');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      expect(ctx.getFocus()?.text).toBe('');
      ctx.destroy();
      cleanup(el);
    });

    it('data-askable-text takes priority over textExtractor', () => {
      const el = makeEl({ metric: 'revenue' }, 'Original');
      el.setAttribute('aria-label', 'ARIA label');
      el.setAttribute('data-askable-text', 'Element override');
      const ctx = createAskableContext({
        textExtractor: (e) => e.getAttribute('aria-label') ?? '',
      });
      ctx.observe(document);
      el.click();

      expect(ctx.getFocus()?.text).toBe('Element override');
      ctx.destroy();
      cleanup(el);
    });

    it('select() respects data-askable-text', () => {
      const el = makeEl({ metric: 'revenue' }, 'Original');
      el.setAttribute('data-askable-text', 'Selected override');
      const ctx = createAskableContext();
      ctx.select(el);

      expect(ctx.getFocus()?.text).toBe('Selected override');
      ctx.destroy();
      cleanup(el);
    });
  });

  describe('sanitizeMeta and sanitizeText options', () => {
    it('sanitizeMeta strips sensitive fields from object meta', () => {
      const el = makeEl({ metric: 'revenue', password: 'secret', value: '$2M' }, 'Revenue');
      const ctx = createAskableContext({
        sanitizeMeta: ({ password, ...safe }) => safe,
      });
      ctx.observe(document);
      el.click();

      const focus = ctx.getFocus();
      expect((focus!.meta as Record<string, unknown>).password).toBeUndefined();
      expect((focus!.meta as Record<string, unknown>).metric).toBe('revenue');

      ctx.destroy();
      cleanup(el);
    });

    it('sanitizeMeta is reflected in toPromptContext()', () => {
      const el = makeEl({ metric: 'revenue', password: 'secret' }, 'Revenue');
      const ctx = createAskableContext({
        sanitizeMeta: ({ password, ...safe }) => safe,
      });
      ctx.observe(document);
      el.click();

      const prompt = ctx.toPromptContext();
      expect(prompt).not.toContain('password');
      expect(prompt).not.toContain('secret');

      ctx.destroy();
      cleanup(el);
    });

    it('sanitizeMeta does not apply to string meta', () => {
      const el = makeEl('plain string meta', 'Text');
      const sanitize = vi.fn((m: Record<string, unknown>) => m);
      const ctx = createAskableContext({ sanitizeMeta: sanitize });
      ctx.observe(document);
      el.click();

      expect(sanitize).not.toHaveBeenCalled();
      expect(ctx.getFocus()!.meta).toBe('plain string meta');

      ctx.destroy();
      cleanup(el);
    });

    it('sanitizeText masks text content', () => {
      const el = makeEl({ item: 'card' }, '4111 1111 1111 1111');
      const ctx = createAskableContext({
        sanitizeText: (text) => text.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[card]'),
      });
      ctx.observe(document);
      el.click();

      expect(ctx.getFocus()!.text).toBe('[card]');

      ctx.destroy();
      cleanup(el);
    });

    it('sanitizers apply to select() as well', () => {
      const el = makeEl({ metric: 'revenue', secret: 'x' }, 'Raw text');
      const ctx = createAskableContext({
        sanitizeMeta: ({ secret, ...safe }) => safe,
        sanitizeText: (t) => t.toUpperCase(),
      });

      ctx.select(el);

      const focus = ctx.getFocus();
      expect((focus!.meta as Record<string, unknown>).secret).toBeUndefined();
      expect(focus!.text).toBe('RAW TEXT');

      ctx.destroy();
      cleanup(el);
    });

    it('sanitized data is reflected in history and events', () => {
      const el = makeEl({ metric: 'revenue', pin: '1234' }, 'Text');
      const ctx = createAskableContext({
        sanitizeMeta: ({ pin, ...safe }) => safe,
      });
      ctx.observe(document);

      const handler = vi.fn();
      ctx.on('focus', handler);
      el.click();

      expect((handler.mock.calls[0][0].meta as Record<string, unknown>).pin).toBeUndefined();
      expect((ctx.getHistory()[0].meta as Record<string, unknown>).pin).toBeUndefined();

      ctx.destroy();
      cleanup(el);
    });
  });

  describe('source field', () => {
    it('DOM interactions set source to "dom"', () => {
      const el = makeEl({ id: 'test' }, 'Test');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      expect(ctx.getFocus()!.source).toBe('dom');

      ctx.destroy();
      cleanup(el);
    });

    it('select() sets source to "select"', () => {
      const el = makeEl({ id: 'test' }, 'Test');
      const ctx = createAskableContext();
      ctx.select(el);

      expect(ctx.getFocus()!.source).toBe('select');

      ctx.destroy();
      cleanup(el);
    });

    it('push() sets source to "push"', () => {
      const ctx = createAskableContext();
      ctx.push({ widget: 'chart' }, 'Revenue');

      expect(ctx.getFocus()!.source).toBe('push');

      ctx.destroy();
    });
  });

  describe('push() method', () => {
    it('sets focus with meta object and text', () => {
      const ctx = createAskableContext();
      ctx.push({ widget: 'deals-table', rowIndex: 3 }, 'Acme Corp');

      const focus = ctx.getFocus();
      expect(focus).not.toBeNull();
      expect(focus!.meta).toEqual({ widget: 'deals-table', rowIndex: 3 });
      expect(focus!.text).toBe('Acme Corp');
      expect(focus!.element).toBeUndefined();
      expect(typeof focus!.timestamp).toBe('number');

      ctx.destroy();
    });

    it('sets focus with string meta', () => {
      const ctx = createAskableContext();
      ctx.push('plain-string-meta');

      expect(ctx.getFocus()!.meta).toBe('plain-string-meta');
      expect(ctx.getFocus()!.text).toBe('');

      ctx.destroy();
    });

    it('emits a focus event', () => {
      const ctx = createAskableContext();
      const handler = vi.fn();
      ctx.on('focus', handler);

      ctx.push({ id: 'row-5' }, 'Row data');

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].meta).toEqual({ id: 'row-5' });
      expect(handler.mock.calls[0][0].source).toBe('push');

      ctx.destroy();
    });

    it('adds entries to history', () => {
      const ctx = createAskableContext();
      ctx.push({ id: 'a' }, 'A');
      ctx.push({ id: 'b' }, 'B');

      const history = ctx.getHistory();
      expect(history).toHaveLength(2);
      expect((history[0].meta as Record<string, unknown>).id).toBe('b');
      expect((history[1].meta as Record<string, unknown>).id).toBe('a');

      ctx.destroy();
    });

    it('respects maxHistory', () => {
      const ctx = createAskableContext({ maxHistory: 2 });
      ctx.push({ id: 'a' });
      ctx.push({ id: 'b' });
      ctx.push({ id: 'c' });

      const history = ctx.getHistory();
      expect(history).toHaveLength(2);
      expect((history[0].meta as Record<string, unknown>).id).toBe('c');

      ctx.destroy();
    });

    it('toPromptContext() works with push()-set focus', () => {
      const ctx = createAskableContext();
      ctx.push({ metric: 'revenue' }, '$2.3M');

      const prompt = ctx.toPromptContext();
      expect(prompt).toContain('User is focused on');
      expect(prompt).toContain('revenue');
      expect(prompt).toContain('$2.3M');

      ctx.destroy();
    });

    it('sanitizeMeta and sanitizeText apply to push()', () => {
      const ctx = createAskableContext({
        sanitizeMeta: ({ secret, ...safe }) => safe,
        sanitizeText: (t) => t.toUpperCase(),
      });

      ctx.push({ widget: 'table', secret: 'x' }, 'hello');

      const focus = ctx.getFocus();
      expect((focus!.meta as Record<string, unknown>).secret).toBeUndefined();
      expect(focus!.text).toBe('HELLO');

      ctx.destroy();
    });
  });

  describe('context sources', () => {
    it('registers and resolves app-owned source context', async () => {
      const ctx = createAskableContext();
      const handle = ctx.registerSource('accounts', {
        kind: 'collection',
        describe: 'Customer accounts',
        getState: () => ({ page: 2, pageSize: 25, totalCount: 80 }),
        resolve: ({ mode, maxItems }) => ({
          mode,
          rows: [{ company: 'Acme Corp', mrr: '$8,400' }].slice(0, maxItems),
          summary: { atRisk: 4 },
        }),
      });

      const resolved = await ctx.resolveSource('accounts', { mode: 'visible', maxItems: 1 });

      expect(handle.id).toBe('accounts');
      expect(resolved).toEqual({
        id: 'accounts',
        kind: 'collection',
        description: 'Customer accounts',
        mode: 'visible',
        state: { page: 2, pageSize: 25, totalCount: 80 },
        data: {
          mode: 'visible',
          rows: [{ company: 'Acme Corp', mrr: '$8,400' }],
          summary: { atRisk: 4 },
        },
      });

      ctx.destroy();
    });

    it('includes selected sources in async prompt context', async () => {
      const ctx = createAskableContext();
      ctx.push({ widget: 'accounts-table' }, 'Accounts');
      ctx.registerSource('accounts', {
        kind: 'collection',
        getState: () => ({ filter: 'at_risk' }),
        resolve: ({ focus, mode }) => ({
          mode,
          focusedWidget: typeof focus?.meta === 'object' ? focus.meta.widget : undefined,
          totalMatching: 12,
        }),
      });

      const prompt = await ctx.toPromptContextAsync({
        sources: [{ id: 'accounts', mode: 'summary' }],
      });

      expect(prompt).toContain('User is focused on');
      expect(prompt).toContain('Context sources');
      expect(prompt).toContain('accounts');
      expect(prompt).toContain('"filter":"at_risk"');
      expect(prompt).toContain('"focusedWidget":"accounts-table"');

      ctx.destroy();
    });

    it('includes all registered sources when requested', async () => {
      const ctx = createAskableContext();
      ctx.registerSource('accounts', { resolve: () => ({ count: 2 }) });
      ctx.registerSource('calendar', { resolve: () => ({ events: 3 }) });

      const prompt = await ctx.toPromptContextAsync({ sources: 'all' });

      expect(prompt).toContain('accounts');
      expect(prompt).toContain('calendar');
      expect(prompt).toContain('"count":2');
      expect(prompt).toContain('"events":3');

      ctx.destroy();
    });

    it('lists registered sources without resolving source data', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
      const ctx = createAskableContext();
      const resolve = vi.fn(() => ({ count: 2 }));

      ctx.registerSource('accounts', { kind: 'collection', resolve });

      expect(ctx.hasSource(' accounts ')).toBe(true);
      expect(ctx.hasSource('calendar')).toBe(false);
      expect(ctx.listSources()).toEqual([{
        id: 'accounts',
        kind: 'collection',
        registeredAt: Date.parse('2026-06-01T12:00:00Z'),
        updatedAt: Date.parse('2026-06-01T12:00:00Z'),
      }]);
      expect(resolve).not.toHaveBeenCalled();

      vi.setSystemTime(new Date('2026-06-01T12:00:02Z'));
      ctx.notifySourceChanged('accounts');

      expect(ctx.listSources()[0]).toEqual({
        id: 'accounts',
        kind: 'collection',
        registeredAt: Date.parse('2026-06-01T12:00:00Z'),
        updatedAt: Date.parse('2026-06-01T12:00:02Z'),
      });

      ctx.destroy();
    });

    it('wraps focus and sources in JSON async prompt context', async () => {
      const ctx = createAskableContext();
      ctx.push({ widget: 'chart' }, 'Revenue');
      ctx.registerSource('chart-data', {
        kind: 'chart',
        resolve: () => ({ series: ['MRR'], points: 12 }),
      });

      const prompt = await ctx.toPromptContextAsync({
        format: 'json',
        sources: ['chart-data'],
      });
      const parsed = JSON.parse(prompt);

      expect(parsed.focus.meta).toEqual({ widget: 'chart' });
      expect(parsed.sources[0]).toEqual({
        id: 'chart-data',
        kind: 'chart',
        mode: 'summary',
        data: { series: ['MRR'], points: 12 },
      });

      ctx.destroy();
    });

    it('includes sources in async Context packets', async () => {
      const ctx = createAskableContext();
      ctx.push({ widget: 'accounts-table' }, 'Accounts');
      ctx.registerSource('accounts', {
        kind: 'collection',
        describe: 'Accounts matching active filters',
        getState: () => ({ filter: 'at_risk' }),
        resolve: ({ mode }) => ({ mode, totalMatching: 12 }),
      });

      const packet = await ctx.toContextPacketAsync({
        sources: [{ id: 'accounts', mode: 'summary' }],
        history: 1,
      });

      expect(packet.capture.mode).toBe('semantic');
      expect(packet.target?.metadata).toEqual({ widget: 'accounts-table' });
      expect(packet.surrounding?.sources?.[0]).toEqual({
        label: 'accounts',
        role: 'collection',
        text: 'Accounts matching active filters',
        metadata: {
          id: 'accounts',
          mode: 'summary',
          state: { filter: 'at_risk' },
          data: { mode: 'summary', totalMatching: 12 },
        },
      });

      ctx.destroy();
    });

    it('includes safe source errors in async Context packets by default', async () => {
      const ctx = createAskableContext();
      ctx.registerSource('accounts', {
        resolve: () => {
          throw new Error('api key leaked');
        },
      });

      const packet = await ctx.toContextPacketAsync({ sources: ['accounts'] });

      expect(packet.surrounding?.sources?.[0]).toEqual({
        label: 'accounts',
        metadata: {
          id: 'accounts',
          mode: 'summary',
          error: { message: 'Context source unavailable.' },
        },
      });
      expect(JSON.stringify(packet)).not.toContain('api key leaked');

      ctx.destroy();
    });

    it('unregisters sources', async () => {
      const ctx = createAskableContext();
      const handle = ctx.registerSource('accounts', { resolve: () => ({ count: 1 }) });

      handle.unregister();

      await expect(ctx.resolveSource('accounts')).rejects.toThrow('not registered');
      expect(ctx.unregisterSource('accounts')).toBe(false);

      ctx.destroy();
    });

    it('does not let stale source handles unregister replacement sources', async () => {
      const ctx = createAskableContext();
      const first = ctx.registerSource('accounts', { resolve: () => ({ version: 1 }) });
      const second = ctx.registerSource('accounts', { resolve: () => ({ version: 2 }) });

      first.unregister();

      await expect(ctx.resolveSource('accounts')).resolves.toMatchObject({
        data: { version: 2 },
      });

      second.unregister();

      await expect(ctx.resolveSource('accounts')).rejects.toThrow('not registered');

      ctx.destroy();
    });

    it('ignores stale source handle notifications after replacement', () => {
      const ctx = createAskableContext();
      const changedIds: string[] = [];
      ctx.on('sourcechange', (change) => {
        changedIds.push(change.id ?? '*');
      });
      const first = ctx.registerSource('accounts', { resolve: () => ({ version: 1 }) });
      changedIds.length = 0;
      ctx.registerSource('accounts', { resolve: () => ({ version: 2 }) });
      changedIds.length = 0;

      first.notifyChanged();

      expect(changedIds).toEqual([]);

      ctx.notifySourceChanged('accounts');

      expect(changedIds).toEqual(['accounts']);

      ctx.destroy();
    });

    it('still allows app-level unregister by source id', async () => {
      const ctx = createAskableContext();
      const handle = ctx.registerSource('accounts', { resolve: () => ({ count: 1 }) });

      expect(ctx.unregisterSource('accounts')).toBe(true);
      handle.notifyChanged();

      await expect(ctx.resolveSource('accounts')).rejects.toThrow('not registered');

      ctx.destroy();
    });

    it('applies source-level and context-level sanitizers', async () => {
      const ctx = createAskableContext({
        sanitizeSource: (source) => ({
          ...source,
          state: { safeState: true },
        }),
      });
      ctx.registerSource('accounts', {
        getState: () => ({ token: 'secret-token' }),
        resolve: () => ({ rows: [{ company: 'Acme', ssn: '123-45-6789' }] }),
        sanitize: (source) => ({
          ...source,
          data: { rows: [{ company: 'Acme' }] },
        }),
      });

      const resolved = await ctx.resolveSource('accounts');

      expect(resolved.state).toEqual({ safeState: true });
      expect(resolved.data).toEqual({ rows: [{ company: 'Acme' }] });
      expect(JSON.stringify(resolved)).not.toContain('secret-token');
      expect(JSON.stringify(resolved)).not.toContain('123-45-6789');

      ctx.destroy();
    });

    it('includes a safe source error by default during async prompt serialization', async () => {
      const ctx = createAskableContext();
      ctx.registerSource('accounts', {
        resolve: () => {
          throw new Error('database password leaked');
        },
      });

      const prompt = await ctx.toPromptContextAsync({ sources: ['accounts'] });

      expect(prompt).toContain('accounts');
      expect(prompt).toContain('Context source unavailable.');
      expect(prompt).not.toContain('database password leaked');

      ctx.destroy();
    });

    it('can omit failed sources during async prompt serialization', async () => {
      const ctx = createAskableContext();
      ctx.registerSource('accounts', {
        resolve: () => {
          throw new Error('failed');
        },
      });

      const prompt = await ctx.toPromptContextAsync({
        sources: ['accounts'],
        sourceErrorMode: 'omit',
      });

      expect(prompt).not.toContain('Context sources');
      expect(prompt).not.toContain('accounts');

      ctx.destroy();
    });

    it('can throw failed sources during async prompt serialization', async () => {
      const ctx = createAskableContext();
      ctx.registerSource('accounts', {
        resolve: () => {
          throw new Error('failed');
        },
      });

      await expect(ctx.toPromptContextAsync({
        sources: ['accounts'],
        sourceErrorMode: 'throw',
      })).rejects.toThrow('failed');

      ctx.destroy();
    });

    it('times out slow source requests', async () => {
      const ctx = createAskableContext();
      ctx.registerSource('accounts', {
        resolve: () => new Promise(() => undefined),
      });

      const prompt = await ctx.toPromptContextAsync({
        sources: [{ id: 'accounts', timeoutMs: 0 }],
      });

      expect(prompt).toContain('accounts');
      expect(prompt).toContain('Context source unavailable.');

      ctx.destroy();
    });
  });

  describe('toContext() combined method', () => {
    it('returns current focus with label when history is 0', () => {
      const el = makeEl({ metric: 'revenue' }, '$2.3M');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const output = ctx.toContext();
      expect(output).toMatch(/^Current:/);
      expect(output).toContain('revenue');
      expect(output).not.toContain('Recent interactions');

      ctx.destroy();
      cleanup(el);
    });

    it('includes history section when history > 0', () => {
      const el1 = makeEl({ id: 'a' }, 'A');
      const el2 = makeEl({ id: 'b' }, 'B');
      const ctx = createAskableContext();
      ctx.observe(document);
      el1.click();
      el2.click();

      const output = ctx.toContext({ history: 5 });
      expect(output).toContain('Current:');
      expect(output).toContain('Recent interactions:');
      expect(output).toContain('[1]');
      expect(output).toContain('[2]');

      ctx.destroy();
      cleanup(el1);
      cleanup(el2);
    });

    it('respects custom labels', () => {
      const el = makeEl({ id: 'a' }, 'A');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      ctx.push({ id: 'b' }, 'B');

      const output = ctx.toContext({
        history: 5,
        currentLabel: 'Now',
        historyLabel: 'Before',
      });
      expect(output).toMatch(/^Now:/);
      expect(output).toContain('Before:');

      ctx.destroy();
      cleanup(el);
    });

    it('matches toPromptContext() when no history requested', () => {
      const el = makeEl({ metric: 'churn' }, 'Churn Rate');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const toContextOutput = ctx.toContext();
      const promptOutput = ctx.toPromptContext();
      // toContext wraps with "Current: " prefix
      expect(toContextOutput).toBe(`Current: ${promptOutput}`);

      ctx.destroy();
      cleanup(el);
    });

    it('respects maxTokens', () => {
      const ctx = createAskableContext();
      ctx.push({ description: 'A'.repeat(200) });

      const output = ctx.toContext({ maxTokens: 10 });
      expect(output).toContain('[truncated]');
      expect(output.length).toBeLessThanOrEqual(40);

      ctx.destroy();
    });

    it('passes prompt options through to serialization', () => {
      const el = makeEl({ metric: 'churn', secret: 'x' }, 'Churn');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const output = ctx.toContext({ excludeKeys: ['secret'], includeText: false });
      expect(output).toContain('churn');
      expect(output).not.toContain('secret');
      expect(output).not.toContain('Churn');

      ctx.destroy();
      cleanup(el);
    });
  });

  it('observe() is a no-op when called outside a browser environment', () => {
    const win = globalThis.window;
    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true });

    const ctx = createAskableContext();
    expect(() => ctx.observe(document)).not.toThrow();
    expect(ctx.getFocus()).toBeNull();

    Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
    ctx.destroy();
  });

  describe('toAgentRequest() edge cases', () => {
    it('returns valid request with null focus when nothing is focused', async () => {
      const ctx = createAskableContext();
      const request = await ctx.toAgentRequest('What can I do?');
      expect(request.question).toBe('What can I do?');
      expect(request.focus).toBeNull();
      expect(request.context).toContain('No UI element');
      ctx.destroy();
    });

    it('returns packet without target when packet:true and no focus', async () => {
      const ctx = createAskableContext();
      const request = await ctx.toAgentRequest('Describe the page', { packet: true });
      expect(request.packet).toBeDefined();
      expect(request.packet?.target).toBeUndefined();
      ctx.destroy();
    });

    it('preserves requestId verbatim', async () => {
      const ctx = createAskableContext();
      const request = await ctx.toAgentRequest('Test', { requestId: 'custom-req-456' });
      expect(request.requestId).toBe('custom-req-456');
      ctx.destroy();
    });

    it('timestamp is a Unix millisecond epoch close to Date.now()', async () => {
      const ctx = createAskableContext();
      const before = Date.now();
      const request = await ctx.toAgentRequest('Test');
      const after = Date.now();
      expect(request.timestamp).toBeGreaterThanOrEqual(before);
      expect(request.timestamp).toBeLessThanOrEqual(after);
      ctx.destroy();
    });

    it('excludeKeys filters nested metadata keys in focus meta', async () => {
      const el = makeEl({ widget: 'table', secret: 'sensitive' }, 'Table');
      const ctx = createAskableContext();
      ctx.observe(document);
      el.click();

      const request = await ctx.toAgentRequest('Describe this', { excludeKeys: ['secret'] });
      expect(request.focus?.meta).toEqual({ widget: 'table' });
      expect(request.context).not.toContain('sensitive');

      ctx.destroy();
      cleanup(el);
    });

    it('returns context without sources section when no sources registered', async () => {
      const ctx = createAskableContext();
      ctx.push({ widget: 'empty' }, 'Empty panel');
      const request = await ctx.toAgentRequest('What is here?', { sources: 'all' });
      expect(request.context).not.toContain('Context sources');
      ctx.destroy();
    });
  });

  describe('toViewportContext() edge cases', () => {
    it('returns fallback string when no elements are visible', () => {
      const originalIO = globalThis.IntersectionObserver;
      globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

      const ctx = createAskableContext({ viewport: true });
      ctx.observe(document);
      expect((ctx as any).toViewportContext()).toBe('No annotated UI elements are currently visible.');

      ctx.destroy();
      globalThis.IntersectionObserver = originalIO;
    });

    it('returns empty JSON array when no elements visible and format is json', () => {
      const originalIO = globalThis.IntersectionObserver;
      globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

      const ctx = createAskableContext({ viewport: true });
      ctx.observe(document);
      expect((ctx as any).toViewportContext({ format: 'json' })).toBe('[]');

      ctx.destroy();
      globalThis.IntersectionObserver = originalIO;
    });

    it('returns a JSON array of visible elements when format is json', () => {
      const originalIO = globalThis.IntersectionObserver;
      globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

      const el = makeEl({ widget: 'chart' }, 'Revenue chart');
      const ctx = createAskableContext({ viewport: true });
      ctx.observe(document);

      const observer = MockIntersectionObserver.instances[0];
      observer.trigger([{ target: el, isIntersecting: true }]);

      const result = (ctx as any).toViewportContext({ format: 'json' });
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toMatchObject({ meta: { widget: 'chart' } });

      ctx.destroy();
      cleanup(el);
      globalThis.IntersectionObserver = originalIO;
    });

    it('filters visible elements by scope', () => {
      const originalIO = globalThis.IntersectionObserver;
      globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

      const inScope = makeEl({ widget: 'table' }, 'Table');
      inScope.setAttribute('data-askable-scope', 'dashboard');
      const outScope = makeEl({ widget: 'nav' }, 'Nav');
      outScope.setAttribute('data-askable-scope', 'header');
      const ctx = createAskableContext({ viewport: true });
      ctx.observe(document);

      const observer = MockIntersectionObserver.instances[0];
      observer.trigger([
        { target: inScope, isIntersecting: true },
        { target: outScope, isIntersecting: true },
      ]);

      const result = (ctx as any).toViewportContext({ scope: 'dashboard' });
      expect(result).toContain('table');
      expect(result).not.toContain('nav');

      ctx.destroy();
      cleanup(inScope);
      cleanup(outScope);
      globalThis.IntersectionObserver = originalIO;
    });

    it('removes elements that become non-intersecting', () => {
      const originalIO = globalThis.IntersectionObserver;
      globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

      const el = makeEl({ widget: 'table' }, 'Table');
      const ctx = createAskableContext({ viewport: true });
      ctx.observe(document);

      const observer = MockIntersectionObserver.instances[0];
      observer.trigger([{ target: el, isIntersecting: true }]);
      expect((ctx as any).getVisibleElements()).toHaveLength(1);

      observer.trigger([{ target: el, isIntersecting: false }]);
      expect((ctx as any).getVisibleElements()).toHaveLength(0);
      expect((ctx as any).toViewportContext()).toBe('No annotated UI elements are currently visible.');

      ctx.destroy();
      cleanup(el);
      globalThis.IntersectionObserver = originalIO;
    });
  });

  describe('source timeout edge cases', () => {
    it('times out slow sources after positive timeoutMs', async () => {
      vi.useFakeTimers();
      const ctx = createAskableContext();
      ctx.registerSource('slow', {
        resolve: () => new Promise<{ data: string }>((resolve) => {
          setTimeout(() => resolve({ data: 'late' }), 500);
        }),
      });

      const promptPromise = ctx.toPromptContextAsync({
        sources: [{ id: 'slow', timeoutMs: 100 }],
      });
      await vi.runAllTimersAsync();
      const prompt = await promptPromise;

      expect(prompt).toContain('slow');
      expect(prompt).toContain('Context source unavailable.');
      ctx.destroy();
    });

    it('rejects immediately when the source request signal is already aborted', async () => {
      const ctx = createAskableContext();
      const controller = new AbortController();
      controller.abort();

      ctx.registerSource('fast', {
        resolve: (_req) => ({ data: 'ok' }),
      });

      await expect(
        (ctx as any).resolveSource('fast', { mode: 'summary', signal: controller.signal }),
      ).rejects.toThrow('aborted');

      ctx.destroy();
    });
  });
});
