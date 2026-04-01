import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
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
