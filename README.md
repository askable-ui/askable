# askable

> Make your UI understandable to an LLM — with one attribute.

[![npm](https://img.shields.io/npm/v/@askable-ui/core?color=6366f1&label=npm)](https://www.npmjs.com/package/@askable-ui/core)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@askable-ui/core?color=6366f1&label=~1kb)](https://bundlephobia.com/package/@askable-ui/core)
[![license](https://img.shields.io/npm/l/@askable-ui/core?color=6366f1)](./LICENSE)
[![tests](https://img.shields.io/badge/tests-50%20passing-22c55e)](./packages)

LLMs can only answer well if they know what the user is pointing at.

In most apps, they don't. The user clicks a chart, hovers an error row, or focuses a field and asks *"what's wrong?"* — but the model only sees the text of the question. So it guesses.

**askable** gives the model the missing UI context. Attach the same structured data that already powers your interface, and askable turns the user's current focus into prompt-ready context automatically.

**Why askable exists:** app UIs are rich with meaning, but LLM calls usually throw that meaning away. askable closes that gap without forcing you to rebuild your app around a custom AI layer.

Works with React, Vue, Svelte, Streamlit, Django, or plain HTML.

---

## Why it matters

- **Stop generic answers.** Give the model the exact chart, row, card, or field the user is interacting with.
- **Reuse the data you already have.** The same API payload that renders the UI becomes AI context.
- **Add it incrementally.** Start with a single component, route, or workflow.
- **Keep the integration tiny.** One attribute on the UI, one line to observe, one string into your LLM call.

## The payoff in one example

**Without askable**

```text
User clicks a revenue chart and asks: "why is this dropping?"

LLM receives: "why is this dropping?"
LLM answers:  "Revenue can decline for many reasons..."
```

**With askable**

```tsx
const { data } = useFetch('/api/metrics/revenue');

<Askable meta={data}>
  <RevenueChart data={data} />
</Askable>
```

```text
User clicks the chart and asks: "why is this dropping?"

LLM receives:
UI context: metric=revenue, period=Q3, delta=-12%, prev=$2.6M, curr=$2.3M
Question: why is this dropping?

LLM answers:
"Your Q3 revenue is down 12% from $2.6M to $2.3M. Based on the chart you're
looking at, the likely causes are..."
```

Same UI. Same data. Much better prompt.

## How it works

1. Add metadata to any meaningful element with `data-askable` (or a framework wrapper).
2. Observe user interactions like click, hover, or focus.
3. Inject the current context into your LLM call.

That’s it.

## Works anywhere there’s UI

askable is not dashboard-specific. Any element with user meaning can become AI-readable:

```tsx
{/* E-commerce */}
<Askable meta={product}>
  <ProductCard product={product} />
</Askable>

{/* Support / ops */}
{errors.map(err => (
  <Askable as="tr" key={err.id} meta={err}>
    <td>{err.service}</td><td>{err.code}</td><td>{err.count}×</td>
  </Askable>
))}

{/* Pricing */}
<Askable meta={plan}>
  <PricingCard plan={plan} />
</Askable>

{/* Forms */}
<Askable meta={{ field: 'company_url', error: validation.error, attempts }}>
  <input value={url} />
</Askable>
```

## Install

```bash
# Core package
npm install @askable-ui/core

# Framework bindings
npm install @askable-ui/react
npm install @askable-ui/vue
npm install @askable-ui/svelte

# Python
pip install askable-streamlit
pip install askable-django
```

## 30-second quickstart

```html
<div id="metrics"></div>

<script type="module">
  import { createAskableContext } from 'https://esm.sh/@askable-ui/core';

  // 1) Fetch the same data you already use to render the UI
  const metrics = await fetch('/api/metrics').then(r => r.json());

  // 2) Attach that data to the elements the user can ask about
  for (const metric of metrics) {
    const el = document.createElement('div');
    el.setAttribute('data-askable', JSON.stringify(metric));
    el.innerHTML = `<h3>${metric.label}</h3><p>${metric.value}</p>`;
    document.getElementById('metrics').appendChild(el);
  }

  // 3) Observe the page and turn the current UI focus into prompt context
  const askable = createAskableContext();
  askable.observe(document);

  // 4) Send that context along with the user question
  async function ask(question) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'system', content: `UI context: ${askable.toPromptContext()}` },
          { role: 'user', content: question },
        ],
      }),
    });
    return res.json();
  }
</script>
```

---

## Framework examples

### React

```tsx
import { Askable, useAskable } from '@askable-ui/react';

function Dashboard() {
  const { data } = useSWR('/api/metrics'); // your API data

  return (
    <>
      {/* Same data renders the chart AND becomes AI context */}
      <Askable meta={data.revenue}>
        <RevenueChart data={data.revenue} />
      </Askable>

      {/* Works at any granularity — table, row, or cell */}
      <table>
        {data.accounts.map(account => (
          <Askable as="tr" key={account.id} meta={account}>
            <td>{account.company}</td>
            <td>{account.mrr}</td>
          </Askable>
        ))}
      </table>
    </>
  );
}

function AICopilot() {
  // Only respond to clicks (default: all three — click, hover, focus)
  const { promptContext } = useAskable({ events: ['click'] });

  return (
    <input
      placeholder="Ask about what you're looking at..."
      onKeyDown={(e) => {
        if (e.key === 'Enter') sendToLLM(promptContext, e.currentTarget.value);
      }}
    />
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { Askable, useAskable } from '@askable-ui/vue';
const { promptContext } = useAskable({ events: ['click', 'focus'] });
</script>

<template>
  <Askable :meta="{ chart: 'revenue', period: 'Q3' }" as="section">
    <RevenueChart />
  </Askable>
  <AIChatInput :context="promptContext" />
</template>
```

### Svelte

```svelte
<script lang="ts">
  import { createAskableStore } from '@askable-ui/svelte';
  import Askable from '@askable-ui/svelte/Askable.svelte';

  const { promptContext, destroy } = createAskableStore({ events: ['hover'] });
  onDestroy(destroy);
</script>

<Askable meta={{ chart: 'revenue', period: 'Q3' }} as="section">
  <RevenueChart />
</Askable>

<AIChatInput context={$promptContext} />
```

### Streamlit

```python
import streamlit as st
from askable.streamlit import askable_context

st.markdown(
    "<div data-askable='{\"metric\":\"revenue\",\"value\":\"$2.3M\"}'>Q3 Revenue: $2.3M</div>",
    unsafe_allow_html=True,
)

focus = askable_context()  # returns { meta, text, timestamp } or None

if focus and st.button("Ask AI"):
    response = your_llm(
        system=f"UI context: User is viewing: {focus['text']} (meta: {focus['meta']})",
        user=st.text_input("Question"),
    )
    st.write(response)
```

### Django

```django
{# settings.py: add 'askable.middleware.AskableMiddleware' to MIDDLEWARE #}
{# Core JS auto-injected before </body> — no template changes needed #}

{% load askable_tags %}

{% askable meta=chart_meta as="section" %}
  <canvas id="revenue-chart"></canvas>
{% endaskable %}
```

```python
# views.py — read context from the JS layer
def ai_chat(request):
    data = json.loads(request.body)
    return JsonResponse({
        'answer': llm.chat(
            system=f"UI context: {data['context']}",
            user=data['question'],
        )
    })
```

### Vanilla JS

```html
<div data-askable='{"page":"pricing","plan":"pro"}'>
  <h2>Pro Plan — $49/mo</h2>
</div>

<script type="module">
  import { createAskableContext } from 'https://esm.sh/@askable-ui/core';
  const ctx = createAskableContext();
  ctx.observe(document);
  ctx.on('focus', () => window.__uiContext = ctx.toPromptContext());
</script>
```

---

## How it works

```
1. ANNOTATE — add data-askable to any element that carries meaning
   <div data-askable='{"chart":"revenue","period":"Q3"}'>...</div>

2. OBSERVE — one call, covers your whole app
   ctx.observe(document)
   ↳ attaches click + focus + hover listeners to every [data-askable]
   ↳ MutationObserver picks up dynamically added elements

3. INJECT — one string, ready for any LLM
   ctx.toPromptContext()
   → "User is focused on: chart: revenue, period: Q3 — value "Q3 Revenue: $2.3M""
   ↳ prepend to your system prompt — done
```

---

## LLM integration

### Vercel AI SDK

```ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ctx } from './askable-singleton';

export async function POST(req: Request) {
  const { messages } = await req.json();
  return streamText({
    model: openai('gpt-4o'),
    system: `You are a helpful UI assistant.\n\n${ctx.toPromptContext()}`,
    messages,
  });
}
```

### OpenAI

```ts
import OpenAI from 'openai';
const openai = new OpenAI();

const reply = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system',  content: `UI context:\n${ctx.toPromptContext()}` },
    { role: 'user',    content: userQuestion },
  ],
});
```

### Anthropic Claude

```ts
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();

const reply = await client.messages.create({
  model: 'claude-opus-4-6',
  max_tokens: 1024,
  system: `UI context:\n${ctx.toPromptContext()}`,
  messages: [{ role: 'user', content: userQuestion }],
});
```

---

## Why not just pass state manually?

You could. You'd also write your own router.

The issue isn't whether you *can* wire UI state to your LLM — it's that every team does it differently, re-implements it per framework, forgets to update it when the UI changes, and ends up with a tangled mess of custom events and serialization logic that breaks the moment someone refactors a component.

askable is the **universal contract** between your UI and your LLM. One attribute on the element. One method call at the AI boundary. Works regardless of whether your stack is React + Vercel AI SDK, Django + OpenAI, or Svelte + Anthropic.

| | DIY tracking | askable |
|---|---|---|
| Setup per component | Write custom event | Add `data-askable` |
| Serialization | Custom per app | `ctx.toPromptContext()` |
| Dynamic elements | Manual wiring | MutationObserver built-in |
| Framework lock-in | Re-implement per framework | One core, thin adapters |
| Maintenance | Update on every UI change | Lives in markup |
| Bundle cost | Your code + your bugs | ~1kb gzipped, zero deps |
| Python support | You build it | Streamlit + Django packages |

---

## Packages

| Package | Lang | Description | Size |
|---|---|---|---|
| [`@askable-ui/core`](./packages/core) | TS | Framework-agnostic observer + context. Zero dependencies. | ~1kb gz |
| [`@askable-ui/react`](./packages/react) | TS | `<Askable>` component + `useAskable()` hook | ~0.5kb gz |
| [`@askable-ui/vue`](./packages/vue) | TS | `<Askable>` component + `useAskable()` composable | ~0.5kb gz |
| [`@askable-ui/svelte`](./packages/svelte) | TS | `<Askable>` component + `createAskableStore()` | ~0.5kb gz |
| [`askable-streamlit`](./packages/python/streamlit) | Python | Streamlit custom component — returns focus as Python dict | — |
| [`askable-django`](./packages/python/django) | Python | Template tags + auto-inject middleware | — |

---

## API reference

### `createAskableContext() → AskableContext`

Factory. Returns a new context instance.

### `ctx.observe(el: HTMLElement | Document, options?: AskableObserveOptions)`

Start watching `el`. Attaches interaction listeners to all `[data-askable]` elements, current and future (via `MutationObserver`).

```ts
// Default — all three triggers
ctx.observe(document)

// Click only
ctx.observe(document, { events: ['click'] })

// Hover only
ctx.observe(document, { events: ['hover'] })

// Click + keyboard focus
ctx.observe(document, { events: ['click', 'focus'] })
```

**`options.events`** — array of `'click' | 'hover' | 'focus'`. Defaults to all three.

The framework hooks accept the same `events` option:

```ts
// React
const { promptContext } = useAskable({ events: ['click'] });

// Vue
const { promptContext } = useAskable({ events: ['click', 'focus'] });

// Svelte
const { promptContext, destroy } = createAskableStore({ events: ['hover'] });
```

### `ctx.getFocus() → AskableFocus | null`

Returns `{ meta, text, element, timestamp }` or `null`.

- `meta` — JSON-parsed object, or raw string if the attribute isn't valid JSON
- `text` — `element.textContent`, trimmed and truncated to 200 chars
- `timestamp` — unix ms

### `ctx.on('focus', handler)` / `ctx.off('focus', handler)`

Subscribe/unsubscribe to focus changes.

### `ctx.toPromptContext() → string`

Natural language string ready to inject into a system prompt:
```
User is focused on: — metric: revenue, period: Q3 — value "Q3 Revenue: $2.3M"
```
Returns `"No UI element is currently focused."` when nothing is focused.

### `ctx.destroy()`

Remove all listeners and observers. Call on component unmount.

---

## License

MIT
