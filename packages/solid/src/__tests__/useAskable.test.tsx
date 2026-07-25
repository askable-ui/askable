import { describe, it, expect, vi } from 'vitest';
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

  it.each([false, true])(
    'isolates an unnamed sanitizeSource context when sanitized consumer is mounted first=%s',
    (sanitizedFirst) => {
      const contexts: Record<string, ReturnType<typeof createAskableContext>> = {};

      const DefaultConsumer: Component = () => {
        contexts.default = useAskable().ctx;
        return null;
      };
      const SanitizedConsumer: Component = () => {
        contexts.sanitized = useAskable({ sanitizeSource: (source) => source }).ctx;
        return null;
      };

      const view = render(() => sanitizedFirst
        ? <><SanitizedConsumer /><DefaultConsumer /></>
        : <><DefaultConsumer /><SanitizedConsumer /></>);

      expect(contexts.sanitized).toBeDefined();
      expect(contexts.default).toBeDefined();
      expect(contexts.sanitized).not.toBe(contexts.default);
      view.unmount();
    }
  );

  it.each([
    ['maxHistory', { maxHistory: 0 }],
    ['sanitizeMeta', { sanitizeMeta: (meta: Record<string, unknown>) => meta }],
    ['sanitizeText', { sanitizeText: (text: string) => text }],
    ['sanitizeSource', { sanitizeSource: (source: any) => source }],
    ['textExtractor', { textExtractor: (element: Element) => element.textContent ?? '' }],
  ] as const)('isolates unnamed %s configuration', (_label, privateOptions) => {
    const contexts: Record<string, ReturnType<typeof createAskableContext>> = {};
    const DefaultConsumer: Component = () => {
      contexts.default = useAskable().ctx;
      return null;
    };
    const ConfiguredConsumer: Component = () => {
      contexts.configured = useAskable(privateOptions).ctx;
      return null;
    };

    const view = render(() => <><DefaultConsumer /><ConfiguredConsumer /></>);
    expect(contexts.configured).not.toBe(contexts.default);
    view.unmount();
  });

  it('owns named contexts independently for different event configurations', () => {
    let clickCtx: ReturnType<typeof createAskableContext>;
    let focusCtx: ReturnType<typeof createAskableContext>;
    const ClickConsumer: Component = () => {
      clickCtx = useAskable({ name: 'region', events: ['click'] }).ctx;
      return null;
    };
    const FocusConsumer: Component = () => {
      focusCtx = useAskable({ name: 'region', events: ['focus'] }).ctx;
      return null;
    };

    const clickView = render(() => <ClickConsumer />);
    const focusView = render(() => <FocusConsumer />);
    expect(clickCtx!).not.toBe(focusCtx!);

    const focusDestroy = vi.spyOn(focusCtx!, 'destroy');
    clickView.unmount();
    expect(focusDestroy).not.toHaveBeenCalled();
    focusView.unmount();
    expect(focusDestroy).toHaveBeenCalledTimes(1);
  });
});
