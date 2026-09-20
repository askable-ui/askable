# AI SDK security migration

Verified on 2026-09-20. Scope: both Next.js examples, the Next.js scaffold
template, and the additive AI examples workflow. No package release version
was changed.

## Version decision

The current stable AI SDK is 7, but this migration deliberately uses the
smallest audited-safe major from the requested 5-or-6 choices.

- Vercel still publishes an `ai-v5` line: `ai@5.0.261` was released on
  September 18. However, a clean install with its matching v2 providers brought
  in `@ai-sdk/provider-utils@3.0.37`, which depends on `undici@^5.29.0`.
  npm audit reported unresolved Undici findings. Using it would require an
  out-of-range transitive major override.
- The maintained `ai-v6` line has `ai@6.0.286`, also released September 18.
  Its matching provider utilities use `undici@^6.28.0`; the tested installs
  resolved `6.28.1` without an override. This is the selected fallback.
- Next.js stays on the Maintenance LTS 15.5 line, with a minimum of `15.5.25`,
  above the August security release's `15.5.24` minimum. React and React DOM
  stay together on the patched 19.1 line at `19.1.9`.
- Next.js 15.5.25 still pins PostCSS 8.4.31. A narrowly scoped `next.postcss`
  override raises it to `^8.5.28`, fixing the current source-map disclosure
  and stringify advisories while staying within PostCSS major 8. Revisit this
  override when Next.js updates its dependency.

| Dependency | Manifest floor | Tested resolution |
| --- | --- | --- |
| ai | ^6.0.286 | 6.0.286 |
| @ai-sdk/react | ^3.0.289 | 3.0.289 |
| @ai-sdk/anthropic | ^3.0.118 | 3.0.118 |
| @ai-sdk/openai | ^3.0.114 | 3.0.114 |
| next | ~15.5.25 | 15.5.25 |
| react / react-dom | ~19.1.9 | 19.1.9 |
| PostCSS under Next.js | ^8.5.28 | 8.5.28 |

Only the providers and React adapter actually used by each app are installed.
The template's Anthropic provider is now a production dependency.

## Sources and API checks

- [Official v4-to-v5 migration](https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0):
  React hook import, local input state, request-level context, message parts,
  UI-message streaming, and explicit OpenAI Chat Completions selection.
- [Official v5-to-v6 migration](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0):
  asynchronous `convertToModelMessages` and matching provider major versions.
- [Official SDK 5 release](https://github.com/vercel/ai/releases/tag/ai%405.0.261)
  and [SDK 6 release](https://github.com/vercel/ai/releases/tag/ai%406.0.286):
  current maintenance evidence, not a promise of a future support window.
- [Vercel's original input-validation advisory](https://vercel.com/changelog/cve-2025-48985-input-validation-bypass-on-ai-sdk).
- [Next.js August 2026 security release](https://nextjs.org/blog/august-2026-security-release).
- [PostCSS source-map advisory](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp).

Checked installed `ai/dist/index.d.ts`, `@ai-sdk/react/dist/index.d.ts`, and
provider types and stream schemas. The three `/api/chat` routes now await
UI-to-model conversion and return UI-message SSE with message IDs. Both
`useChat` clients render text parts and pass current context in `sendMessage`
options, avoiding a transport closure over the first render's focus.
The OpenAI route explicitly uses `openai.chat`, preserving the previous
Chat Completions backend and model. Model names are otherwise unchanged.

`examples/nextjs-app-router/app/api/askable-chat/route.ts` and its client page
are unchanged. Its text stream, history ordering, and single current question
are covered by regression tests.

## Reproduction

Use Node 22.18 or later for native TypeScript loading in the Node test runner.
Validation used Node 22.23.2. Run these commands in each example directory:

```sh
npm ci --workspaces=false
npm test
npm run typecheck
NEXT_TELEMETRY_DISABLED=1 OPENAI_API_KEY= ANTHROPIC_API_KEY= npm run build
npm audit --workspaces=false
```

Generate the template through the real CLI from a separate temporary working
directory, using the absolute path to this checkout's
`packages/create-askable-app/bin/create-askable-app.js`:

```sh
node /path/to/askable/packages/create-askable-app/bin/create-askable-app.js ai-template --template nextjs
cd ai-template
npm install --package-lock-only --workspaces=false
```

Then run the same five validation commands. The template intentionally has no
checked-in lockfile containing placeholders. Each generated application resolves
its own lock, then CI performs a clean `npm ci`. Example lockfiles are committed.

| App | Clean install | Route/stream tests | Typecheck | Production build | npm audit |
| --- | --- | --- | --- | --- | --- |
| nextjs-app-router | pass | 6 passed | pass | pass | 0 findings |
| vercel-ai-sdk | pass | 4 passed | pass | pass | 0 findings |
| generated ai-template | pass | 4 passed | pass | pass | 0 findings |

The tests exercise the installed providers, route handlers, UI stream parser,
multi-turn history, changed context, missing context, masked provider failures,
and malformed JSON. Fetch is replaced with in-memory provider responses;
unexpected URLs fail closed. The only keys used are explicit fake test values.
Additional local Chromium checks against all three production builds verified
current focus, text rendering, two turns, disabled inputs while pending, cleared
inputs, and no page errors. Both migrated hook clients also passed generic error
display and recovery checks. Browser responses were intercepted locally.

The existing scaffold suite passed all 6 tests without modifications.
`actionlint` 1.7.12 accepted the new workflow. It runs the validation commands in
three independent, 15-minute Node 22 jobs, with read-only repository permission,
no stored checkout credentials, no provider secrets, and no inference step.

## Limitations

- No live model calls, credentials, remote CI run, or deployment was used.
- The npm audit result is a point-in-time dependency check, not a guarantee that
  the application has no security issues. Other repository dependencies and
  remote Dependabot alert states are outside this change.
- Existing demo endpoint authentication, rate limits, and input-validation
  policies were not expanded as part of this compatibility migration.
- Next.js emits a harmless multiple-lockfile root inference warning for the
  in-repository examples and an Edge static-generation warning where applicable.
  Node emits a module-type detection warning when directly testing route files.
- Root manifests/lockfiles, release versions, and other agents' files are
  untouched. No remote push, PR, merge, or alert dismissal is part of this work.

## Changed files

Paths below are relative to the repository root:

```text
.github/workflows/test_ai_examples.yml
examples/nextjs-app-router/.gitignore
examples/nextjs-app-router/app/api/chat/route.ts
examples/nextjs-app-router/package-lock.json
examples/nextjs-app-router/package.json
examples/nextjs-app-router/test/chat.test.mjs
examples/nextjs-app-router/tsconfig.json
examples/vercel-ai-sdk/.gitignore
examples/vercel-ai-sdk/README.md
examples/vercel-ai-sdk/SECURITY-MIGRATION.md
examples/vercel-ai-sdk/app/api/chat/route.ts
examples/vercel-ai-sdk/app/page.tsx
examples/vercel-ai-sdk/package-lock.json
examples/vercel-ai-sdk/package.json
examples/vercel-ai-sdk/test/chat.test.mjs
packages/create-askable-app/template-nextjs/_gitignore
packages/create-askable-app/template-nextjs/app/api/chat/route.ts
packages/create-askable-app/template-nextjs/app/page.tsx
packages/create-askable-app/template-nextjs/package.json
packages/create-askable-app/template-nextjs/test/chat.test.mjs
packages/create-askable-app/template-nextjs/tsconfig.json
```
