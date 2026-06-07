import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useAskableTextSelectionCapture } from '../useAskableTextSelectionCapture.js';

function selectText(text: string): HTMLElement {
  const el = document.createElement('p');
  el.id = 'react-selection';
  el.textContent = text;
  document.body.appendChild(el);

  const range = document.createRange();
  range.setStart(el.firstChild!, 0);
  range.setEnd(el.firstChild!, text.length);
  Object.defineProperty(range, 'getBoundingClientRect', {
    value: () => ({ x: 10, y: 15, width: 120, height: 20 }),
  });

  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return el;
}

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.querySelectorAll('#react-selection').forEach((el) => el.remove());
});

describe('useAskableTextSelectionCapture', () => {
  it('fires onCapture via selectionchange event when started', async () => {
    const captured: unknown[] = [];

    function Consumer() {
      const capture = useAskableTextSelectionCapture({
        debounce: 0,
        onCapture: (packet) => { captured.push(packet); },
      });

      return (
        <button type="button" onClick={() => capture.start()}>Start</button>
      );
    }

    render(<Consumer />);
    act(() => { fireEvent.click(screen.getByText('Start')); });

    selectText('React selectionchange fires');
    act(() => { document.dispatchEvent(new Event('selectionchange')); });

    await waitFor(() => expect(captured.length).toBe(1));
    expect((captured[0] as { target?: { text?: string } }).target?.text).toBe('React selectionchange fires');
  });

  it('invokes the latest onCapture after prop changes mid-session', async () => {
    const first = vi.fn();
    const second = vi.fn();

    function Consumer({ cb }: { cb: (p: unknown) => void }) {
      const capture = useAskableTextSelectionCapture({ debounce: 0, onCapture: cb });
      return (
        <button type="button" onClick={() => capture.start()}>Start</button>
      );
    }

    const { rerender } = render(<Consumer cb={first} />);
    act(() => { fireEvent.click(screen.getByText('Start')); });

    rerender(<Consumer cb={second} />);

    selectText('Changed callback');
    document.dispatchEvent(new Event('selectionchange'));

    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
    expect(first).not.toHaveBeenCalled();
  });

  it('captures the current browser selection', async () => {
    function Consumer() {
      const capture = useAskableTextSelectionCapture({
        source: { app: 'react-test' },
        intent: 'summarize selection',
      });

      return (
        <div>
          <button type="button" onClick={() => capture.captureNow()}>
            Capture
          </button>
          <span data-testid="packet">{capture.lastPacket ? JSON.stringify(capture.lastPacket) : 'null'}</span>
          <span data-testid="selected">{capture.getSelection() ? JSON.stringify(capture.getSelection()?.selection) : 'null'}</span>
          <span data-testid="selection-state">{capture.selectionState ? JSON.stringify(capture.selectionState.selection) : 'null'}</span>
        </div>
      );
    }

    render(<Consumer />);
    selectText('Selected React copy');

    act(() => {
      fireEvent.click(screen.getByText('Capture'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('packet').textContent).not.toBe('null');
      expect(screen.getByTestId('selected').textContent).not.toBe('null');
      expect(screen.getByTestId('selection-state').textContent).not.toBe('null');
    });

    const packet = JSON.parse(screen.getByTestId('packet').textContent!);
    expect(packet).toMatchObject({
      source: { app: 'react-test' },
      capture: {
        mode: 'text-selection',
        gesture: 'programmatic',
        intent: 'summarize selection',
      },
      target: {
        text: 'Selected React copy',
        selector: '#react-selection',
      },
      privacy: { consent: 'explicit' },
    });
    expect(JSON.parse(screen.getByTestId('selected').textContent!)).toMatchObject({
      text: 'Selected React copy',
      selector: '#react-selection',
    });
    expect(JSON.parse(screen.getByTestId('selection-state').textContent!)).toMatchObject({
      text: 'Selected React copy',
      selector: '#react-selection',
    });
  });

  it('exposes pinned selected text state and clears it from React state', async () => {
    function Consumer() {
      const capture = useAskableTextSelectionCapture({
        selectionAffordance: true,
      });

      return (
        <div>
          <button type="button" onClick={() => capture.captureNow()}>
            Capture
          </button>
          <button type="button" onClick={() => capture.clearSelection()}>
            Clear
          </button>
          <span data-testid="selection-state">{capture.selectionState?.selection.text ?? 'null'}</span>
        </div>
      );
    }

    render(<Consumer />);
    selectText('Pinned React text');

    act(() => {
      fireEvent.click(screen.getByText('Capture'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('selection-state').textContent).toBe('Pinned React text');
    });

    act(() => {
      fireEvent.click(screen.getByText('Clear'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('selection-state').textContent).toBe('null');
    });
  });
});
