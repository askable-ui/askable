# Contributing to askable-ui

Thanks for your interest in contributing!

## Development setup

```bash
git clone https://github.com/askable-ui/askable.git
cd askable
npm install
```

## Build

```bash
# Build all packages (core must build first)
npm run build -w packages/core
npm run build --workspaces --if-present
```

## Test

```bash
# Unit tests
npm test

# Cross-browser E2E tests (Chromium / Firefox / WebKit)
npm run test:e2e

# Performance benchmark
node packages/core/bench/perf.mjs
```

## Branch naming

`feat/...` / `fix/...` / `chore/...` — open a PR against `main`.

## PR process

1. Fork the repo and create your branch from `main`
2. Make your changes and add tests if applicable
3. Ensure `npm test` and `npm run build` pass
4. Open a PR — CI will run automatically
5. One approval required for merge
