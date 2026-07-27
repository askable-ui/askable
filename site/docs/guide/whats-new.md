# What’s New in v0.16.0

askable-ui v0.16.0 makes Qwik integrations genuinely resumable, expands the MCP
package into a command-line server with live resources, and publishes the
Context Packet Protocol as a first-class specification. It also includes a
broad reliability and security pass across the framework adapters, MCP bridge,
and browser sources.

## Highlights

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

## Reliability and security

This release includes fixes for:

- stale React navigation callbacks after option changes;
- adapter context option leakage between independently configured hooks;
- Qwik context access before the browser-visible lifecycle;
- byte-based MCP request limits for multibyte payloads;
- unsafe storage masking defaults and page-bridge target-origin handling;
- production dependency vulnerabilities;
- verified issues across create-app, Svelte, React, Vue, MCP, and Context packet
  handling.

## Upgrade

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

The current docs are published at both:

- `/docs/`
- `/docs/v0.16.0/`
