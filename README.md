# askable-ui

[![npm](https://img.shields.io/npm/v/@askable-ui/core?color=6366f1&label=npm)](https://www.npmjs.com/package/@askable-ui/core)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@askable-ui/core?color=6366f1&label=~1kb)](https://bundlephobia.com/package/@askable-ui/core)
[![license](https://img.shields.io/npm/l/@askable-ui/core?color=6366f1)](./LICENSE)

**Give any UI element LLM awareness with one attribute.**

![askable-ui demo](./site/www/demo.gif)

---

## What Askable does

Your model usually only sees the prompt. It does **not** know what the user is looking at in the UI.

Askable bridges that gap:

1. annotate meaningful UI with `data-askable`
2. observe user interaction
3. inject the current UI context into your LLM call

```html
<div data-askable='{"chart":"revenue","delta":"-12%","period":"Q3"}'>
  <RevenueChart />
</div>
```

```ts
import { createAskableContext } from '@askable-ui/core';

const askable = createAskableContext();
askable.observe(document);

const prompt = askable.toPromptContext();
// → "User is focused on: chart: revenue, delta: -12%, period: Q3"
```

---

## Shipped today

### JavaScript packages

```bash
npm install @askable-ui/core
npm install @askable-ui/react
npm install @askable-ui/vue
npm install @askable-ui/svelte
```

- [`@askable-ui/core`](./packages/core) — framework-agnostic observer + context
- [`@askable-ui/react`](./packages/react) — React bindings
- [`@askable-ui/vue`](./packages/vue) — Vue 3 bindings
- [`@askable-ui/svelte`](./packages/svelte) — Svelte bindings

### Experimental / in-repo Python work

There are Python package directories in `packages/python/`, but the primary supported surface in this repo today is the JavaScript package set above.

---

## Quick start

### Core

```ts
import { createAskableContext } from '@askable-ui/core';

const askable = createAskableContext();
askable.observe(document, { events: ['click', 'focus'] });

askable.on('focus', (focus) => {
  console.log(focus.meta);
  console.log(focus.text);
});
```

### React

```tsx
import { Askable, useAskable } from '@askable-ui/react';

function Dashboard({ revenue }) {
  return (
    <Askable meta={revenue}>
      <RevenueChart data={revenue} />
    </Askable>
  );
}

function AIInput() {
  const { promptContext } = useAskable({ events: ['click'] });
  return <ChatInput context={promptContext} />;
}
```

### Explicit “Ask AI” pattern

```tsx
function RevenueCard({ data }) {
  const { ctx } = useAskable();
  const ref = useRef<HTMLDivElement>(null);

  return (
    <Askable meta={data} ref={ref}>
      <RevenueChart data={data} />
      <button onClick={() => { ctx.select(ref.current!); openChat(); }}>
        Ask AI
      </button>
    </Askable>
  );
}
```

---

## Docs map

- **Overview:** this README
- **Core API:** [`packages/core/README.md`](./packages/core/README.md)
- **React guide:** [`packages/react/README.md`](./packages/react/README.md)
- **Vue guide:** [`packages/vue/README.md`](./packages/vue/README.md)
- **Svelte guide:** [`packages/svelte/README.md`](./packages/svelte/README.md)
- **Developer docs:** [`site/docs/`](./site/docs/)
- **Landing page:** [`site/www/index.html`](./site/www/index.html)

Recommended reading order for new users:

1. this README
2. framework package README
3. core API README

---

## SSR / framework behavior

Askable is safe to **import** in server-rendered apps, but DOM observation is **client-only**.

- React bindings now defer observation to `useEffect()`
- Vue bindings now defer observation to `onMounted()`
- Svelte bindings guard observation behind a browser check

That means Askable works with SSR frameworks, but actual DOM observation starts on the client after mount.

---

## Works with any LLM stack

```ts
// Vercel AI SDK
system: `UI context:
${askable.toPromptContext()}`

// OpenAI
{ role: 'system', content: `UI context:
${askable.toPromptContext()}` }

// Anthropic
system: `UI context:
${askable.toPromptContext()}`
```

---

## What’s next

Current priority areas:

- better docs and onboarding
- AI integration examples
- CopilotKit guide + example
- explicit Ask AI workflow guidance
- debug / inspector tooling

---

## License

MIT
