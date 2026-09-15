# What’s New in v0.17.3

This patch fixes the MCP command-line server exiting silently when launched by
`npx` or an installed npm executable. The entry-point check now resolves symlinks
and handles paths containing spaces or URL characters. Library imports are unchanged.

Release checks now launch the installed executable, verify argument handling, and
exchange Context packets with a real MCP client over stdio, including redaction enforcement.

## Upgrade to v0.17.3

```bash
npm install @askable-ui/core@^0.17.3 @askable-ui/react@^0.17.3
npm install @askable-ui/bridge@^0.17.3 @askable-ui/mcp@^0.17.3
npx @askable-ui/mcp@0.17.3 --help
```

Command-based MCP integrations should use `0.17.3` or newer. No API migration is required.
Current docs are published at `/docs/` and `/docs/v0.17.3/`.

## Also in v0.17.2

This security and reliability patch closes privacy bypasses and brings the
published packages up to date with the bridge protections in the documentation.

## Privacy boundaries

- MCP validates complete Context packets before tools, resources, or page
  responses can return them. `requireRedacted` requires an explicit `true` value.
- Page callers can no longer override host-owned privacy, provenance, or
  sanitization options. Configure those options on the app's provider instead.
- User source summaries now use the same omitted fields and sanitizer as the
  profile data. React page and user sources use updated callbacks after rerenders.
- Bridge transports include explicit target origins, envelope validation,
  consent and redaction gates, and agent-request delivery.

Redaction is still an assertion by the host app, not an automatic content
filter. Sanitize captured content before marking a packet as redacted.

## Reliability

- Focus sources render safely on the server and clean up pending blur timers.
- Source cancellation works without requiring a timeout.
- Budgeted JSON is reduced before serialization, preserving parseable JSON.
- The browser extension example bundles its content script as a standalone
  classic script, with unpacked Chromium capture tests.
- Production dependencies, the React scaffold, and dashboard dependencies have
  security updates. Release checks exercise isolated installations of npm tarballs.

## Upgrade to v0.17.2

```bash
npm install @askable-ui/core@^0.17.2 @askable-ui/react@^0.17.2
npm install @askable-ui/bridge@^0.17.2 @askable-ui/mcp@^0.17.2
```

When using `createPostMessageTransport`, provide the destination's exact
`targetOrigin`. In browsers, the default is the sending page's origin. Outside
a browser, an omitted origin now rejects the send instead of broadcasting. See the
[bridge API](/api/bridge) and [MCP privacy guidance](/guide/mcp) before upgrading
an integration that supplies custom packets or page-bridge options.

## Also in v0.17.1

askable-ui v0.17.1 completes the bridge package release after npm rejected the first
new-package trusted-publisher publish. It keeps all Askable packages aligned and
makes `@askable-ui/bridge` installable from npm.

## Highlights

### Bridge package availability

`@askable-ui/bridge` is now available from npm at the same version line as the
rest of Askable. Use this patch if you want to install the provider-neutral
bridge package.

```bash
npm install @askable-ui/bridge@^0.17.1
```

## Also in v0.17.0

### Provider-neutral context bridge

`@askable-ui/bridge` gives Askable a transport layer between captured UI context
and the place the user wants to ask a question. It works with the open Context
packet format and stays independent of any single chatbot SDK.

```ts
import { createAskableBridge, createFunctionTransport } from '@askable-ui/bridge';

const bridge = createAskableBridge({
  provider: {
    getPacket: () => ctx.toContextPacket(),
    formatPrompt: () => ctx.toPromptContext(),
  },
  transports: [
    createFunctionTransport(async ({ payload }) => {
      await sendChatMessage({
        question: payload.question,
        context: payload.prompt,
        packet: payload.packet,
      });
    }),
  ],
});

await bridge.sendPrompt('Explain this selected account.');
```

The package ships function, browser extension, `postMessage`, and HTTP
transports. Custom transports can forward the same envelope to side panels,
workers, native shells, local MCP companions, or provider-specific chat adapters.

See [Bridge Context to Chat](/guide/bridge) and the
[`@askable-ui/bridge` API reference](/api/bridge) for the full contract.

### Bridge and MCP together

Use `@askable-ui/bridge` to move packets out of the page. Use `@askable-ui/mcp`
when those packets should be exposed as MCP tools and resources for Claude,
ChatGPT connectors, Cursor, or local clients.

Most browser-local MCP setups use both:

- the bridge sends the current packet from the page to a trusted extension or
  local companion;
