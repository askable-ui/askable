import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useEffect } from 'react';
import { createAskableContext } from '@askable-ui/core';
import type { AskableContext } from '@askable-ui/core';
import { Askable } from '../Askable';
import { useAskable } from '../useAskable';

function Consumer({
  targetId,
  ctx,
}: {
  targetId?: string;
  ctx?: ReturnType<typeof createAskableContext>;
}) {
  const { focus, promptContext } = useAskable(ctx ? { ctx } : undefined);
  return (
    <div>
      {targetId && (
        <div
          id={targetId}
          data-testid="askable-target"
          data-askable='{"metric":"revenue","period":"Q3","value":"$2.3M"}'
        >
          Revenue: $2.3M
        </div>
      )}
      <span data-testid="focus-meta">
        {focus ? JSON.stringify(focus.meta) : 'null'}
      </span>
      <span data-testid="focus-text">{focus ? focus.text : ''}</span>
      <span data-testid="prompt-context">{promptContext}</span>
    </div>
  );
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useAskable', () => {
  it('returns null focus initially', () => {
    render(<Consumer />);
    expect(screen.getByTestId('focus-meta').textContent).toBe('null');
  });

  it('returns the no-focus prompt string initially', () => {
    render(<Consumer />);
    expect(screen.getByTestId('prompt-context').textContent).toBe(
      'No UI element is currently focused.'
    );
  });

  it('updates focus after a click on a [data-askable] element', async () => {
    render(<Consumer targetId="revenue-chart" />);
    await flushMicrotasks();

    expect(screen.getByTestId('focus-meta').textContent).toBe('null');

    act(() => {
      fireEvent.click(screen.getByTestId('askable-target'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('focus-meta').textContent).not.toBe('null');
    });

    const meta = JSON.parse(screen.getByTestId('focus-meta').textContent!);
    expect(meta).toEqual({ metric: 'revenue', period: 'Q3', value: '$2.3M' });
  });

  it('populates focus.text from element textContent after click', async () => {
    render(<Consumer targetId="revenue-text" />);
    await flushMicrotasks();

    act(() => {
      fireEvent.click(screen.getByTestId('askable-target'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('focus-text').textContent).not.toBe('');
    });

    expect(screen.getByTestId('focus-text').textContent).toContain('Revenue');
  });

  it('returns a non-empty promptContext string after focus', async () => {
    render(<Consumer targetId="prompt-test" />);
    await flushMicrotasks();

    act(() => {
      fireEvent.click(screen.getByTestId('askable-target'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('prompt-context').textContent).not.toBe(
        'No UI element is currently focused.'
      );
    });

    const prompt = screen.getByTestId('prompt-context').textContent!;
    expect(prompt).toContain('User is focused on');
    expect(prompt).toContain('revenue');
  });

  it('can create a viewport-aware context via hook options', () => {
    let seenCtx: AskableContext | null = null;

    function ViewportConsumer() {
      const { ctx } = useAskable({ viewport: true });
      useEffect(() => {
        seenCtx = ctx;
      }, [ctx]);
      return null;
    }

    const view = render(<ViewportConsumer />);
    expect(seenCtx).not.toBeNull();
    expect(typeof (seenCtx as any).getVisibleElements).toBe('function');
    expect(typeof (seenCtx as any).toViewportContext).toBe('function');
    view.unmount();
  });

  it('can use an explicitly provided scoped context', async () => {
    const ctx = createAskableContext();
    ctx.observe(document, { events: ['click'] });

    render(<Consumer targetId="scoped-test" ctx={ctx} />);
    await flushMicrotasks();

    act(() => {
      fireEvent.click(screen.getByTestId('askable-target'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('focus-meta').textContent).not.toBe('null');
    });

    const meta = JSON.parse(screen.getByTestId('focus-meta').textContent!);
    expect(meta).toEqual({ metric: 'revenue', period: 'Q3', value: '$2.3M' });

    ctx.destroy();
  });

  it('keeps separate scoped contexts isolated', async () => {
    const ctxA = createAskableContext();
    const ctxB = createAskableContext();
    ctxA.observe(document, { events: ['click'] });
    ctxB.observe(document, { events: ['click'] });

    render(
      <>
        <div data-testid="target-a" data-askable='{"scope":"a"}'>A</div>
        <div data-testid="target-b" data-askable='{"scope":"b"}'>B</div>
        <ScopedView label="a" ctx={ctxA} />
        <ScopedView label="b" ctx={ctxB} />
      </>
    );

    await flushMicrotasks();

    act(() => {
      ctxA.select(screen.getByTestId('target-a'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('scoped-a').textContent).toContain('scope');
    });

    expect(screen.getByTestId('scoped-a').textContent).toContain('"a"');
    expect(screen.getByTestId('scoped-b').textContent).toBe('null');

    act(() => {
      ctxB.select(screen.getByTestId('target-b'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('scoped-b').textContent).toContain('"b"');
    });

    ctxA.destroy();
    ctxB.destroy();
  });

  it('reuses the same named shared context across consumers', async () => {
    const seen: AskableContext[] = [];

    function NamedConsumer({ label }: { label: string }) {
      const { ctx } = useAskable({ name: 'table' });
      useEffect(() => {
        seen.push(ctx);
      }, [ctx]);
      return <span data-testid={`named-${label}`}>ready</span>;
    }

    const first = render(<NamedConsumer label="one" />);
    await flushMicrotasks();

    const second = render(<NamedConsumer label="two" />);
    await flushMicrotasks();

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);

    second.unmount();
    first.unmount();
  });

  it('keeps different named shared contexts isolated', async () => {
    const seen: AskableContext[] = [];

    function NamedConsumer({ name }: { name: string }) {
      const { ctx } = useAskable({ name });
      useEffect(() => {
        seen.push(ctx);
      }, [ctx]);
      return null;
    }

    const view = render(
      <>
        <NamedConsumer name="table" />
        <NamedConsumer name="chart" />
      </>
    );
    await flushMicrotasks();

    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);

    view.unmount();
  });

  it('observes the shared global context only once for multiple consumers with the same events', async () => {
    let capturedCtx: ReturnType<typeof createAskableContext> | null = null;

    function CaptureCtx({ label }: { label: string }) {
      const { ctx } = useAskable();
      useEffect(() => {
        capturedCtx = ctx;
      }, [ctx]);
      return <span data-testid={`capture-${label}`}>ready</span>;
    }

    const first = render(<CaptureCtx label="one" />);
    await flushMicrotasks();
    expect(capturedCtx).not.toBeNull();

    const observeSpy = vi.spyOn(capturedCtx!, 'observe');
    const second = render(<CaptureCtx label="two" />);
    await flushMicrotasks();

    expect(observeSpy).not.toHaveBeenCalled();

    second.unmount();
    first.unmount();
  });

  it('reuses the same shared context when events rerender with the same logical values', async () => {
    const seen: AskableContext[] = [];

    function DynamicCtx({ events }: { events: ('click' | 'focus')[] }) {
      const { ctx } = useAskable({ events });
      useEffect(() => {
        seen.push(ctx);
      }, [ctx]);
      return null;
    }

    const view = render(<DynamicCtx events={['click']} />);
    await flushMicrotasks();

    view.rerender(<DynamicCtx events={['click']} />);
    await flushMicrotasks();

    expect(seen).toHaveLength(1);

    view.unmount();
  });

  it('keeps private contexts stable across rerenders with inline creation options', async () => {
    const seen: AskableContext[] = [];

    function PrivateCtx() {
      const { ctx } = useAskable({ sanitizeText: (text) => text.trim() });
      useEffect(() => {
        seen.push(ctx);
      }, [ctx]);
      return null;
    }

    const view = render(<PrivateCtx />);
    await flushMicrotasks();

    view.rerender(<PrivateCtx />);
    await flushMicrotasks();

    expect(seen).toHaveLength(1);

    view.unmount();
  });

  it('switches to the matching shared context when events change', async () => {
    const seen: AskableContext[] = [];

    function DynamicCtx({ events }: { events: ('click' | 'focus')[] }) {
      const { ctx } = useAskable({ events });
      useEffect(() => {
        seen.push(ctx);
      }, [ctx]);
      return null;
    }

    const view = render(<DynamicCtx events={['click']} />);
    await flushMicrotasks();

    view.rerender(<DynamicCtx events={['focus']} />);
    await flushMicrotasks();

    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);

    view.unmount();
  });

  it('isolates differing shared event configurations and preserves the remaining config on unmount', async () => {
    function EventConsumer({
      label,
      events,
    }: {
      label: string;
      events: ('click' | 'focus')[];
    }) {
      const { focus } = useAskable({ events });
      return <span data-testid={`event-${label}`}>{focus ? JSON.stringify(focus.meta) : 'null'}</span>;
    }

    const clickView = render(
      <>
        <button data-testid="event-target" data-askable='{"widget":"shared-events"}'>
          Shared events
        </button>
        <EventConsumer label="click" events={['click']} />
      </>
    );
    await flushMicrotasks();

    const focusView = render(<EventConsumer label="focus" events={['focus']} />);
    await flushMicrotasks();

    act(() => {
      fireEvent.click(screen.getByTestId('event-target'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('event-click').textContent).toContain('shared-events');
    });
    expect(screen.getByTestId('event-focus').textContent).toBe('null');

    focusView.unmount();

    act(() => {
      fireEvent.click(screen.getByTestId('event-target'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('event-click').textContent).toContain('shared-events');
    });

    clickView.unmount();
  });

  it('supports per-component activation overrides within one shared context', async () => {
    function MixedActivationConsumer() {
      const { focus, ctx } = useAskable();
      return (
        <>
          <span data-testid="mixed-focus">{focus ? JSON.stringify(focus.meta) : 'null'}</span>
          <button
            data-testid="manual-trigger"
            onClick={() => {
              const el = document.querySelector('[data-testid="manual-card"]') as HTMLElement | null;
              if (el) ctx.select(el);
            }}
          >
            Ask AI
          </button>
        </>
      );
    }

    const view = render(
      <>
        <Askable meta={{ widget: 'hover-card' }} events={['hover']} data-testid="hover-card">
          Hover card
        </Askable>
        <Askable meta={{ widget: 'click-card' }} events={['click']} data-testid="click-card">
          Click card
        </Askable>
        <Askable meta={{ widget: 'manual-card' }} events="manual" data-testid="manual-card">
          Manual card
        </Askable>
        <MixedActivationConsumer />
      </>
    );
    await flushMicrotasks();

    act(() => {
      screen.getByTestId('hover-card').dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('mixed-focus').textContent).toContain('hover-card');
    });

    act(() => {
      fireEvent.click(screen.getByTestId('hover-card'));
    });
    expect(screen.getByTestId('mixed-focus').textContent).toContain('hover-card');

    act(() => {
      fireEvent.click(screen.getByTestId('click-card'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('mixed-focus').textContent).toContain('click-card');
    });

    act(() => {
      fireEvent.click(screen.getByTestId('manual-card'));
    });
    expect(screen.getByTestId('mixed-focus').textContent).toContain('click-card');

    act(() => {
      fireEvent.click(screen.getByTestId('manual-trigger'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('mixed-focus').textContent).toContain('manual-card');
    });

    view.unmount();
  });

  it('updates shared hook-managed focus on hover-only events', async () => {
    function HoverConsumer({ inspector = false }: { inspector?: boolean }) {
      const { focus } = useAskable({ events: ['hover'], inspector });
      return <span data-testid="hover-focus">{focus ? JSON.stringify(focus.meta) : 'null'}</span>;
    }

    const view = render(
      <>
        <div data-testid="hover-target" data-askable='{"widget":"hover-only"}'>
          Hover only
        </div>
        <HoverConsumer />
      </>
    );
    await flushMicrotasks();

    act(() => {
      screen.getByTestId('hover-target').dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('hover-focus').textContent).toContain('hover-only');
    });

    view.unmount();
  });

  it('updates shared hook-managed focus on focus-only events', async () => {
    function FocusConsumer() {
      const { focus } = useAskable({ events: ['focus'] });
      return <span data-testid="focus-only-state">{focus ? JSON.stringify(focus.meta) : 'null'}</span>;
    }

    const view = render(
      <>
        <button data-testid="focus-only-target" data-askable='{"widget":"focus-only"}'>
          Focus only
        </button>
        <FocusConsumer />
      </>
    );
    await flushMicrotasks();

    act(() => {
      screen.getByTestId('focus-only-target').focus();
      fireEvent.focus(screen.getByTestId('focus-only-target'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('focus-only-state').textContent).toContain('focus-only');
    });

    view.unmount();
  });

  it('keeps hover-only shared contexts working when inspector mode is enabled', async () => {
    function HoverConsumer() {
      const { focus } = useAskable({ events: ['hover'], inspector: true });
      return <span data-testid="hover-focus-inspector">{focus ? JSON.stringify(focus.meta) : 'null'}</span>;
    }

    const view = render(
      <>
        <div data-testid="hover-target-inspector" data-askable='{"widget":"hover-inspector"}'>
          Hover inspector
        </div>
        <HoverConsumer />
      </>
    );
    await flushMicrotasks();

    act(() => {
      screen.getByTestId('hover-target-inspector').dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('hover-focus-inspector').textContent).toContain('hover-inspector');
    });

    view.unmount();
  });
});

function ScopedView({
  ctx,
  label,
}: {
  ctx: ReturnType<typeof createAskableContext>;
  label: string;
}) {
  const { focus } = useAskable({ ctx });
  return (
    <span data-testid={`scoped-${label}`}>
      {focus ? JSON.stringify(focus.meta) : 'null'}
    </span>
  );
}
