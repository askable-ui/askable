import { render } from '@testing-library/react';
import { Askable } from '../Askable';

describe('Askable', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <Askable meta={{ widget: 'revenue' }}>Revenue Chart</Askable>
    );
    expect(getByText('Revenue Chart')).toBeInTheDocument();
  });

  it('sets data-askable attribute with stringified meta object', () => {
    const meta = { metric: 'revenue', period: 'Q3', value: '$2.3M' };
    const { container } = render(<Askable meta={meta}>content</Askable>);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('data-askable')).toBe(JSON.stringify(meta));
  });

  it('sets data-askable attribute with plain string meta', () => {
    const { container } = render(<Askable meta="main navigation">nav</Askable>);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('data-askable')).toBe('main navigation');
  });

  it('renders as div by default', () => {
    const { container } = render(<Askable meta={{}}>content</Askable>);
    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  it('renders as section when as="section"', () => {
    const { container } = render(
      <Askable meta={{}} as="section">content</Askable>
    );
    expect(container.firstChild?.nodeName).toBe('SECTION');
  });

  it('renders as article when as="article"', () => {
    const { container } = render(
      <Askable meta={{}} as="article">content</Askable>
    );
    expect(container.firstChild?.nodeName).toBe('ARTICLE');
  });

  it('forwards additional props to the element', () => {
    const { container } = render(
      <Askable meta={{}} id="chart-wrapper" className="panel" data-testid="fwd">
        content
      </Askable>
    );
    const el = container.firstChild as HTMLElement;
    expect(el.id).toBe('chart-wrapper');
    expect(el.className).toBe('panel');
    expect(el.getAttribute('data-testid')).toBe('fwd');
  });

  it('sets data-askable-scope when scope is provided', () => {
    const { container } = render(
      <Askable meta={{ widget: 'revenue' }} scope="analytics">Revenue Chart</Askable>
    );
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('data-askable-scope')).toBe('analytics');
  });

  it('sets data-askable-events when component-level activation events are provided', () => {
    const { container } = render(
      <Askable meta={{ widget: 'revenue' }} events={['hover', 'focus']}>Revenue Chart</Askable>
    );
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('data-askable-events')).toBe('hover,focus');
  });

  it('supports a manual activation mode for explicit button-driven flows', () => {
    const { container } = render(
      <Askable meta={{ widget: 'revenue' }} events="manual">Revenue Chart</Askable>
    );
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('data-askable-events')).toBe('manual');
  });

  it('supports nested Askable wrappers that form a DOM hierarchy', () => {
    const { container } = render(
      <Askable meta={{ view: 'dashboard' }}>
        <Askable meta={{ tab: 'finance' }}>
          <Askable meta={{ metric: 'revenue' }}>Revenue Chart</Askable>
        </Askable>
      </Askable>
    );

    const outer = container.firstChild as HTMLElement;
    const middle = outer.firstElementChild as HTMLElement;
    const inner = middle.firstElementChild as HTMLElement;

    expect(outer.getAttribute('data-askable')).toBe(JSON.stringify({ view: 'dashboard' }));
    expect(middle.getAttribute('data-askable')).toBe(JSON.stringify({ tab: 'finance' }));
    expect(inner.getAttribute('data-askable')).toBe(JSON.stringify({ metric: 'revenue' }));
  });
});