- MCP exposes that packet as `get_current_context`,
  `format_context_for_prompt`, and `askable://current`.

### Release and audit maintenance

This release also:

- includes `@askable-ui/bridge` in preview package publishing;
- includes `@askable-ui/bridge` in trusted-publisher release publishing;
- updates MCP transitive dependencies that were failing the production audit;
- updates the docs lockfile dependency that was failing the docs audit.

## Also in v0.16.0

askable-ui v0.16.0 makes Qwik integrations genuinely resumable, expands the MCP
package into a command-line server with live resources, and publishes the
Context Packet Protocol as a first-class specification. It also includes a
broad reliability and security pass across the framework adapters, MCP bridge,
and browser sources.

### v0.16.0 highlights

### Resumable Qwik actions

Imperative actions returned by `@askable-ui/qwik` hooks are now Qwik `QRL`
values. They can be invoked safely from optimizer-generated event handlers and
after browser resume without capturing non-serializable closures.

```tsx
import { $, component$, sync$ } from '@builder.io/qwik';
import { useAskableStream, useAskableTableSource } from '@askable-ui/qwik';

export default component$(() => {
  const stream = useAskableStream({
    sanitizeText: sync$((text) => text.trim()),
  });
  const table = useAskableTableSource({
    rows: $(() => [{ id: 'order-1', total: 42 }]),
  });

  return (
    <button onClick$={async () => {
      await table.notifyChanged();
      await stream.stream(
        'Summarize the visible orders',
        $(async (_request, emit, signal) => {
          if (!signal.aborted) emit('Ready');
        }),
      );
    }}>
      Ask
    </button>
  );
});
```

Qwik callback options use `$()` for asynchronous callbacks and `sync$()` for
synchronous callbacks. Mutation actions are asynchronous because a resumed QRL
may need to load its implementation chunk. The package now requires Qwik 1.6 or
newer so its public declarations can use `SyncQRL`.

The Qwik lifecycle also now:

- creates browser-owned contexts only from visible tasks;
- keeps runtime objects behind `NoSerialize` references;
- suppresses stale stream/chat results when a newer request takes ownership;
- aborts active handlers during cleanup;
- prevents late asynchronous source factories from registering after release;
- unregisters source handles exactly once.

See the [Qwik guide](/guide/qwik) for the complete callback and lifecycle model.

### MCP command-line server and live resources

`@askable-ui/mcp` now ships a stdio CLI for command-based MCP clients. Point it
at an HTTP endpoint or a Context packet file:

```bash
npx @askable-ui/mcp --url http://localhost:3000/api/context
npx @askable-ui/mcp --file ./context-packet.json --require-redacted
```

The MCP server adds a live `askable://current` resource and a
`list_context_sources` tool, while preserving prompt-ready formatting and
redaction enforcement. The package also ships a schema-validated MCP Registry
manifest for registry submission and downstream distribution.

### Context Packet Protocol and source guides

The documentation now treats Context packets as a versioned, framework-neutral
protocol rather than only a library implementation detail. New guides cover:

- the [Context Packet Protocol specification](/guide/protocol);
- [custom context sources](/guide/sources);
- [cart and multistep sources](/guide/cart-multistep);
- [React Native integration](/guide/react-native);
- browser-local and remote [MCP integration](/guide/mcp).

The React, Vue, Svelte, SolidJS, and Qwik packages also re-export
`a11yTextExtractor` so accessible text extraction is discoverable without a
separate core import.

### v0.16.0 reliability and security

This release includes fixes for:

- stale React navigation callbacks after option changes;
- adapter context option leakage between independently configured hooks;
- Qwik context access before the browser-visible lifecycle;
- byte-based MCP request limits for multibyte payloads;
- unsafe storage masking defaults and page-bridge target-origin handling;
- production dependency vulnerabilities;
- verified issues across create-app, Svelte, React, Vue, MCP, and Context packet
  handling.

### v0.16.0 upgrade notes

Keep all Askable packages on the same release line:

```bash
npm install @askable-ui/core@^0.16.0 @askable-ui/react@^0.16.0
```

For Qwik applications:

```bash
npm install @askable-ui/qwik@^0.16.0 @builder.io/qwik@^1.6.0
```

Update Qwik callback options to `$()` or `sync$()` and `await` imperative hook
actions where ordering matters. No migration is required for the other
framework packages beyond updating their aligned package versions.

See the [current upgrade instructions](#upgrade-to-v0-17-3) for the latest release.
