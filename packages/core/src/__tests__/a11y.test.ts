import { describe, it, expect } from 'vitest';
import { a11yTextExtractor } from '../a11y.js';

function el(
  tag: string,
  attrs: Record<string, string> = {},
  text = '',
): HTMLElement {
  const elem = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) elem.setAttribute(k, v);
  if (text) elem.textContent = text;
  return elem;
}

describe('a11yTextExtractor', () => {
  it('prefers aria-label over textContent', () => {
    const button = el('button', { 'aria-label': 'Close dialog' }, 'X');
    expect(a11yTextExtractor(button)).toBe('Close dialog');
  });

  it('uses aria-labelledby reference text', () => {
    const label = document.createElement('span');
    label.id = 'chart-label';
    label.textContent = 'Revenue chart';
    document.body.appendChild(label);

    const div = el('div', { 'aria-labelledby': 'chart-label' });
    expect(a11yTextExtractor(div)).toBe('Revenue chart');

    label.remove();
  });

  it('concatenates multiple aria-labelledby references', () => {
    const l1 = document.createElement('span');
    l1.id = 'prefix';
    l1.textContent = 'Q3';
    const l2 = document.createElement('span');
    l2.id = 'metric';
    l2.textContent = 'Revenue';
    document.body.appendChild(l1);
    document.body.appendChild(l2);

    const div = el('div', { 'aria-labelledby': 'prefix metric' });
    expect(a11yTextExtractor(div)).toBe('Q3 Revenue');

    l1.remove();
    l2.remove();
  });

  it('falls back to title when no aria-label or labelledby', () => {
    const img = el('img', { title: 'Bar chart', src: 'chart.png' });
    expect(a11yTextExtractor(img)).toBe('Bar chart');
  });

  it('uses alt attribute for images', () => {
    const img = el('img', { alt: 'Revenue trend line', src: 'chart.png' });
    expect(a11yTextExtractor(img)).toBe('Revenue trend line');
  });

  it('aria-label takes precedence over alt', () => {
    const img = el('img', { 'aria-label': 'Explicit label', alt: 'Alt text' });
    expect(a11yTextExtractor(img)).toBe('Explicit label');
  });

  it('uses placeholder for inputs', () => {
    const input = el('input', { placeholder: 'Search metrics…', type: 'text' });
    expect(a11yTextExtractor(input)).toBe('Search metrics…');
  });

  it('falls back to textContent when no accessible attributes', () => {
    const div = el('div', {}, 'Revenue: $2.3M');
    expect(a11yTextExtractor(div)).toBe('Revenue: $2.3M');
  });

  it('returns empty string for element with no text or attributes', () => {
    const div = el('div');
    expect(a11yTextExtractor(div)).toBe('');
  });

  it('trims whitespace from all sources', () => {
    const button = el('button', { 'aria-label': '  Save  ' });
    expect(a11yTextExtractor(button)).toBe('Save');
  });

  it('skips empty aria-label and falls through to next source', () => {
    const div = el('div', { 'aria-label': '  ', title: 'Dashboard widget' });
    expect(a11yTextExtractor(div)).toBe('Dashboard widget');
  });

  it('empty alt attribute falls through to textContent', () => {
    // decorative image — alt="" is intentionally empty; use textContent
    const img = el('img', { alt: '', src: 'deco.png' });
    // alt is empty string, so fall through to placeholder, then textContent
    expect(a11yTextExtractor(img)).toBe('');
  });

  it('integrates with createAskableContext textExtractor option', () => {
    // Verify the function signature matches what createAskableContext expects
    const fn: (el: HTMLElement) => string = a11yTextExtractor;
    expect(typeof fn).toBe('function');
  });
});
