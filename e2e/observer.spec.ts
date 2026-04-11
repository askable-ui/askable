import { test, expect } from './fixtures.js';

/**
 * Cross-browser tests for the core observer behaviour.
 * Each test mounts a minimal HTML harness via page.setContent() — no server required.
 */

test.describe('click tracking', () => {
  test('click on [data-askable] sets focus with correct meta', async ({ harness }) => {
    const page = await harness(`
      <div id="card" data-askable='{"widget":"revenue","value":"$128k"}' tabindex="0">Revenue</div>
    `);

    await page.click('#card');

    const focus = await page.evaluate(() => {
      const f = (window as any).ctx.getFocus();
      return f ? { meta: f.meta, text: f.text } : null;
    });

    expect(focus).not.toBeNull();
    expect(focus!.meta).toEqual({ widget: 'revenue', value: '$128k' });
    expect(focus!.text).toBe('Revenue');
  });

  test('click on non-annotated element does not change focus', async ({ harness }) => {
    const page = await harness(`
      <div id="card" data-askable='{"widget":"kpi"}' tabindex="0">KPI</div>
      <button id="plain">No annotation</button>
    `);

    await page.click('#card');
    await page.click('#plain');

    const focus = await page.evaluate(() => {
      const f = (window as any).ctx.getFocus();
      return f ? f.meta : null;
    });

    // Focus should still be on the card — plain button doesn't update it
    expect(focus).toEqual({ widget: 'kpi' });
  });

  test('plain string meta is captured as-is', async ({ harness }) => {
    const page = await harness(`
      <nav id="nav" data-askable="main navigation" tabindex="0">Nav</nav>
    `);

    await page.click('#nav');

    const meta = await page.evaluate(() => (window as any).ctx.getFocus()?.meta);
    expect(meta).toBe('main navigation');
  });
});

test.describe('hover tracking', () => {
  test('hover fires focus with correct meta', async ({ harness }) => {
    const page = await harness(
      `<div id="kpi" data-askable='{"widget":"churn"}' style="width:200px;height:100px">Churn</div>`,
      `window.ctx.unobserve(); window.ctx.observe(document, { events: ['hover'] });`,
    );

    await page.hover('#kpi');

    const focus = await page.evaluate(() => (window as any).ctx.getFocus()?.meta);
    expect(focus).toEqual({ widget: 'churn' });
  });

  test('hoverDebounce delays focus update', async ({ harness }) => {
    const page = await harness(
      `<div id="a" data-askable='{"widget":"a"}' style="width:200px;height:80px">A</div>
       <div id="b" data-askable='{"widget":"b"}' style="width:200px;height:80px">B</div>`,
      `window.ctx.unobserve(); window.ctx.observe(document, { events: ['hover'], hoverDebounce: 200 });`,
    );

    // Hover quickly over A then B — debounce should collapse to B
    await page.hover('#a');
    await page.hover('#b');

    // Immediately after second hover, focus might still be null (debouncing)
    const immediateWidget = await page.evaluate(() => (window as any).ctx.getFocus()?.meta?.widget ?? null);
    // Could be null or 'b' — just check it's not 'a' (which was debounced away)
    expect(immediateWidget).not.toBe('a');

    // After debounce window, focus should resolve to b
    await page.waitForTimeout(300);
    const widget = await page.evaluate(() => (window as any).ctx.getFocus()?.meta?.widget);
    expect(widget).toBe('b');
  });
});

test.describe('keyboard focus tracking', () => {
  test('keyboard focus on [data-askable] sets focus', async ({ harness }) => {
    const page = await harness(`
      <button id="btn" data-askable='{"widget":"send"}'>Send</button>
    `, `window.ctx.unobserve(); window.ctx.observe(document, { events: ['focus'] });`);

    await page.focus('#btn');

    const meta = await page.evaluate(() => (window as any).ctx.getFocus()?.meta);
    expect(meta).toEqual({ widget: 'send' });
  });
});

test.describe('nested elements — deepest strategy (default)', () => {
  test('clicking nested inner element wins', async ({ harness }) => {
    const page = await harness(`
      <section id="outer" data-askable='{"section":"dashboard"}'>
        <div id="inner" data-askable='{"widget":"revenue"}' tabindex="0">Revenue</div>
      </section>
    `);

    await page.click('#inner');

    const meta = await page.evaluate(() => (window as any).ctx.getFocus()?.meta);
    expect(meta).toEqual({ widget: 'revenue' });
  });

  test('data-askable-priority overrides deepest', async ({ harness }) => {
    const page = await harness(`
      <section id="outer" data-askable='{"section":"highlights"}' data-askable-priority="10">
        <div id="inner" data-askable='{"card":"revenue"}'>Revenue</div>
      </section>
    `);

    await page.click('#inner');

    const meta = await page.evaluate(() => (window as any).ctx.getFocus()?.meta);
    expect(meta).toEqual({ section: 'highlights' });
  });
});

