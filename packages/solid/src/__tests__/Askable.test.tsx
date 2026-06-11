import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import { Askable } from '../Askable.js';

describe('Askable (SolidJS)', () => {
  it('sets data-askable with stringified object meta', () => {
    const meta = { metric: 'revenue', value: '$2.3M' };
    const { container, unmount } = render(() => <Askable meta={meta}><span>Revenue</span></Askable>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('data-askable')).toBe(JSON.stringify(meta));
    unmount();
  });

  it('sets data-askable with plain string meta', () => {
    const { container, unmount } = render(() => <Askable meta="main navigation"><span>Nav</span></Askable>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('data-askable')).toBe('main navigation');
    unmount();
  });

  it('renders as div by default', () => {
    const { container, unmount } = render(() => <Askable meta={{}}><span>x</span></Askable>);
    expect(container.firstElementChild?.tagName.toLowerCase()).toBe('div');
    unmount();
  });

  it('renders as custom element via as prop', () => {
    const { container, unmount } = render(() => <Askable meta={{}} as="article"><span>x</span></Askable>);
    expect(container.firstElementChild?.tagName.toLowerCase()).toBe('article');
    unmount();
  });

  it('sets data-askable-scope when scope is provided', () => {
    const { container, unmount } = render(() => <Askable meta={{ id: 'x' }} scope="finance"><span>x</span></Askable>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('data-askable-scope')).toBe('finance');
    unmount();
  });
});
