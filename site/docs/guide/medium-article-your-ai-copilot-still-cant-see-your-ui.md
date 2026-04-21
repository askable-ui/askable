# Your AI Copilot Still Can’t See Your UI

Most AI copilots fail in product interfaces for a boring reason: the model usually has no idea what the user is actually looking at.

It sees the chat.
It sees the prompt.
It may even have tool access.

But when the user asks:

- “Why is this dropping?”
- “What does this number mean?”
- “Can you help me with this form?”

…the assistant often has to guess what **this** means.

That is the gap askable-ui is built to close.

askable-ui gives AI copilots a lightweight UI context layer. Instead of scraping the page or shipping massive DOM payloads to the model, you annotate meaningful elements with structured metadata and let the library track what the user is focused on right now.

## The problem with in-app AI

Inside dashboards, forms, CRMs, admin panels, and internal tools, the frontend already knows a lot:

- which KPI card the user clicked
- which table row is selected
- which chart the user hovered
- which form field they are stuck on

But that context usually never reaches the model in a reliable way.

So we end up with assistants that are technically integrated into the app, but still feel disconnected from it.

Users have to restate what they see. Context gets lost between turns. Responses stay generic even when the data is right there on the page.

That is not really a model-quality problem.

It is a context plumbing problem.

## Why the obvious solutions fall short

### Send the whole DOM

This is noisy, expensive, brittle, and often low-signal.
A model does not need the entire page to explain a single revenue widget.

### Use screenshots everywhere

Vision can help, but it is not the default answer for every product UI.
In many apps, the semantic meaning is already present in code.
You do not need the model to infer from pixels what your React props already know.

### Hand-build prompt strings in every feature

This works for a few components, then slowly turns into prompt glue spread across the frontend.

## The askable-ui approach

The core idea is simple:

1. annotate meaningful elements
2. observe focus, click, hover, or explicit selection
3. serialize that context for the AI boundary

In React:

```tsx
import { Askable, useAskable } from '@askable-ui/react';

function Dashboard({ kpi }) {
  const { promptContext } = useAskable();

  return (
    <Askable meta={{ metric: kpi.name, value: kpi.value, delta: kpi.delta }}>
      <KPICard data={kpi} />
    </Askable>
  );
}
```

Now the app can produce prompt-ready context like:

> User is focused on: metric: revenue, value: $128,400, delta: +12%

That string can go straight into OpenAI, Anthropic, Vercel AI SDK, CopilotKit, or any other LLM stack.

The point is not the framework.
The point is that the model gets the same semantic context your UI already had.

## A better mental model for AI products

askable-ui is not trying to replace your LLM SDK or your agent runtime.

It fits underneath them.

- Askable gives the system **eyes**
- CopilotKit can provide **chat UI, actions, and runtime orchestration**
- Vercel AI SDK can handle **streaming and model wiring**
- OpenAI or Anthropic can handle **generation**

That separation matters.
It keeps the UI-context problem small, explicit, and reusable.

## Why annotation beats scraping

One of the strongest parts of this approach is that the same data that renders the UI can also power the AI context.

```tsx
<Askable meta={{ metric: 'revenue', value: '$2.3M', delta: '+12%', period: 'Q3' }}>
  <RevenueChart data={data} />
</Askable>
```

That gives you:

- smaller prompts
- clearer semantics
- less accidental noise
- more predictable AI behavior

Instead of forcing the model to reverse-engineer your interface, you let the product tell it what matters.

## Context should not freeze when the model starts talking

A subtle failure mode in AI UX is stale context during streaming.

The user clicks one thing, a response starts streaming, then they move to another element before the model finishes.
The assistant keeps talking about old context because the context snapshot was taken only once at request start.

That is why recent askable-ui updates added streaming context subscriptions:

```ts
const unsubscribe = ctx.subscribe((context, focus) => {
  transport.send({ context, focus });
}, {
  history: 5,
  debounce: 100,
});
```

This makes it easier to keep long-running AI responses aligned with live UI behavior.

## Good AI UX is not just better models

A lot of product teams are chasing smarter models when the bigger opportunity is better boundaries around the model:

- better context
- better grounding
- better timing
- better visibility into what the system knows
- better user control over what gets sent

That is where askable-ui fits.

It gives product teams a clean interface for one very specific but very important thing:

**what is the user looking at right now?**

## The simplest takeaway

Your app already knows what the user is looking at.
Your model usually does not.

askable-ui is the layer that closes that gap.

And once you feel the difference in a real product, it is hard to go back.

## Try it

```bash
npm install @askable-ui/react
```

```tsx
<Askable meta={{ metric: 'revenue', value: '$128,400', delta: '+12%' }}>
  <RevenueCard />
</Askable>
```

```tsx
const { promptContext } = useAskable();
```

Then pass `promptContext` into your model boundary.

That is enough to make an AI assistant feel much more grounded in the actual product experience.