test.describe('nested elements — shallowest strategy', () => {
  test('outermost element wins', async ({ harness }) => {
    const page = await harness(
      `<section id="outer" data-askable='{"page":"analytics"}'>
        <div id="inner" data-askable='{"widget":"chart"}' tabindex="0">Chart</div>
      </section>`,
      `window.ctx.unobserve(); window.ctx.observe(document, { targetStrategy: 'shallowest' });`,
    );

    await page.click('#inner');

    const meta = await page.evaluate(() => (window as any).ctx.getFocus()?.meta);
    expect(meta).toEqual({ page: 'analytics' });
  });
});

test.describe('nested elements — exact strategy', () => {
  test('clicking inner child of annotated div does NOT fire', async ({ harness }) => {
    const page = await harness(
      `<div id="card" data-askable='{"widget":"kpi"}'>
        <span id="child">text</span>
      </div>`,
      `window.ctx.unobserve(); window.ctx.observe(document, { targetStrategy: 'exact', events: ['click'] });`,
    );

    // Click the non-annotated child — should not update focus
    await page.click('#child');

    const focus = await page.evaluate(() => (window as any).ctx.getFocus());
    expect(focus).toBeNull();
  });

  test('clicking annotated element directly does fire', async ({ harness }) => {
    const page = await harness(
      `<div id="card" data-askable='{"widget":"kpi"}' tabindex="0">KPI</div>`,
      `window.ctx.unobserve(); window.ctx.observe(document, { targetStrategy: 'exact', events: ['click'] });`,
    );

    await page.click('#card');

    const meta = await page.evaluate(() => (window as any).ctx.getFocus()?.meta);
    expect(meta).toEqual({ widget: 'kpi' });
  });
});

test.describe('dynamic elements (MutationObserver)', () => {
  test('dynamically appended [data-askable] element becomes trackable', async ({ harness }) => {
    const page = await harness(`<div id="root"></div>`);

    // Append element after observe() is already running
    await page.evaluate(() => {
      const div = document.createElement('div');
      div.setAttribute('data-askable', '{"widget":"dynamic"}');
      div.id = 'dynamic';
      div.tabIndex = 0;
      div.textContent = 'Dynamic';
      document.getElementById('root')!.appendChild(div);
    });

    // Give MutationObserver a tick to attach listeners
    await page.waitForTimeout(50);
    await page.click('#dynamic');

    const meta = await page.evaluate(() => (window as any).ctx.getFocus()?.meta);
    expect(meta).toEqual({ widget: 'dynamic' });
  });

  test('removed element stops tracking', async ({ harness }) => {
    const page = await harness(`
      <div id="card" data-askable='{"widget":"temp"}' tabindex="0">Temp</div>
    `);

    await page.click('#card');
    const beforeMeta = await page.evaluate(() => (window as any).ctx.getFocus()?.meta);
    expect(beforeMeta).toEqual({ widget: 'temp' });

    // Remove the element
    await page.evaluate(() => document.getElementById('card')!.remove());
    await page.waitForTimeout(50);

    // Focus persists (it's in history) but element is gone — getFocus() still returns last value
    // The key assertion is that no error is thrown
    const focusAfter = await page.evaluate(() => {
      try {
        return (window as any).ctx.getFocus()?.meta ?? 'null';
      } catch (e: any) {
        return 'ERROR: ' + e.message;
      }
    });
    expect(String(focusAfter)).not.toContain('ERROR');
  });
});

test.describe('data-askable-text override', () => {
  test('data-askable-text replaces textContent for focus', async ({ harness }) => {
    const page = await harness(`
      <table><tbody><tr>
        <td id="cell" data-askable='{"col":"revenue"}' data-askable-text="Revenue: $2.3M" tabindex="0">
          <span>$</span>2.3<span>M</span>
        </td>
      </tr></tbody></table>
    `);

    await page.click('#cell');

    const text = await page.evaluate(() => (window as any).ctx.getFocus()?.text);
    expect(text).toBe('Revenue: $2.3M');
  });

  test('empty data-askable-text suppresses text', async ({ harness }) => {
    const page = await harness(`
      <table><tbody><tr>
        <td id="cell" data-askable='{"col":"ssn"}' data-askable-text="" tabindex="0">***-**-1234</td>
      </tr></tbody></table>
    `);

    await page.click('#cell');

    const text = await page.evaluate(() => (window as any).ctx.getFocus()?.text);
    expect(text).toBe('');
  });
});

