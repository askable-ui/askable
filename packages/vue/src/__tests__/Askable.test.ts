import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { Askable } from '../Askable.js';
import { track } from './helpers.js';

describe('Askable (Vue)', () => {
  it('renders children correctly', () => {
    const wrapper = track(
      mount(Askable, {
        props: { meta: { widget: 'revenue' } },
        slots: { default: 'Revenue Chart' },
      })
    );
    expect(wrapper.text()).toBe('Revenue Chart');
  });

  it('sets data-askable attribute with stringified object meta', () => {
    const meta = { metric: 'revenue', period: 'Q3', value: '$2.3M' };
    const wrapper = track(mount(Askable, { props: { meta } }));
    expect(wrapper.attributes('data-askable')).toBe(JSON.stringify(meta));
  });

  it('sets data-askable attribute with plain string meta', () => {
    const wrapper = track(mount(Askable, { props: { meta: 'main navigation' } }));
    expect(wrapper.attributes('data-askable')).toBe('main navigation');
  });

  it('renders as div by default', () => {
    const wrapper = track(mount(Askable, { props: { meta: {} } }));
    expect(wrapper.element.tagName.toLowerCase()).toBe('div');
  });

  it('renders as section when as="section"', () => {
    const wrapper = track(
      mount(Askable, { props: { meta: {}, as: 'section' } })
    );
    expect(wrapper.element.tagName.toLowerCase()).toBe('section');
  });

  it('renders as article when as="article"', () => {
    const wrapper = track(
      mount(Askable, { props: { meta: {}, as: 'article' } })
    );
    expect(wrapper.element.tagName.toLowerCase()).toBe('article');
  });

  it('forwards additional attributes to the element', () => {
    const wrapper = track(
      mount(Askable, {
        props: { meta: {} },
        attrs: { id: 'chart-wrapper', class: 'panel', 'data-testid': 'fwd' },
      })
    );
    expect(wrapper.attributes('id')).toBe('chart-wrapper');
    expect(wrapper.attributes('class')).toBe('panel');
    expect(wrapper.attributes('data-testid')).toBe('fwd');
  });

  it('sets data-askable-scope when scope is provided', () => {
    const wrapper = track(mount(Askable, { props: { meta: { widget: 'revenue' }, scope: 'analytics' } }));
    expect(wrapper.attributes('data-askable-scope')).toBe('analytics');
  });

  it('supports nested Askable wrappers that form a DOM hierarchy', () => {
    const wrapper = track(mount({
      components: { Askable },
      template: `
        <Askable :meta="{ view: 'dashboard' }">
          <Askable :meta="{ tab: 'finance' }">
            <Askable :meta="{ metric: 'revenue' }">Revenue Chart</Askable>
          </Askable>
        </Askable>
      `,
    }));

    const nodes = wrapper.findAll('[data-askable]');
    expect(nodes).toHaveLength(3);
    expect(nodes[0].attributes('data-askable')).toBe(JSON.stringify({ view: 'dashboard' }));
    expect(nodes[1].attributes('data-askable')).toBe(JSON.stringify({ tab: 'finance' }));
    expect(nodes[2].attributes('data-askable')).toBe(JSON.stringify({ metric: 'revenue' }));
  });
});
