# Contributing to askable-ui

Thanks for wanting to contribute! This is a focused library solving a very specific problem — giving AI assistants real-time context about what users are looking at in a web app. PRs, issues, and examples are all welcome.

## What we're building

askable-ui solves a gap between modern AI chat interfaces and the UIs they're embedded in:

- The user clicks a metric card → the AI doesn't know which one
- The user highlights a table row → the AI gets no signal
- The user draws a region on a chart → the AI sees nothing

The library captures these interactions as structured JSON (`data-askable` → Context packet) and makes that packet available to any LLM via a React/Vue/Svelte hook, the MCP server, or a plain string via `toPromptContext()`.

## Project structure

```
packages/
  context/          — WebContextPacket types and createWebContextPacket()
  core/             — framework-agnostic context tracker (AskableContext, capture, selection)
  react/            — React hooks (useAskable, useAskableRegionCapture, ...)
  vue/              — Vue 3 composables (useAskable, <Askable>)
  svelte/           — Svelte 4 stores + Svelte 5 runes (createAskableStore, useAskable.svelte)
  solid/            — SolidJS primitives (useAskable, useAskableViewport, <Askable>)
  angular/          — Angular 16+ injectable service + directive (AskableService, AskableDirective)
  web-component/    — <askable-context> custom element (zero build step, any framework)
  react-native/     — React Native scroll context hook
  mcp/              — MCP server, web handler, page bridge
  create-askable-app/ — CLI scaffolder (npm create @askable-ui/app)
examples/
  analytics-dashboard-react/  — full Next.js + CopilotKit demo
  vercel-ai-sdk/              — minimal Next.js + Vercel AI SDK integration
  vue-dashboard/              — Vue 3 + Vite dashboard
  solid-dashboard/            — SolidJS + Vite dashboard
  angular-dashboard/          — Angular 19 + standalone components
  nextjs-app-router/          — Next.js 15 App Router + Vercel AI SDK streaming chat
  svelte-dashboard/           — Svelte 5 runes dashboard
  vanilla-chat/               — zero-dependency HTML demo
  mcp-server/                 — standalone MCP server + Express quickstart
  react-native-expo/          — React Native / Expo mobile demo
site/
  www/index.html              — marketing landing page
```

## Development setup

```bash
git clone https://github.com/askable-ui/askable.git
cd askable
npm install
```

## Build

```bash
# Build core first (other packages depend on it)
npm run build -w packages/context
npm run build -w packages/core

# Build everything else
npm run build --workspaces --if-present
```

## Tests

```bash
# Unit tests (runs vitest across all packages)
npm test

# E2E tests (Playwright, Chromium / Firefox / WebKit)
npm run test:e2e

# Performance benchmark
node packages/core/bench/perf.mjs
```

## Good first contributions

- **Add a framework example** — we have React, Vue, Svelte, SolidJS, Angular. A Qwik or HTMX example would be great.
- **Improve the vanilla demo** — `examples/vanilla-chat/` is self-contained HTML. Easy to fork and extend.
- **Add a recipe** — show how to wire askable-ui with a specific LLM SDK (Vercel AI SDK, LangChain, etc.)
- **Fix a bug** — check [open issues](https://github.com/askable-ui/askable/issues) labeled `bug`.
- **Improve docs** — clearer examples, better JSDoc, fixing typos.
- **Add tests** — look for areas with low test coverage in `packages/core/src/`.

## Design philosophy

**1. Framework-agnostic core.**
All the real logic lives in `@askable-ui/core`. Framework packages are thin adapters (usually < 200 lines) that wrap the core API.

**2. Zero dependencies on the AI layer.**
The library produces a plain string (`toPromptContext()`) or structured packet. It doesn't know about OpenAI, Anthropic, or CopilotKit — those are wired up by the consumer.

**3. Opt-in privacy.**
Capture only happens on explicit user interaction. The `privacy` field on every packet lets consumers gate what leaves the page. `requireRedacted: true` on the MCP server blocks un-scrubbed packets.

**4. No opinions on state management.**
We use vanilla event listeners and refs internally. The React package uses `useRef` + `useState`, not Redux or Zustand.

**5. Structured, not stringified.**
The `data-askable` attribute holds a JSON object with typed fields. This lets agents reason about exact values rather than parsing natural language.

## Adding a new framework adapter

1. Copy the pattern from `packages/vue/src/` — the composable wraps `createAskableContext()` and subscribes to context changes
2. Re-export types from `@askable-ui/core`
3. Add a `peerDependencies` entry for the framework
4. Add at least one test (see `packages/react/src/__tests__/` for examples)
5. Add a matching example under `examples/`
6. Update the integrations table in `README.md`

## Branch naming and PR process

- Branch from `main`: `feat/...`, `fix/...`, `docs/...`, `chore/...`
- All checks must pass before merge: typecheck, unit tests, E2E, check-binaries
- PRs need one approval from a maintainer
- Keep PRs focused — one logical change per PR is easier to review

## Commit style

Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`.

```
feat(react): add useAskableSource hook for app-owned data sources
fix(core): prevent duplicate removeAffordance call on capture
docs: update MCP quickstart with auth example
```

## Releasing

Releases are automated via Changesets + GitHub Actions. Maintainers handle version bumps — contributors don't need to worry about this.

## Questions?

Open a [GitHub Discussion](https://github.com/askable-ui/askable/discussions) or a draft PR — happy to give early feedback.
