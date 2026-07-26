# @askable-ui/qwik

Qwik hooks and components for **askable-ui**. Turn explicitly selected or
focused UI into structured context for AI assistants.

```bash
npm install @askable-ui/qwik @askable-ui/core
```

## Usage

```tsx
import { component$ } from '@builder.io/qwik';
import { Askable, useAskable } from '@askable-ui/qwik';

export default component$(() => {
  const { promptContext } = useAskable();

  return (
    <>
      <Askable meta={{ metric: 'revenue', value: '$2.34M' }}>
        <article>Revenue: $2.34M</article>
      </Askable>
      <pre>{promptContext.value}</pre>
    </>
  );
});
```

Use `useAskableAgent()` when a question should be sent with the current UI
context:

```tsx
const agent = useAskableAgent();

await agent.send('Explain this metric', (request) =>
  fetch('/api/ai', {
    method: 'POST',
    body: JSON.stringify(request),
  }).then((response) => response.json()),
);
```

## API

| Export | Purpose |
| --- | --- |
| `useAskable(options?)` | Reactive focus and prompt context signals |
| `useAskableAgent(options?)` | Package questions with current UI context |
| `<Askable meta={...}>` | Annotate rendered UI with `data-askable` |
| `asMeta<T>(focus)` | Read typed focus metadata |

### Context sharing and isolation

Default hooks share a context by `name + events + viewport`. An unnamed hook that supplies `maxHistory`, `sanitizeMeta`, `sanitizeText`, `sanitizeSource`, or `textExtractor` receives a private context so capture and privacy configuration cannot affect unrelated consumers. Supplying `name` explicitly opts into sharing for the same `events` + `viewport` configuration, and that configuration's first mounted consumer supplies its creation options.

### Context lifecycle

Qwik initializes the DOM-backed context in a visible task. `ctxRef` is the stable
signal for lifecycle-aware integrations; its value is `undefined` during SSR and
is populated after the component mounts. Read `ctx` only from browser actions or
visible tasks—do not destructure it during component render:

```tsx
const askable = useAskable();

// Safe in an event handler after the component is visible.
const readPrompt = () => askable.ctx.toPromptContext();

// For reactive lifecycle code:
const ctx = askable.ctxRef.value;
```

`useAskableStream`, `useAskableChat`, `useAskableHistory`,
`useAskableSource`, and `useAskableAgent` resolve this signal at call/task time,
so they do not capture the pre-mount context value.

For SSR-to-browser resume, use a QRL factory to create a hook-owned context or
reconstruct a custom source in the browser:

```tsx
import { $ } from '@builder.io/qwik';
import { createAskableContext } from '@askable-ui/core';

const askable = useAskable({ ctx$: $(() => createAskableContext()) });
const source = useAskableSource('stats', $(() => ({
  resolve: () => ({ count: 2 }),
})));
```

The hook observes and destroys contexts created by `ctx$`. Passing `ctx` or a
source object directly remains supported for client-only mounts; runtime objects
wrapped with `noSerialize` are intentionally unavailable after SSR resume.

## Links

- [Documentation](https://askable-ui.com/docs/)
- [GitHub](https://github.com/askable-ui/askable)
- [npm](https://www.npmjs.com/package/@askable-ui/qwik)
