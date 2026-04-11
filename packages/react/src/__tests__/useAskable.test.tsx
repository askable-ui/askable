import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useEffect } from 'react';
import { createAskableContext } from '@askable-ui/core';
import type { AskableContext } from '@askable-ui/core';
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
