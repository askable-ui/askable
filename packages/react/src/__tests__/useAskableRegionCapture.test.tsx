import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useAskableRegionCapture } from '../useAskableRegionCapture.js';

function pointerEvent(type: string, x: number, y: number): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  return event as PointerEvent;
}

afterEach(() => {
  document.getElementById('askable-region-capture')?.remove();
});

describe('useAskableRegionCapture', () => {
  it('starts capture and exposes the captured packet', async () => {
    function Consumer() {
      const capture = useAskableRegionCapture({
        source: { app: 'react-test' },
        intent: 'explain selected area',
      });

      return (
        <div>
          <button type="button" onClick={() => capture.start()}>
            Start
          </button>
          <span data-testid="active">{String(capture.active)}</span>
          <span data-testid="packet">{capture.lastPacket ? JSON.stringify(capture.lastPacket) : 'null'}</span>
          <span data-testid="selected">{capture.getSelection() ? JSON.stringify(capture.getSelection()?.selection) : 'null'}</span>
          <span data-testid="selection-state">{capture.selectionState ? JSON.stringify(capture.selectionState.selection) : 'null'}</span>
        </div>
      );
    }

    render(<Consumer />);

    act(() => {
      fireEvent.click(screen.getByText('Start'));
    });

    expect(screen.getByTestId('active').textContent).toBe('true');

    const overlay = document.getElementById('askable-region-capture')!;
    act(() => {
      overlay.dispatchEvent(pointerEvent('pointerdown', 20, 30));
      overlay.dispatchEvent(pointerEvent('pointermove', 80, 90));
      overlay.dispatchEvent(pointerEvent('pointerup', 80, 90));
    });

    await waitFor(() => {
      expect(screen.getByTestId('active').textContent).toBe('false');
      expect(screen.getByTestId('packet').textContent).not.toBe('null');
      expect(screen.getByTestId('selected').textContent).not.toBe('null');
      expect(screen.getByTestId('selection-state').textContent).not.toBe('null');
    });

    const packet = JSON.parse(screen.getByTestId('packet').textContent!);
    expect(packet).toMatchObject({
      protocol: 'askable.context',
      source: { app: 'react-test' },
      capture: {
        mode: 'region',
        gesture: 'drag',
        intent: 'explain selected area',
      },
      target: {
        bounds: { x: 20, y: 30, width: 60, height: 60 },
        metadata: { shape: 'region', pointerType: 'mouse' },
      },
      privacy: { consent: 'explicit' },
    });
    expect(JSON.parse(screen.getByTestId('selected').textContent!)).toMatchObject({
      shape: 'region',
      bounds: { x: 20, y: 30, width: 60, height: 60 },
    });
    expect(JSON.parse(screen.getByTestId('selection-state').textContent!)).toMatchObject({
      shape: 'region',
      bounds: { x: 20, y: 30, width: 60, height: 60 },
    });
  });

  it('exposes pinned selection state and clears it from React state', async () => {
    function Consumer() {
      const capture = useAskableRegionCapture({ selectionAffordance: true });

      return (
        <div>
          <button type="button" onClick={() => capture.start()}>
            Start
          </button>
          <button type="button" onClick={() => capture.clearSelection()}>
            Clear
          </button>
          <span data-testid="selection-state">{capture.selectionState ? capture.selectionState.selection.shape : 'null'}</span>
        </div>
      );
    }

    render(<Consumer />);

    act(() => {
      fireEvent.click(screen.getByText('Start'));
    });

    const overlay = document.getElementById('askable-region-capture')!;
    act(() => {
      overlay.dispatchEvent(pointerEvent('pointerdown', 20, 30));
      overlay.dispatchEvent(pointerEvent('pointermove', 80, 90));
      overlay.dispatchEvent(pointerEvent('pointerup', 80, 90));
    });

    await waitFor(() => {
      expect(screen.getByTestId('selection-state').textContent).toBe('region');
    });

    act(() => {
      fireEvent.click(screen.getByText('Clear'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('selection-state').textContent).toBe('null');
    });
  });

  it('supports circle capture overrides at start time', async () => {
    function Consumer() {
      const capture = useAskableRegionCapture();

      return (
        <div>
          <button type="button" onClick={() => capture.start({ shape: 'circle' })}>
            Circle
          </button>
          <span data-testid="packet">{capture.lastPacket ? JSON.stringify(capture.lastPacket) : 'null'}</span>
        </div>
      );
    }

    render(<Consumer />);

    act(() => {
      fireEvent.click(screen.getByText('Circle'));
    });

    const overlay = document.getElementById('askable-region-capture')!;
    act(() => {
      overlay.dispatchEvent(pointerEvent('pointerdown', 10, 20));
      overlay.dispatchEvent(pointerEvent('pointermove', 50, 80));
      overlay.dispatchEvent(pointerEvent('pointerup', 50, 80));
    });

    await waitFor(() => {
      expect(screen.getByTestId('packet').textContent).not.toBe('null');
    });

    const packet = JSON.parse(screen.getByTestId('packet').textContent!);
    expect(packet.capture).toMatchObject({ mode: 'circle', gesture: 'circle' });
    expect(packet.target).toMatchObject({
      bounds: { x: 0, y: 20, width: 60, height: 60 },
      metadata: {
        shape: 'circle',
        center: { x: 30, y: 50 },
        radius: 30,
      },
    });
  });

  it('supports lasso capture overrides at start time', async () => {
    function Consumer() {
      const capture = useAskableRegionCapture();

      return (
        <div>
          <button type="button" onClick={() => capture.start({ shape: 'lasso' })}>
            Lasso
          </button>
          <span data-testid="packet">{capture.lastPacket ? JSON.stringify(capture.lastPacket) : 'null'}</span>
        </div>
      );
    }

    render(<Consumer />);

    act(() => {
      fireEvent.click(screen.getByText('Lasso'));
    });

    const overlay = document.getElementById('askable-region-capture')!;
    act(() => {
      overlay.dispatchEvent(pointerEvent('pointerdown', 10, 20));
      overlay.dispatchEvent(pointerEvent('pointermove', 30, 45));
      overlay.dispatchEvent(pointerEvent('pointermove', 70, 35));
      overlay.dispatchEvent(pointerEvent('pointerup', 80, 75));
    });

    await waitFor(() => {
      expect(screen.getByTestId('packet').textContent).not.toBe('null');
    });

    const packet = JSON.parse(screen.getByTestId('packet').textContent!);
    expect(packet.capture).toMatchObject({ mode: 'lasso', gesture: 'lasso' });
    expect(packet.target).toMatchObject({
      bounds: { x: 10, y: 20, width: 70, height: 55 },
      metadata: {
        shape: 'lasso',
        pointCount: 4,
      },
    });
    expect(packet.target.metadata.points).toHaveLength(4);
  });

  it('keeps React state active after capture when once is false', async () => {
    function Consumer() {
      const capture = useAskableRegionCapture({ once: false });

      return (
        <div>
          <button type="button" onClick={() => capture.start()}>
            Start
          </button>
          <span data-testid="active">{String(capture.active)}</span>
          <span data-testid="is-active">{String(capture.isActive())}</span>
          <span data-testid="packet">{capture.lastPacket ? JSON.stringify(capture.lastPacket) : 'null'}</span>
        </div>
      );
    }

    render(<Consumer />);

    act(() => {
      fireEvent.click(screen.getByText('Start'));
    });

    expect(screen.getByTestId('active').textContent).toBe('true');
    expect(screen.getByTestId('is-active').textContent).toBe('true');

    const overlay = document.getElementById('askable-region-capture')!;
    act(() => {
      overlay.dispatchEvent(pointerEvent('pointerdown', 20, 30));
      overlay.dispatchEvent(pointerEvent('pointermove', 80, 90));
      overlay.dispatchEvent(pointerEvent('pointerup', 80, 90));
    });

    await waitFor(() => {
      expect(screen.getByTestId('packet').textContent).not.toBe('null');
      expect(screen.getByTestId('active').textContent).toBe('true');
      expect(screen.getByTestId('is-active').textContent).toBe('true');
    });
    expect(document.getElementById('askable-region-capture')).toBe(overlay);
  });

  it('cancels the active overlay from React state', async () => {
    function Consumer() {
      const capture = useAskableRegionCapture();

      return (
        <div>
          <button type="button" onClick={() => capture.start()}>
            Start
          </button>
          <button type="button" onClick={() => capture.cancel()}>
            Cancel
          </button>
          <span data-testid="active">{String(capture.active)}</span>
        </div>
      );
    }

    render(<Consumer />);

    act(() => {
      fireEvent.click(screen.getByText('Start'));
    });
    expect(screen.getByTestId('active').textContent).toBe('true');

    act(() => {
      fireEvent.click(screen.getByText('Cancel'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('active').textContent).toBe('false');
    });
    expect(document.getElementById('askable-region-capture')).toBeNull();
  });
});
