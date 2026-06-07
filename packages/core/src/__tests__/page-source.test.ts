import { afterEach, describe, expect, it } from 'vitest';
import {
  createAskableContext,
  createAskablePageSource,
} from '../index.js';

function setPage(html: string, title = 'Askable test page') {
  document.title = title;
  document.body.innerHTML = html;
  document.getSelection()?.removeAllRanges();
}

function selectElement(selector: string) {
  const target = document.querySelector(selector);
  if (!target) throw new Error(`Missing test selector: ${selector}`);
  const range = document.createRange();
  range.selectNodeContents(target);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe('createAskablePageSource', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.title = '';
    document.getSelection()?.removeAllRanges();
  });

  it('resolves page summary context without Askable annotations', async () => {
    setPage(`
      <main>
        <h1>Revenue dashboard</h1>
        <h2>Pipeline risk</h2>
        <p id="selected">Acme Corp renewal is at risk.</p>
        <a href="/accounts/acme">Acme account</a>
      </main>
    `);
    selectElement('#selected');
    const ctx = createAskableContext();
    ctx.registerSource('page', createAskablePageSource({ includeLinks: true }));

    expect(ctx.listSources()[0].modes).toEqual(['state', 'summary', 'selected', 'all']);

    const source = await ctx.resolveSource('page', { mode: 'summary' });

    expect(source).toMatchObject({
      id: 'page',
      kind: 'page',
      description: 'Current page',
      data: {
        title: 'Askable test page',
        selectedText: 'Acme Corp renewal is at risk.',
        headings: [
          { level: 1, text: 'Revenue dashboard' },
          { level: 2, text: 'Pipeline risk' },
        ],
        links: [
          { text: 'Acme account' },
        ],
      },
    });

    ctx.destroy();
  });

  it('resolves selected text as an explicit source mode', async () => {
    setPage('<article><p id="quote">Selected product feedback.</p><p>Other text.</p></article>');
    selectElement('#quote');
    const ctx = createAskableContext();
    ctx.registerSource('page', createAskablePageSource());

    const source = await ctx.resolveSource('page', { mode: 'selected' });

    expect(source.data).toMatchObject({
      selectedText: 'Selected product feedback.',
    });
    expect(JSON.stringify(source.data)).not.toContain('Other text');

    ctx.destroy();
  });

  it('resolves full page text with explicit truncation', async () => {
    setPage('<h1>Docs</h1><p>One two three four five six.</p>');
    const ctx = createAskableContext();
    ctx.registerSource('page', createAskablePageSource({ maxTextLength: 12 }));

    const source = await ctx.resolveSource('page', { mode: 'all' });

    expect(source.data).toMatchObject({
      text: 'Docs One two',
      truncated: true,
    });

    ctx.destroy();
  });

  it('sanitizes page text, selections, and headings', async () => {
    setPage('<h1>Customer SSN 123-45-6789</h1><p id="selected">SSN 123-45-6789</p>');
    selectElement('#selected');
    const ctx = createAskableContext();
    ctx.registerSource('page', createAskablePageSource({
      sanitizeText: (text) => text.replace(/\d{3}-\d{2}-\d{4}/g, '[ssn]'),
    }));

    const source = await ctx.resolveSource('page', { mode: 'all' });
    const serialized = JSON.stringify(source.data);

    expect(serialized).toContain('[ssn]');
    expect(serialized).not.toContain('123-45-6789');

    ctx.destroy();
  });
});