test.describe('select() API', () => {
  test('select() programmatically sets focus', async ({ harness }) => {
    const page = await harness(`
      <div id="widget" data-askable='{"widget":"nps"}'>NPS</div>
    `);

    await page.evaluate(() => {
      const el = document.getElementById('widget') as HTMLElement;
      (window as any).ctx.select(el);
    });

    const meta = await page.evaluate(() => (window as any).ctx.getFocus()?.meta);
    expect(meta).toEqual({ widget: 'nps' });
  });
});

test.describe('clear() and history', () => {
  test('clear() resets current focus to null', async ({ harness }) => {
    const page = await harness(`
      <div id="card" data-askable='{"widget":"kpi"}' tabindex="0">KPI</div>
    `);

    await page.click('#card');
    await page.evaluate(() => (window as any).ctx.clear());

    const focus = await page.evaluate(() => (window as any).ctx.getFocus());
    expect(focus).toBeNull();
  });

  test('history grows with interactions', async ({ harness }) => {
    const page = await harness(`
      <div id="a" data-askable='{"widget":"a"}' tabindex="0">A</div>
      <div id="b" data-askable='{"widget":"b"}' tabindex="0">B</div>
    `);

    await page.click('#a');
    await page.click('#b');

    const histLen = await page.evaluate(() => (window as any).ctx.getHistory().length);
    expect(histLen).toBeGreaterThanOrEqual(2);
  });
});

test.describe('push() API', () => {
  test('push() sets focus with meta and text', async ({ harness }) => {
    const page = await harness(`<div id="root"></div>`);

    await page.evaluate(() => {
      (window as any).ctx.push({ widget: 'deals-table', rowIndex: 3 }, 'Acme Corp');
    });

    const focus = await page.evaluate(() => {
      const f = (window as any).ctx.getFocus();
      return f ? { meta: f.meta, text: f.text, source: f.source, hasElement: !!f.element } : null;
    });

    expect(focus).not.toBeNull();
    expect(focus!.meta).toEqual({ widget: 'deals-table', rowIndex: 3 });
    expect(focus!.text).toBe('Acme Corp');
    expect(focus!.source).toBe('push');
    expect(focus!.hasElement).toBe(false);
  });

  test('push() with plain string meta', async ({ harness }) => {
    const page = await harness(`<div id="root"></div>`);

    await page.evaluate(() => {
      (window as any).ctx.push('row-label');
    });

    const meta = await page.evaluate(() => (window as any).ctx.getFocus()?.meta);
    expect(meta).toBe('row-label');
  });

  test('push() emits focus event', async ({ harness }) => {
    const page = await harness(`<div id="root"></div>`);

    const eventData = await page.evaluate(() => {
      return new Promise<any>((resolve) => {
        (window as any).ctx.on('focus', (f: any) => {
          resolve({ meta: f.meta, source: f.source });
        });
        (window as any).ctx.push({ id: 'row-5' }, 'Row data');
      });
    });

    expect(eventData.meta).toEqual({ id: 'row-5' });
    expect(eventData.source).toBe('push');
  });

  test('push() entries appear in history', async ({ harness }) => {
    const page = await harness(`<div id="root"></div>`);

    await page.evaluate(() => {
      (window as any).ctx.push({ id: 'a' }, 'A');
      (window as any).ctx.push({ id: 'b' }, 'B');
    });

    const history = await page.evaluate(() =>
      (window as any).ctx.getHistory().map((f: any) => f.meta.id)
    );

    expect(history).toEqual(['b', 'a']);
  });

  test('push() focus renders in toPromptContext()', async ({ harness }) => {
    const page = await harness(`<div id="root"></div>`);

    await page.evaluate(() => {
      (window as any).ctx.push({ metric: 'revenue' }, '$2.3M');
    });

    const prompt = await page.evaluate(() => (window as any).ctx.toPromptContext());
    expect(prompt).toContain('revenue');
    expect(prompt).toContain('$2.3M');
  });
});

