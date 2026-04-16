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
});
