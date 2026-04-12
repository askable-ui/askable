# Performance Budget — @askable-ui/core

Askable is positioned as a lightweight, browser-native context layer. This document defines explicit
performance contracts that all contributors must preserve. New features are evaluated against these
budgets before merging.

## Budget table

| Operation | Budget | Notes |
|---|---|---|
| `observe(1k elements)` | **20ms** | Initial DOM scan + listener attach |
| `observe(5k elements)` | **80ms** | |
| `observe(10k elements)` | **160ms** | Scales linearly; avoid annotating >5k elements |
| Event handler p99 (click/hover/focus) | **0.5ms** | Per-event cost at 1k annotated elements |
| Repeated event handler p99 (same element) | **0.2ms** | Hot path for repeated hover/click on already-seen elements |
| `toPromptContext()` — natural | **0.2ms** | Serialization call (median over 1k runs) |
| `toPromptContext()` — json | **0.2ms** | |
| `MutationObserver` batch (100 nodes) | **10ms** | Bulk DOM insertion, includes MO flush overhead |
| `unobserve(1k)` | **10ms** | Listener teardown |

Budgets are measured under **JSDOM** (Node.js), which is typically 3–5× slower than real Chromium
for DOM operations. The Playwright e2e suite validates real-browser behaviour.

## Running benchmarks

```bash
# Run and print results (no pass/fail enforcement)
node packages/core/bench/perf.mjs

# Enforce budgets — exits with code 1 if any budget is exceeded
node packages/core/bench/perf.mjs --budget

# Or via npm script
npm run bench -w packages/core
```

## Design rules

These rules are derived from the budgets above and should guide implementation decisions:

1. **One MutationObserver per `observe()` call.** Never create multiple observers for the same root.

2. **Listeners attach only to `[data-askable]` elements.** Never attach to `document` or `window` for
   the interaction events — that would make every click in the app go through Askable's handler.

3. **`toPromptContext()` is a pure function.** It reads from an in-memory object and does no DOM access.
   Serialization must complete in sub-millisecond time regardless of history length.

4. **Do not annotate high-cardinality collections at the cell level.** A 10,000-row table with
   `data-askable` on every `<td>` (10 cols) would attach 100,000 listeners. Annotate at the `<tr>` or
   group level instead.

5. **`unobserve()` must be O(n) in annotated elements, not O(DOM size).** The observer maintains its
   own set of bound elements and detaches only those — it does not re-scan the DOM.

6. **History is capped at `MAX_HISTORY` (currently 50).** The cap prevents unbounded memory growth in
   long-lived sessions. A configurable `maxHistory` option is planned (#83).

7. **Parsed `data-askable` metadata is cached per element and invalidated on attribute changes.**
   Repeated interactions over the same annotated element should not re-parse identical metadata.

## Lazy text extraction decision

Lazy text extraction is **not shipping by default in this phase**.

Reasoning:

- metadata parsing was the low-risk, clear win for repeated interactions
- eager text capture preserves current `getFocus()`, history, events, and serialization semantics
- changing text capture timing would need a cross-adapter API decision and real-browser profiling to
  prove it is worth the complexity

We should revisit lazy text extraction only if profiling shows text extraction, not metadata parsing,
is the dominant hot path in representative large UIs.

## Adding a new budget

When introducing a new operation that has performance implications:

1. Add a measurement block to `packages/core/bench/perf.mjs`
2. Add an entry to `BUDGETS` with a justified limit
3. Document the entry in this file
4. Run `node packages/core/bench/perf.mjs --budget` before opening the PR

## CI enforcement

The benchmark runs in CI on every PR via `.github/workflows/ci.yml` (the `perf-budget` job).
A budget violation blocks merge.
