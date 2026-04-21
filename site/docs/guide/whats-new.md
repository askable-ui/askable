# What’s New in v6.1.0

askable-ui v6.1.0 rolls up the most recent improvements across the core library, React bindings, and docs.

## Highlights

### Streaming context subscriptions

You can now subscribe to serialized Askable context updates directly from `@askable-ui/core`:

```ts
const unsubscribe = ctx.subscribe((context, focus) => {
  streamTransport.send({ context, focus });
}, {
  history: 5,
  debounce: 100,
});
```

This is especially useful for AI experiences that keep streaming while the user continues interacting with the UI.

Use it when you want to:

- keep Vercel AI SDK sessions aligned with live UI focus
- update CopilotKit readable context during long-running agent responses
- debounce rapid UI changes before forwarding them to your model/runtime

Related docs:

- [AI SDK integration](/examples/ai-sdk)
- [CopilotKit example](/examples/copilotkit)
- [@askable-ui/core API](/api/core)

### Per-component activation rules in React

React components can now override activation behavior per component with the `events` prop on `<Askable>`.

```tsx
<Askable meta={{ widget: 'revenue' }} events={['hover']}>
  <RevenueCard />
</Askable>

<Askable meta={{ widget: 'account-row' }} events={['click']}>
  <AccountRow />
</Askable>

<Askable meta={{ widget: 'details-panel' }} events="manual">
  <Panel />
</Askable>
```

This makes mixed interaction patterns easier inside a single page or shared context:

- hover-only summary cards
- click-only rows in dense tables
- fully manual "Ask AI about this" flows driven by `ctx.select()`

Related docs:

- [React API](/api/react)
- [Ask AI button example](/examples/ask-ai-button)

### Better shared-context guidance

The recent docs updates also clarify how shared contexts behave across React, Vue, and the inspector tooling.

That includes guidance for:

- named shared contexts
- private vs shared contexts
- matching inspector configuration to custom event/view settings
- preserving hover-only and focus-only behavior in shared setups

## Recommended next step

If you are integrating Askable into an AI copilot, start here:

1. [Getting Started](/guide/getting-started)
2. [CopilotKit integration guide](/guide/copilotkit)
3. [AI SDK integration patterns](/examples/ai-sdk)

## Version note

The current published docs track **v6.1.0** at both:

- `/docs/`
- `/docs/v6.1.0/`