test.describe('source field', () => {
  test('DOM click sets source to "dom"', async ({ harness }) => {
    const page = await harness(`
      <div id="card" data-askable='{"widget":"kpi"}' tabindex="0">KPI</div>
    `);

    await page.click('#card');

    const source = await page.evaluate(() => (window as any).ctx.getFocus()?.source);
    expect(source).toBe('dom');
  });

  test('select() sets source to "select"', async ({ harness }) => {
    const page = await harness(`
      <div id="card" data-askable='{"widget":"nps"}'>NPS</div>
    `);

    await page.evaluate(() => {
      (window as any).ctx.select(document.getElementById('card'));
    });

    const source = await page.evaluate(() => (window as any).ctx.getFocus()?.source);
    expect(source).toBe('select');
  });

  test('push() sets source to "push"', async ({ harness }) => {
    const page = await harness(`<div id="root"></div>`);

    await page.evaluate(() => {
      (window as any).ctx.push({ id: 'row' });
    });

    const source = await page.evaluate(() => (window as any).ctx.getFocus()?.source);
    expect(source).toBe('push');
  });

  test('source is preserved in history across mixed origins', async ({ harness }) => {
    const page = await harness(
      `<div id="card" data-askable='{"widget":"dom-card"}' tabindex="0">Card</div>`,
      `window.ctx.unobserve(); window.ctx.observe(document, { events: ['click'] });`,
    );

    await page.click('#card');
    await page.evaluate(() => {
      (window as any).ctx.select(document.getElementById('card')!);
      (window as any).ctx.push({ via: 'push' });
    });

    const sources = await page.evaluate(() =>
      (window as any).ctx.getHistory().map((f: any) => f.source)
    );
    // newest first: push, select, dom
    expect(sources).toEqual(['push', 'select', 'dom']);
  });
});

test.describe('toContext() combined output', () => {
  test('without history matches toPromptContext() with label', async ({ harness }) => {
    const page = await harness(`
      <div id="card" data-askable='{"metric":"churn"}' tabindex="0">Churn</div>
    `);

    await page.click('#card');

    const [toCtx, prompt] = await page.evaluate(() => [
      (window as any).ctx.toContext(),
      (window as any).ctx.toPromptContext(),
    ]);

    expect(toCtx).toBe(`Current: ${prompt}`);
  });

  test('with history includes labeled sections', async ({ harness }) => {
    const page = await harness(`
      <div id="a" data-askable='{"id":"a"}' tabindex="0">A</div>
      <div id="b" data-askable='{"id":"b"}' tabindex="0">B</div>
    `);

    await page.click('#a');
    await page.click('#b');

    const output = await page.evaluate(() =>
      (window as any).ctx.toContext({ history: 5 })
    );

    expect(output).toContain('Current:');
    expect(output).toContain('Recent interactions:');
    expect(output).toContain('[1]');
  });

  test('respects custom labels', async ({ harness }) => {
    const page = await harness(`<div id="root"></div>`);

    await page.evaluate(() => {
      (window as any).ctx.push({ id: 'a' }, 'A');
      (window as any).ctx.push({ id: 'b' }, 'B');
    });

    const output = await page.evaluate(() =>
      (window as any).ctx.toContext({ history: 5, currentLabel: 'Now', historyLabel: 'Before' })
    );

    expect(output).toMatch(/^Now:/);
    expect(output).toContain('Before:');
  });
});

test.describe('toPromptContext() serialization', () => {
  test('natural format — default', async ({ harness }) => {
    const page = await harness(`
      <div id="card" data-askable='{"metric":"revenue","value":"$128k"}' tabindex="0">Revenue</div>
    `);

    await page.click('#card');

    const prompt = await page.evaluate(() => (window as any).ctx.toPromptContext());
    expect(prompt).toContain('User is focused on:');
    expect(prompt).toContain('metric: revenue');
    expect(prompt).toContain('value: $128k');
    expect(prompt).toContain('"Revenue"');
  });

  test('json format', async ({ harness }) => {
    const page = await harness(`
      <div id="card" data-askable='{"widget":"nps"}' tabindex="0">NPS</div>
    `);

    await page.click('#card');

    const prompt = await page.evaluate(() =>
      (window as any).ctx.toPromptContext({ format: 'json' })
    );
    const parsed = JSON.parse(prompt);
    expect(parsed.meta).toEqual({ widget: 'nps' });
    expect(parsed.text).toBe('NPS');
    expect(typeof parsed.timestamp).toBe('number');
  });

  test('excludeKeys omits specified keys', async ({ harness }) => {
    const page = await harness(`
      <div id="card" data-askable='{"widget":"kpi","_id":"abc123"}' tabindex="0">KPI</div>
    `);

    await page.click('#card');

    const prompt = await page.evaluate(() =>
      (window as any).ctx.toPromptContext({ excludeKeys: ['_id'] })
    );
    expect(prompt).not.toContain('_id');
    expect(prompt).toContain('widget: kpi');
  });

  test('no focus returns placeholder string', async ({ harness }) => {
    const page = await harness(`<div id="plain">no askable</div>`);

    const prompt = await page.evaluate(() => (window as any).ctx.toPromptContext());
    expect(prompt).toBe('No UI element is currently focused.');
  });
});
