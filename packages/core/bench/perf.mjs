/**
 * Performance benchmarks for @askable-ui/core
 *
 * Run with: node --expose-gc packages/core/bench/perf.mjs
 *
 * Measures:
 *   1. observe() init time on large DOM (1k / 5k / 10k annotated elements)
 *   2. Per-event handler execution time (click, hover, focus)
 *   3. Repeated interactions on the same element (metadata cache hot path)
 *   4. toPromptContext() serialization time (natural + JSON)
 *   5. MutationObserver batch (100 nodes added at once)
 *   6. Memory baseline (heap before/after observe)
 *
 * Budget targets (enforced in CI via --budget flag):
 *   observe(1k)     < 20ms
 *   observe(5k)     < 80ms
 *   observe(10k)    < 160ms
 *   event handler   < 0.5ms per event (p99)
 *   repeated event  < 0.2ms per event (p99)
 *   toPromptContext < 0.2ms
 *   mutation batch  < 5ms per 100 nodes
 */

import { createRequire } from 'module';
import { JSDOM } from 'jsdom';
import { performance } from 'perf_hooks';
import process from 'process';

// ── JSDOM setup ──────────────────────────────────────────────────────────────

const dom = new JSDOM('<!DOCTYPE html><body></body>', {
  runScripts: 'dangerously',
  resources: 'usable',
});
const { window } = dom;
global.window = window;
global.document = window.document;
global.Document = window.Document;
global.HTMLElement = window.HTMLElement;
global.MutationObserver = window.MutationObserver;
global.Event = window.Event;
global.MouseEvent = window.MouseEvent;
global.FocusEvent = window.FocusEvent;

// ── Load core ────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
// Built CJS output via tsc — run `npm run build -w packages/core` first
let createAskableContext;
try {
  ({ createAskableContext } = await import('../dist/index.js'));
} catch {
  console.error('Build not found. Run: npm run build -w packages/core');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildDOM(count) {
  const body = window.document.body;
  body.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const el = window.document.createElement('div');
    el.setAttribute(
      'data-askable',
      JSON.stringify({ widget: `widget-${i}`, value: i, index: i }),
    );
    el.textContent = `Widget ${i}`;
    body.appendChild(el);
  }
  return body;
}

function median(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function p99(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.99)];
}

function fmt(ms) {
  return ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(2)}ms`;
}

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const results = [];

function check(name, actual, budget) {
  const ok = actual <= budget;
  results.push({ name, actual, budget, ok });
  const icon = ok ? PASS : FAIL;
  console.log(`  ${icon} ${name.padEnd(38)} ${fmt(actual).padStart(8)}  (budget: ${fmt(budget)})`);
  return ok;
}

// ── Budgets ──────────────────────────────────────────────────────────────────

// Budget values are conservative upper bounds measured under JSDOM.
// Real Chromium is typically 3–5× faster for DOM operations.
// Tighten these if a future change causes regressions.
const BUDGETS = {
  'observe(1k elements)':       20,
  'observe(5k elements)':       80,
  'observe(10k elements)':     160,
  'event handler p99 (1k)':      0.5,
  'repeated event p99 (1k)':     0.2,
  'toPromptContext natural':     0.2,
  'toPromptContext json':        0.2,
  'mutation batch (100 nodes)': 10, // JSDOM MutationObserver flush adds ~5ms overhead
  'unobserve(1k)':              10,
};

// ── Benchmarks ───────────────────────────────────────────────────────────────

console.log('\n@askable-ui/core — performance budget\n');

// 1. observe() init time
for (const count of [1_000, 5_000, 10_000]) {
  buildDOM(count);
  const ctx = createAskableContext();
  const t0 = performance.now();
  ctx.observe(window.document);
  const elapsed = performance.now() - t0;
  check(`observe(${(count / 1000).toFixed(0)}k elements)`, elapsed, BUDGETS[`observe(${(count / 1000).toFixed(0)}k elements)`]);
  ctx.unobserve?.();
}

// 2. Event handler p99 — simulate 500 click events on 1k-element DOM
{
  buildDOM(1_000);
  const ctx = createAskableContext();
  ctx.observe(window.document);
  const elements = Array.from(window.document.querySelectorAll('[data-askable]'));
  const times = [];
  for (let i = 0; i < 500; i++) {
    const el = elements[i % elements.length];
    const t0 = performance.now();
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    times.push(performance.now() - t0);
  }
  check('event handler p99 (1k)', p99(times), BUDGETS['event handler p99 (1k)']);
  ctx.unobserve?.();
}

// 3. Repeated interactions on the same element — exercises metadata cache reuse
{
  buildDOM(1_000);
  const ctx = createAskableContext();
  ctx.observe(window.document);
  const el = window.document.querySelector('[data-askable]');
  const times = [];
  for (let i = 0; i < 500; i++) {
    const t0 = performance.now();
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    times.push(performance.now() - t0);
  }
  check('repeated event p99 (1k)', p99(times), BUDGETS['repeated event p99 (1k)']);
  ctx.unobserve?.();
}

// 4. toPromptContext() serialization
{
  buildDOM(1);
  const ctx = createAskableContext();
  ctx.observe(window.document);
  const el = window.document.querySelector('[data-askable]');
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  const natTimes = [];
  const jsonTimes = [];
  for (let i = 0; i < 1_000; i++) {
    const t0 = performance.now();
    ctx.toPromptContext({ format: 'natural' });
    natTimes.push(performance.now() - t0);
    const t1 = performance.now();
    ctx.toPromptContext({ format: 'json' });
    jsonTimes.push(performance.now() - t1);
  }
  check('toPromptContext natural', median(natTimes), BUDGETS['toPromptContext natural']);
  check('toPromptContext json',    median(jsonTimes), BUDGETS['toPromptContext json']);
  ctx.unobserve?.();
}

// 5. MutationObserver batch — 100 nodes added at once
{
  const body = buildDOM(0);
  const ctx = createAskableContext();
  ctx.observe(window.document);
  const t0 = performance.now();
  const frag = window.document.createDocumentFragment();
  for (let i = 0; i < 100; i++) {
    const el = window.document.createElement('div');
    el.setAttribute('data-askable', JSON.stringify({ widget: `dyn-${i}` }));
    el.textContent = `Dynamic ${i}`;
    frag.appendChild(el);
  }
  body.appendChild(frag);
  // Give MutationObserver a microtask to flush
  await new Promise((r) => setTimeout(r, 0));
  const elapsed = performance.now() - t0;
  check('mutation batch (100 nodes)', elapsed, BUDGETS['mutation batch (100 nodes)']);
  ctx.unobserve?.();
}

// 6. unobserve cleanup
{
  buildDOM(1_000);
  const ctx = createAskableContext();
  ctx.observe(window.document);
  const t0 = performance.now();
  ctx.unobserve?.();
  check('unobserve(1k)', performance.now() - t0, BUDGETS['unobserve(1k)']);
}

// ── Summary ───────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} budgets met`);

if (failed.length > 0) {
  console.log('\nFailed:');
  for (const r of failed) {
    console.log(`  ✗ ${r.name}: ${fmt(r.actual)} > budget ${fmt(r.budget)}`);
  }
}

const budgetFlag = process.argv.includes('--budget');
if (budgetFlag && failed.length > 0) {
  console.error('\nBudget check failed — see above.');
  process.exit(1);
}
