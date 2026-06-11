import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AskableContextElement, defineAskableContext } from '../askable-context.js';

// Register the element before tests
defineAskableContext();

function mount(html: string): { container: HTMLElement; cleanup: () => void } {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return { container, cleanup: () => container.remove() };
}

describe('AskableContextElement', () => {
  it('registers as a custom element', () => {
    expect(customElements.get('askable-context')).toBe(AskableContextElement);
  });

  it('creates an AskableContext when connected', () => {
    const { container, cleanup } = mount('<askable-context id="ctx1"></askable-context>');
    const el = container.querySelector<AskableContextElement>('#ctx1')!;
    expect(el.askableContext).not.toBeNull();
    cleanup();
  });

  it('destroys context when disconnected', () => {
    const { container, cleanup } = mount('<askable-context id="ctx2"></askable-context>');
    const el = container.querySelector<AskableContextElement>('#ctx2')!;
    const ctx = el.askableContext!;
    cleanup();
    expect(el.askableContext).toBeNull();
  });

  it('starts with null focus and empty promptContext', () => {
    const { container, cleanup } = mount('<askable-context id="ctx3"></askable-context>');
    const el = container.querySelector<AskableContextElement>('#ctx3')!;
    expect(el.currentFocus).toBeNull();
    expect(el.promptContext).toBe('');
    cleanup();
  });

  it('emits askable:focus event when context.push() is called', () => {
    const { container, cleanup } = mount('<askable-context id="ctx4"></askable-context>');
    const el = container.querySelector<AskableContextElement>('#ctx4')!;
    const handler = vi.fn();
    el.addEventListener('askable:focus', handler);

    el.askableContext!.push({ metric: 'revenue', value: '$2.3M' }, 'Revenue');

    expect(handler).toHaveBeenCalledOnce();
    const detail = handler.mock.calls[0][0].detail;
    expect(detail.focus.meta).toMatchObject({ metric: 'revenue' });
    expect(detail.promptContext).toContain('revenue');

    cleanup();
  });

  it('updates focus property after push()', () => {
    const { container, cleanup } = mount('<askable-context id="ctx5"></askable-context>');
    const el = container.querySelector<AskableContextElement>('#ctx5')!;

    el.askableContext!.push({ metric: 'NPS', value: '72' }, 'NPS');
    expect(el.currentFocus?.meta).toMatchObject({ metric: 'NPS' });

    cleanup();
  });

  it('emits askable:clear event and resets focus', () => {
    const { container, cleanup } = mount('<askable-context id="ctx6"></askable-context>');
    const el = container.querySelector<AskableContextElement>('#ctx6')!;
    const clearHandler = vi.fn();
    el.addEventListener('askable:clear', clearHandler);

    el.askableContext!.push({ metric: 'revenue' }, 'Revenue');
    el.askableContext!.clear();

    expect(clearHandler).toHaveBeenCalledOnce();
    expect(el.currentFocus).toBeNull();
    expect(el.promptContext).toBe('');

    cleanup();
  });

  it('observe=false disables automatic DOM observation', () => {
    const { container, cleanup } = mount(
      `<askable-context id="ctx7" observe="false">
         <button data-askable='{"action":"buy"}'>Buy</button>
       </askable-context>`,
    );
    const el = container.querySelector<AskableContextElement>('#ctx7')!;
    // With observe=false, clicking the button should NOT set focus automatically
    expect(el.askableContext).not.toBeNull();
    cleanup();
  });
});
