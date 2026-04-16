import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Askable from '../Askable.svelte';
import AskableWithContent from './AskableWithContent.svelte';

describe('Askable (Svelte)', () => {
  it('sets data-askable attribute with stringified object meta', () => {
    const meta = { metric: 'revenue', period: 'Q3', value: '$2.3M' };
    const { container } = render(Askable, { props: { meta } });
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('data-askable')).toBe(JSON.stringify(meta));
  });

  it('sets data-askable attribute with plain string meta', () => {
    const { container } = render(Askable, { props: { meta: 'main navigation' } });
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('data-askable')).toBe('main navigation');
  });

  it('renders as div by default', () => {
    const { container } = render(Askable, { props: { meta: {} } });
    expect(container.firstElementChild?.tagName.toLowerCase()).toBe('div');
  });

  it('renders as custom element via as prop', () => {
    const { container } = render(Askable, { props: { meta: {}, as: 'section' } });
    expect(container.firstElementChild?.tagName.toLowerCase()).toBe('section');
  });

  it('renders as article', () => {
    const { container } = render(Askable, { props: { meta: {}, as: 'article' } });
    expect(container.firstElementChild?.tagName.toLowerCase()).toBe('article');
  });

  it('renders slot content via wrapper component', () => {
    const { getByText } = render(AskableWithContent);
    expect(getByText('Revenue Chart')).toBeInTheDocument();
  });

  it('sets data-askable-scope when scope is provided', () => {
    const { container } = render(Askable, { props: { meta: { widget: 'revenue' }, scope: 'analytics' } });
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('data-askable-scope')).toBe('analytics');
  });
});
