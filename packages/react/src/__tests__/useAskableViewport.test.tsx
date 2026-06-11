import { render, act, waitFor } from '@testing-library/react';
import { useAskableViewport } from '../useAskableViewport.js';

// Minimal IntersectionObserver mock
type IOEntry = { target: Element; isIntersecting: boolean };
type IOCallback = (entries: IOEntry[]) => void;

let observerCallbacks: IOCallback[] = [];
let observedElements: Element[] = [];

beforeEach(() => {
  observerCallbacks = [];
  observedElements = [];

  window.IntersectionObserver = class MockIO {
    constructor(cb: IOCallback) {
      observerCallbacks.push(cb);
    }
    observe(el: Element) {
      observedElements.push(el);
    }
    unobserve(el: Element) {
      observedElements = observedElements.filter((e) => e !== el);
    }
    disconnect() {
      observerCallbacks = [];
      observedElements = [];
    }
  } as unknown as typeof IntersectionObserver;
});

function triggerIntersection(entries: IOEntry[]) {
  observerCallbacks.forEach((cb) => cb(entries));
}

function ViewportConsumer({ scope }: { scope?: string }) {
  const { visibleItems, promptContext } = useAskableViewport({ scope });
  return (
    <div>
      <span data-testid="count">{visibleItems.length}</span>
      <span data-testid="prompt">{promptContext}</span>
      {visibleItems.map((item, i) => (
        <span key={i} data-testid={`item-${i}`}>
          {JSON.stringify(item.meta)}
        </span>
      ))}
    </div>
  );
}

describe('useAskableViewport', () => {
  it('starts with no visible items', () => {
    const { getByTestId } = render(<ViewportConsumer />);
    expect(getByTestId('count').textContent).toBe('0');
  });

  it('returns the empty-state prompt initially', () => {
    const { getByTestId } = render(<ViewportConsumer />);
    expect(getByTestId('prompt').textContent).toBe(
      'No annotated elements are currently visible in the viewport.',
    );
  });

  it('adds an item when an element becomes intersecting', async () => {
    const { container, getByTestId } = render(
      <div>
        <ViewportConsumer />
        <div
          data-askable='{"metric":"revenue","value":"$2.3M"}'
          data-testid="el"
        >
          Revenue
        </div>
      </div>,
    );

    const el = container.querySelector<HTMLElement>('[data-askable]')!;

    await act(async () => {
      triggerIntersection([{ target: el, isIntersecting: true }]);
    });

    expect(getByTestId('count').textContent).toBe('1');
    expect(getByTestId('item-0').textContent).toContain('revenue');
  });

  it('removes an item when it leaves the viewport', async () => {
    const { container, getByTestId } = render(
      <div>
        <ViewportConsumer />
        <div data-askable='{"metric":"revenue"}'>Revenue</div>
      </div>,
    );

    const el = container.querySelector<HTMLElement>('[data-askable]')!;

    await act(async () => {
      triggerIntersection([{ target: el, isIntersecting: true }]);
    });
    expect(getByTestId('count').textContent).toBe('1');

    await act(async () => {
      triggerIntersection([{ target: el, isIntersecting: false }]);
    });
    expect(getByTestId('count').textContent).toBe('0');
  });

  it('filters by scope', async () => {
    const { container, getByTestId } = render(
      <div>
        <ViewportConsumer scope="sales" />
        <div data-askable='{"metric":"revenue"}' data-askable-scope="sales">Sales</div>
        <div data-askable='{"metric":"hr"}' data-askable-scope="hr">HR</div>
      </div>,
    );

    const els = container.querySelectorAll<HTMLElement>('[data-askable]');

    await act(async () => {
      triggerIntersection([
        { target: els[0], isIntersecting: true },
        { target: els[1], isIntersecting: true },
      ]);
    });

    // Only sales element passes the scope filter
    expect(getByTestId('count').textContent).toBe('1');
  });

  it('builds a prompt context string for visible items', async () => {
    const { container, getByTestId } = render(
      <div>
        <ViewportConsumer />
        <div data-askable='{"metric":"revenue"}'>Revenue: $2.3M</div>
      </div>,
    );

    const el = container.querySelector<HTMLElement>('[data-askable]')!;

    await act(async () => {
      triggerIntersection([{ target: el, isIntersecting: true }]);
    });

    const prompt = getByTestId('prompt').textContent ?? '';
    expect(prompt).toContain('Visible UI elements:');
    expect(prompt).toContain('revenue');
  });

  it('parses scope from data-askable JSON when no data-askable-scope attribute', async () => {
    const { container, getByTestId } = render(
      <div>
        <ViewportConsumer scope="finance" />
        <div data-askable='{"metric":"revenue","scope":"finance"}'>Revenue</div>
      </div>,
    );

    const el = container.querySelector<HTMLElement>('[data-askable]')!;

    await act(async () => {
      triggerIntersection([{ target: el, isIntersecting: true }]);
    });

    expect(getByTestId('count').textContent).toBe('1');
  });
});
