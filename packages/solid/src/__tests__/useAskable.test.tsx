// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { createAskableContext } from '@askable-ui/core';
import { useAskable } from '../useAskable.js';
import { Askable } from '../Askable.js';

afterEach(() => {
  // Reset global context between tests
  vi.restoreAllMocks();
});

// Helper component that exposes hook output via data attributes for querying
function Consumer(props: { ctx?: ReturnType<typeof createAskableContext> }) {
  const { focus, promptContext } = useAskable({ ctx: props.ctx });
  return (
    <div>
      <span data-testid="focus">{focus() ? 'focused' : 'none'}</span>
      <span data-testid="prompt">{promptContext()}</span>
    </div>
  );
}

describe('useAskable', () => {
  it('returns null focus initially', () => {
    const ctx = createAskableContext();
    const { getByTestId } = render(() => <Consumer ctx={ctx} />);
    expect(getByTestId('focus').textContent).toBe('none');
    ctx.destroy();
  });

  it('updates focus signal when ctx emits focus event', () => {
    const ctx = createAskableContext();
    const { getByTestId } = render(() => <Consumer ctx={ctx} />);

    const el = document.createElement('div');
    el.setAttribute('data-askable', '{"widget":"chart"}');
    el.textContent = 'Revenue';
    document.body.appendChild(el);

    ctx.select(el);

    expect(getByTestId('focus').textContent).toBe('focused');
    el.remove();
    ctx.destroy();
  });

  it('clears focus signal on ctx.clear()', () => {
    const ctx = createAskableContext();
    const { getByTestId } = render(() => <Consumer ctx={ctx} />);

    const el = document.createElement('div');
    el.setAttribute('data-askable', 'info');
    el.textContent = 'Info';
    document.body.appendChild(el);

    ctx.select(el);
    expect(getByTestId('focus').textContent).toBe('focused');

    ctx.clear();
    expect(getByTestId('focus').textContent).toBe('none');

    el.remove();
    ctx.destroy();
  });

  it('promptContext updates reactively with focus', () => {
    const ctx = createAskableContext();
    const { getByTestId } = render(() => <Consumer ctx={ctx} />);

    const before = getByTestId('prompt').textContent;

    const el = document.createElement('div');
    el.setAttribute('data-askable', '{"metric":"revenue"}');
    el.textContent = '$2.3M';
    document.body.appendChild(el);

    ctx.select(el);
    const after = getByTestId('prompt').textContent;
    expect(after).not.toBe(before);
    expect(after).toContain('revenue');

    el.remove();
    ctx.destroy();
  });
});

describe('Askable component', () => {
  it('renders a div with data-askable by default', () => {
    const { container } = render(() => (
      <Askable meta={{ widget: 'chart' }}>content</Askable>
    ));
    const el = container.querySelector('[data-askable]');
    expect(el?.tagName).toBe('DIV');
    expect(el?.getAttribute('data-askable')).toBe('{"widget":"chart"}');
    expect(el?.textContent).toBe('content');
  });

  it('renders a string meta as-is', () => {
    const { container } = render(() => (
      <Askable meta="dashboard-header">header</Askable>
    ));
    expect(container.querySelector('[data-askable]')?.getAttribute('data-askable')).toBe(
      'dashboard-header',
    );
  });

  it('renders a custom element via as prop', () => {
    const { container } = render(() => (
      <Askable meta="info" as="section">body</Askable>
    ));
    expect(container.querySelector('[data-askable]')?.tagName).toBe('SECTION');
  });

  it('forwards extra props', () => {
    const { container } = render(() => (
      <Askable meta="x" class="my-class">text</Askable>
    ));
    expect(container.querySelector('.my-class')).toBeTruthy();
  });
});
