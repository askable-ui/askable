import { render, screen, waitFor, act } from '@testing-library/react';
import { AskableInspector } from '../AskableInspector';
import { useAskable } from '../useAskable';

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
});
