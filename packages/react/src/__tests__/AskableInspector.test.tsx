import { render, screen, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import { AskableInspector } from '../AskableInspector';
import { useAskable } from '../useAskable';
import { createAskableContext } from '@askable-ui/core';

function ClickOnlyConsumer() {
  const { focus } = useAskable({ events: ['click'] });
  return <span data-testid="click-only-focus">{focus ? JSON.stringify(focus.meta) : 'null'}</span>;
}

describe('AskableInspector', () => {
  it('can share click-only event configuration with sibling useAskable consumers', async () => {
    const view = render(
      <>
        <div data-testid="target" data-askable='{"widget":"inspector-click-only"}'>
          Inspector target
        </div>
        <ClickOnlyConsumer />
        <AskableInspector events={['click']} />
      </>
    );

    expect(document.getElementById('askable-inspector')?.textContent).toContain('No element focused');
    expect(screen.getByTestId('click-only-focus').textContent).toBe('null');

    act(() => {
      screen.getByTestId('target').dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById('askable-inspector')?.textContent).toContain('No element focused');
    expect(screen.getByTestId('click-only-focus').textContent).toBe('null');

    act(() => {
      screen.getByTestId('target').click();
    });

    await waitFor(() => {
      expect(document.getElementById('askable-inspector')?.textContent).toContain('inspector-click-only');
    });
    expect(screen.getByTestId('click-only-focus').textContent).toContain('inspector-click-only');

    view.unmount();
  });

  it('recreates the inspector when position prop changes', async () => {
    function PositionToggle() {
      const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
      return (
        <>
          <button data-testid="toggle" onClick={() => setPosition('bottom-left')}>Toggle</button>
          <AskableInspector position={position} />
        </>
      );
    }

    const view = render(<PositionToggle />);
    const panelBefore = document.getElementById('askable-inspector');
    expect(panelBefore).not.toBeNull();

    act(() => {
      screen.getByTestId('toggle').click();
    });

    await waitFor(() => {
      const panel = document.getElementById('askable-inspector');
      expect(panel).not.toBeNull();
    });

    view.unmount();
    expect(document.getElementById('askable-inspector')).toBeNull();
  });

  it('destroys the inspector exactly once on unmount after multiple prop changes', async () => {
    function PropChanger() {
      const [highlight, setHighlight] = useState(true);
      return (
        <>
          <button data-testid="toggle" onClick={() => setHighlight((h) => !h)}>Toggle</button>
          <AskableInspector highlight={highlight} />
        </>
      );
    }

    const view = render(<PropChanger />);

    act(() => { screen.getByTestId('toggle').click(); });
    act(() => { screen.getByTestId('toggle').click(); });
    act(() => { screen.getByTestId('toggle').click(); });

    view.unmount();
    expect(document.getElementById('askable-inspector')).toBeNull();
  });

  it('reuses the provided ctx instead of creating a new one', () => {
    const ctx = createAskableContext();
    ctx.push({ widget: 'external' }, 'External element');

    const view = render(<AskableInspector ctx={ctx} />);

    const panel = document.getElementById('askable-inspector');
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('external');

    view.unmount();
    ctx.destroy();
  });
});
