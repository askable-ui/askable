import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { createAskableContext } from '@askable-ui/core';
import { createSignal, type Component } from 'solid-js';
import { useAskable } from '../useAskable.js';

function Consumer(props: { ctx?: ReturnType<typeof createAskableContext> }) {
  const { focus, promptContext } = useAskable(props.ctx ? { ctx: props.ctx } : undefined);
  return (
    <div>
      <span data-testid="focus-meta">{focus() ? JSON.stringify(focus()!.meta) : 'null'}</span>
      <span data-testid="prompt">{promptContext()}</span>
    </div>
  );
}

describe('useAskable (SolidJS)', () => {
  it('returns null focus initially', () => {
    const ctx = createAskableContext();
    const { getByTestId, unmount } = render(() => <Consumer ctx={ctx} />);
    expect(getByTestId('focus-meta').textContent).toBe('null');
    unmount();
    ctx.destroy();
  });

  it('returns the no-focus prompt initially', () => {
    const ctx = createAskableContext();
    const { getByTestId, unmount } = render(() => <Consumer ctx={ctx} />);
    expect(getByTestId('prompt').textContent).toBe('No UI element is currently focused.');
    unmount();
    ctx.destroy();
  });

  it('updates focus when ctx.push() is called', () => {
    const ctx = createAskableContext();
    const { getByTestId, unmount } = render(() => <Consumer ctx={ctx} />);

    ctx.push({ meta: { metric: 'revenue', value: '$2.3M' }, text: 'Revenue' });

    expect(getByTestId('focus-meta').textContent).toContain('revenue');
    unmount();
    ctx.destroy();
  });

  it('resets focus when ctx.clear() is called', () => {
    const ctx = createAskableContext();
    const { getByTestId, unmount } = render(() => <Consumer ctx={ctx} />);

    ctx.push({ meta: { metric: 'revenue' }, text: 'Revenue' });
    expect(getByTestId('focus-meta').textContent).not.toBe('null');

    ctx.clear();
    expect(getByTestId('focus-meta').textContent).toBe('null');
    unmount();
    ctx.destroy();
  });
});
