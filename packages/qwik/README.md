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

## Links

- [Documentation](https://askable-ui.com/docs/)
- [GitHub](https://github.com/askable-ui/askable)
- [npm](https://www.npmjs.com/package/@askable-ui/qwik)
