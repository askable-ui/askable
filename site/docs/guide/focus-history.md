# Focus & History

## Current focus

`getFocus()` returns the most recently interacted `[data-askable]` element, or `null` if no interaction has occurred yet.

```ts
const focus = ctx.getFocus();

if (focus) {
  focus.meta       // Record<string, unknown> | string
  focus.text       // trimmed textContent of the element
  focus.element    // the HTMLElement itself
  focus.timestamp  // Unix ms when focus was set
}
```

## History

Askable automatically tracks focus events (newest first). The default buffer size is 50; configure it with `maxHistory`:

```ts
// Default: last 50 events
const ctx = createAskableContext();

// Custom buffer
const ctx = createAskableContext({ maxHistory: 10 });

// Disable history entirely
const ctx = createAskableContext({ maxHistory: 0 });
```

Use `getHistory()` to access the buffer:

```ts
const all   = ctx.getHistory();     // all entries, newest first
const last5 = ctx.getHistory(5);    // capped at 5
```

Each entry is an `AskableFocus` object with the same shape as `getFocus()`.

## Prompt-ready history

`toHistoryContext()` formats the history as a numbered, prompt-ready string — useful for multi-step reasoning or context windows:

```ts
ctx.toHistoryContext();
// [1] User is focused on: metric: revenue, delta: -12%, period: Q3
// [2] User is focused on: view: dashboard, tab: overview
// [3] User is focused on: page: pricing

// Limit entries
ctx.toHistoryContext(3);

// With serialization options
ctx.toHistoryContext(5, { includeText: false, excludeKeys: ['_id'] });

// With a token budget
ctx.toHistoryContext(10, { maxTokens: 200 });
```

### Using history in your LLM call

```ts
async function ask(userMessage: string) {
  const history = ctx.toHistoryContext(5);
  const current = ctx.toPromptContext();

  return fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: [
            'You are a helpful UI assistant.',
            '',
            'Current focus:',
            current,
            '',
            'Recent interactions (newest first):',
            history,
          ].join('\n'),
        },
        { role: 'user', content: userMessage },
      ],
    }),
  });
}
```

## Programmatic focus with `select()`

Use `ctx.select(element)` to set focus without waiting for a user interaction. This is the foundation of the **"Ask AI" button pattern** — you set context explicitly when the user clicks a dedicated button, rather than relying on passive hover or focus.

```ts
const el = document.querySelector('[data-askable]') as HTMLElement;
ctx.select(el);
// ctx.getFocus() now returns the focus for this element
// the 'focus' event fires
// history is updated
```

`select()` accepts any `HTMLElement` — it does not need to be inside the observed subtree.

## Clearing focus

`ctx.clear()` resets the current focus to `null` and emits a `'clear'` event. History is not affected.

```ts
ctx.on('clear', () => {
  // update your UI to reflect no active focus
});

ctx.clear();
```

A common use case is clearing focus when a chat panel closes:

```ts
chatPanel.addEventListener('close', () => ctx.clear());
```

## Reacting to focus changes

```ts
ctx.on('focus', (focus) => {
  // fires on every new focus (click, hover, focus event, or select())
  console.log('New focus:', focus.meta);
});

ctx.on('clear', () => {
  // fires when ctx.clear() is called
  console.log('Focus cleared');
});

// Unsubscribe when done
ctx.off('focus', handler);
```
