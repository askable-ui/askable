<p align="center">
  <img src="site/www/avatar.png" alt="askable-ui" width="96" />
</p>

<h1 align="center">askable-ui</h1>

<p align="center">
  <strong>Your LLM doesn't know what the user is looking at. Fix that in two lines.</strong><br />
  One attribute. Real-time UI context. Works with every LLM SDK and MCP client.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@askable-ui/core">
    <img src="https://img.shields.io/npm/v/@askable-ui/core?color=4f46e5&label=npm" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@askable-ui/core">
    <img src="https://img.shields.io/npm/dw/@askable-ui/core?color=4f46e5&label=downloads" alt="npm downloads" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/npm/l/@askable-ui/core?color=4f46e5" alt="MIT license" />
  </a>
  <a href="https://github.com/askable-ui/askable/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/askable-ui/askable/static_quality.yml?branch=main&color=4f46e5&label=CI" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/PRs-welcome-4f46e5" alt="PRs welcome" />
</p>

<p align="center">
  <video src="https://github.com/user-attachments/assets/dfc6a889-e093-452d-8259-e7123b446d24" autoplay loop muted playsinline width="720"></video>
</p>

<p align="center">
  <a href="#what-the-ai-receives">What the AI receives</a> &nbsp;·&nbsp;
  <a href="#quick-start">Quick start</a> &nbsp;·&nbsp;
  <a href="#mcp-claude-desktop--cursor">MCP</a> &nbsp;·&nbsp;
  <a href="#how-it-works">How it works</a> &nbsp;·&nbsp;
  <a href="#capture-modes">Capture modes</a> &nbsp;·&nbsp;
  <a href="#packages">Packages</a> &nbsp;·&nbsp;
  <a href="https://askable-ui.com/docs/">Docs</a> &nbsp;·&nbsp;
  <a href="https://askable-mu.vercel.app/">Live Demo</a>
</p>

---

## What the AI receives

When a user clicks a KPI card in your dashboard, the AI gets this — automatically, with no extra code:

```
User is focused on: metric=net revenue retention, value=118%, delta=+6pp QoQ
Page: Analytics Dashboard · Q3 2024
Visible: pipeline coverage 3.9x, support backlog 24 tickets (−31%)
History: support backlog → pipeline coverage → net revenue retention
```

Not a screenshot. Not a stale system prompt. The real data the user sees, updated on every interaction.

---

## The problem it solves

**Before askable-ui** — you write this (and update it every time the UI changes):

```ts
const system = `You are an analytics assistant. The dashboard shows:
  - Revenue KPI (updates monthly from Salesforce)
  - Pipeline coverage metric (target: 3.5x)
  - Support backlog counter (SLA: < 50 tickets)
  - Deal pipeline table (12 open deals)
  The user might be looking at any of these.`

// User: "explain this"
// AI: "Could you clarify which metric you're referring to?"
```

**With askable-ui** — annotate once, the AI always knows:

```tsx
<Askable meta={{ metric: 'net revenue retention', value: '118%', delta: '+6pp' }}>
  <NRRCard data={data} />
</Askable>

// User: "explain this"
// AI: "NRR at 118% means your existing customers are spending 18% more than last period.
//       The +6pp trend indicates your recent expansion motion is working..."
```

---

## Quick start

```bash
npm install @askable-ui/react
```

```tsx
import { Askable, useAskable } from '@askable-ui/react';

function Dashboard({ metrics }) {
  const { promptContext } = useAskable();

  return (
    <>
      {metrics.map(m => (
        <Askable key={m.id} meta={{ metric: m.name, value: m.value, delta: m.delta }}>
          <MetricCard data={m} />
        </Askable>
      ))}

      {/* promptContext updates automatically as the user interacts */}
      <AIChat systemPrompt={`You are a helpful assistant.\n\n${promptContext}`} />
    </>
  );
}
```

`promptContext` is a plain string. Pass it to any LLM.

**Need a full runnable app?**

```bash
npm create @askable-ui/app my-app
cd my-app && npm install && npm run dev
```

React + Vite + CopilotKit, wired up and ready to go.

---

## MCP — Claude Desktop, Cursor, and any MCP client

Expose your app's live UI context as an MCP server. Any agent that connects can ask what the user currently sees.

```bash
npm install @askable-ui/mcp
```

```ts
import { createAskableMcpServer, createAskableMcpContextProvider } from '@askable-ui/mcp';

const server = createAskableMcpServer({
  provider: createAskableMcpContextProvider(ctx),
});

server.connect(transport);
```

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-app": {
      "command": "node",
      "args": ["path/to/your/mcp-server.js"]
    }
  }
}
```

Claude Desktop can now call `get_current_context` and `format_context_for_prompt` — it sees exactly what your user sees, without screenshots or manual description.

→ **[MCP integration guide](https://askable-ui.com/docs/api/mcp)**

---

## How it works

**1. Annotate** — your existing data, on your existing elements

```tsx
<Askable meta={{ metric: 'revenue', value: '$2.3M', delta: '+12%', period: 'Q3' }}>
  <RevenueChart data={data} />
</Askable>
```

**2. Observe** — zero config, one call

```tsx
const { promptContext } = useAskable();
// Updates on click, hover, focus — any user interaction
```

**3. Inject** — at the LLM boundary

```ts
// Vercel AI SDK
const result = await streamText({
  model: openai('gpt-4o'),
  system: `You are a helpful assistant.\n\n${promptContext}`,
  messages,
});

// Anthropic SDK
const msg = await anthropic.messages.create({
  model: 'claude-opus-4-8',
  system: `You are a helpful assistant.\n\n${promptContext}`,
  messages,
});

// CopilotKit
useCopilotReadable({ description: 'UI context', value: promptContext }, [promptContext]);
```

---

## Capture modes

Beyond passive focus tracking, askable-ui has explicit capture tools that let users point the AI at exactly what they mean.

### Region & lasso capture

The user draws a rectangle, circle, or freehand lasso. The AI receives the context of every annotated element inside that selection.

```tsx
const regionCapture = useAskableRegionCapture({
  onCapture(packet, selection) {
    sendToAI(JSON.stringify(packet));
  },
});

<button onClick={() => regionCapture.start({ shape: 'lasso' })}>
  Circle it for the AI
</button>
```

### Text selection capture

The user highlights any text on the page. The AI receives the selection with its surrounding context.

```tsx
const textCapture = useAskableTextSelectionCapture({
  onCapture(packet) {
    sendToAI(JSON.stringify(packet));
  },
});
```

### Viewport context

Track every annotated element currently visible in the viewport — useful for long lists and data-dense dashboards.

```tsx
import { useAskableViewport } from '@askable-ui/react';

const { visibleItems, promptContext } = useAskableViewport({ threshold: 0.5 });
// promptContext → "Visible UI elements:\n- {"metric":"revenue","value":"$2.3M"} ..."
```

Available in React, Vue, and Svelte (both Svelte 4 and 5).

### Navigation history

Let the AI understand the user's journey — not just where they are now, but where they've been.

```tsx
import { useAskableHistory } from '@askable-ui/react';

const { history, promptContext } = useAskableHistory({ maxEntries: 5 });
// promptContext → "User navigation trail (most recent first):\n→ {"metric":"churn"}..."
```

Deduplicates consecutive identical entries by default. Available in React, Vue, and Svelte.

### Composing context streams

Merge focus, viewport, history, and any other context into one prompt string using `useAskableCompose` (React):

```tsx
import { useAskable, useAskableViewport, useAskableHistory, useAskableCompose } from '@askable-ui/react';

const { promptContext: focusCtx } = useAskable();
const { promptContext: viewportCtx } = useAskableViewport();
const { promptContext: historyCtx } = useAskableHistory({ maxEntries: 5 });

const { promptContext } = useAskableCompose({
  sections: [
    { label: 'Currently focused element', value: focusCtx },
    { label: 'Visible dashboard elements', value: viewportCtx },
    { label: 'Recent navigation', value: historyCtx },
  ],
});
// Empty sections are automatically excluded from the output
```

### Typed meta (TypeScript)

Cast `focus.meta` to your own schema type without any runtime overhead:

```ts
import { asMeta } from '@askable-ui/react'; // or /vue, /svelte, @askable-ui/core

interface KpiMeta { metric: string; value: string; delta: string; period: string }

const { focus } = useAskable();
if (focus) {
  const kpi = asMeta<KpiMeta>(focus);
  console.log(kpi.meta.value);  // string, not unknown
}
```

### Ask AI button

`useAskableAgent` packages the current context into a request payload and hands it to your send handler — no boilerplate needed:

```tsx
import { useAskableAgent } from '@askable-ui/react';

function AskButton() {
  const { send, isLoading } = useAskableAgent();

  return (
    <button
      disabled={isLoading}
      onClick={() =>
        send('What is this?', async (req) => {
          const res = await fetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({
              question: req.question,
              context: req.context,
            }),
          });
          return res.json();
        })
      }
    >
      {isLoading ? 'Thinking…' : 'Ask AI'}
    </button>
  );
}
```

`req.context` is the full `toPromptContextAsync()` string — focus, history, sources — ready to use as a system prompt.

### Multi-turn chat

`useAskableChat` manages the full conversation thread with context automatically injected on every turn:

```tsx
import { useAskableChat } from '@askable-ui/react';

function ChatPanel() {
  const { messages, append, isStreaming } = useAskableChat({
    systemPrompt: (ctx) => `You are a helpful assistant.\n\n${ctx}`,
  });

  return (
    <div>
      {messages.map(m => <div key={m.id} className={m.role}>{m.content}</div>)}
      <button disabled={isStreaming} onClick={() =>
        append(userInput, async (req, msgs, emit) => {
          const res = await fetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ messages: msgs, system: req.context }),
          });
          for await (const chunk of res.body!.pipeThrough(new TextDecoderStream())) {
            emit(chunk);
          }
        })
      }>
        Send
      </button>
    </div>
  );
}
```

### Streaming responses

`useAskableStream` accumulates text chunks reactively:

```tsx
import { useAskableStream } from '@askable-ui/react';

function StreamingButton() {
  const { stream, content, isStreaming } = useAskableStream();

  return (
    <>
      <p>{content || 'Press Ask to start'}</p>
      <button disabled={isStreaming} onClick={() =>
        stream('Explain this', async (req, emit) => {
          const res = await fetch('/api/stream', {
            method: 'POST', body: JSON.stringify(req),
          });
          for await (const chunk of res.body!.pipeThrough(new TextDecoderStream())) {
            emit(chunk);
          }
        })
      }>
        {isStreaming ? 'Streaming…' : 'Ask'}
      </button>
    </>
  );
}
```

### Cmd+K AI trigger

`useAskableKeyboardShortcut` adds a keyboard shortcut that fires with the full composed AI context:

```tsx
import { useAskableKeyboardShortcut } from '@askable-ui/react';

// One line to add Cmd+K AI to your app
const { isOpen, setOpen, lastContext } = useAskableKeyboardShortcut({
  toggle: true,
  onTrigger: (context) => console.log('AI context:', context),
});
```

### Context sources

Sources expose app state the AI can't see in the DOM. Import from `@askable-ui/react/core` (or `vue/core`, `svelte/core`, etc.) for the essentials. Niche sources live in `@askable-ui/react/extended` and are fully tree-shakeable — they cost nothing if you don't import them.

**Core** (`@askable-ui/react/core`)

| Source hook | What it captures |
|---|---|
| `useAskablePageSource` | Page title, URL, headings, selected text |
| `useAskableFormSource` | Form field names, values, labels, validation errors |
| `useAskableTableSource` | Table rows, visible rows, selected rows, state |
| `useAskableErrorSource` | Form validation errors, API failures, caught exceptions |
| `useAskableUserSource` | Authenticated user name, role, plan, locale |
| `useAskableNavigationSource` | Current route, title, params, query, nav history |
| `useAskableDOMSource` | Any element: text, ARIA labels, data attributes |
| `useAskableStorageSource` | localStorage/sessionStorage items |
| `useAskableNotificationSource` | Active notifications, severity, messages |
| `useAskableCartSource` | Cart items, quantities, subtotal, tax, shipping, total |
| `useAskableMultistepSource` | Wizard/stepper — step name, index, progress, completion |

**Extended** (`@askable-ui/react/extended`)

| Source hook | What it captures |
|---|---|
| `useAskableScrollSource` | Scroll position, direction, progress percentage |
| `useAskableThemeSource` | Color scheme, contrast preference, motion preference |
| `useAskableWindowSource` | Window dimensions, device category, orientation |
| `useAskableLocaleSource` | Language, region, timezone, date format |
| `useAskableNetworkSource` | Connection type, effective speed, online status |
| `useAskableConnectionSource` | WebSocket/SSE connection status and protocol |
| `useAskableLoadingSource` | Named loading states (pending, success, error) |
| `useAskableSearchSource` | Query string, result count, filters, active status |
| `useAskableTabSource` | Active tab label, index, total tab count |
| `useAskableMediaSource` | Media title, playback state, position, duration |
| `useAskableSelectionSource` | Currently selected text or element |
| `useAskableClipboardSource` | Recent clipboard entries (type, preview, size) |
| `useAskableFocusSource` | Currently focused DOM element, role, ARIA label |
| `useAskableIdleSource` | User idle state and time since last interaction |
| `useAskableAnalyticsSource` | Recent analytics events (name, properties, timestamp) |
| `useAskableAbTestSource` | Active A/B test variants the user is enrolled in |
| `useAskableFeatureFlagSource` | Feature flag names and enabled/disabled values |
| `useAskablePermissionSource` | Browser permission states (camera, mic, notifications) |
| `useAskablePerformanceSource` | LCP, FID, CLS, TTFB, and custom timing metrics |
| `useAskableTimeSource` | Current time, timezone, business hours status |
| `useAskableBatterySource` | Battery level, charging state, estimated time |
| `useAskableGeolocationSource` | GPS coordinates and accuracy (with user permission) |

All sources are also available from the main entry point — the split is about clarity, not restriction.

---

## Works with

**LLM SDKs**

| SDK | Integration |
|---|---|
| [Vercel AI SDK](https://sdk.vercel.ai/) | Pass `promptContext` to `system` in `streamText` / `generateText` |
| [CopilotKit](https://copilotkit.ai/) | `useCopilotReadable({ value: promptContext })` |
| [Anthropic SDK](https://github.com/anthropic-ai/sdk-python) | Pass `promptContext` to `system` in `messages.create` |
| [OpenAI SDK](https://github.com/openai/openai-node) | Pass `promptContext` to the system message |
| [LangChain.js](https://js.langchain.com/) | Inject via `SystemMessage` |
| Any MCP client | Use `@askable-ui/mcp` to expose as MCP tools |

**Frameworks**

| | Package | |
|---|---|---|
| React 18+ | `@askable-ui/react` | `useAskable()`, `useAskableAgent()`, `useAskableStream()`, `useAskableChat()`, `useAskableKeyboardShortcut()`, `useAskablePageSource()`, `useAskableFormSource()`, `useAskableTableSource()`, `useAskableErrorSource()`, `useAskableUserSource()`, `useAskableNavigationSource()`, `useAskableDOMSource()`, `useAskableStorageSource()`, `useAskableCartSource()`, `useAskableMultistepSource()`, `useAskableScrollSource()`, `useAskableThemeSource()`, `useAskableWindowSource()`, `useAskableLocaleSource()`, `useAskableNetworkSource()`, `useAskableTimeSource()`, `useAskableFocusSource()`, `useAskableTabSource()`, `useAskablePerformanceSource()`, `useAskableBatterySource()`, `useAskableGeolocationSource()`, `useAskableViewport()`, `useAskableHistory()`, `<Askable>`, region/text capture |
| Vue 3 | `@askable-ui/vue` | `useAskable()`, `useAskableAgent()`, `useAskableStream()`, `useAskableChat()`, `useAskableKeyboardShortcut()`, `useAskablePageSource()`, `useAskableFormSource()`, `useAskableTableSource()`, `useAskableErrorSource()`, `useAskableUserSource()`, `useAskableNavigationSource()`, `useAskableDOMSource()`, `useAskableStorageSource()`, `useAskableCartSource()`, `useAskableMultistepSource()`, `useAskableScrollSource()`, `useAskableThemeSource()`, `useAskableWindowSource()`, `useAskableLocaleSource()`, `useAskableNetworkSource()`, `useAskableTimeSource()`, `useAskableFocusSource()`, `useAskableTabSource()`, `useAskablePerformanceSource()`, `useAskableBatterySource()`, `useAskableGeolocationSource()`, `useAskableViewport()`, `useAskableHistory()`, `<Askable>` |
| Svelte 4 & 5 | `@askable-ui/svelte` | `createAskableStore()`, `useAskableAgent()`, `useAskableStream()`, `useAskableChat()`, `useAskableKeyboardShortcut()`, `useAskablePageSource()`, `useAskableFormSource()`, `useAskableTableSource()`, `useAskableErrorSource()`, `useAskableUserSource()`, `useAskableNavigationSource()`, `useAskableDOMSource()`, `useAskableStorageSource()`, `useAskableCartSource()`, `useAskableMultistepSource()`, `useAskableScrollSource()`, `useAskableThemeSource()`, `useAskableWindowSource()`, `useAskableLocaleSource()`, `useAskableNetworkSource()`, `useAskableTimeSource()`, `useAskableFocusSource()`, `useAskableTabSource()`, `useAskablePerformanceSource()`, `useAskableBatterySource()`, `useAskableGeolocationSource()`, `useAskableViewport()`, `useAskableHistory()`, `<Askable>` |
| SolidJS | `@askable-ui/solid` | `useAskable()`, `useAskableAgent()`, `useAskableStream()`, `useAskableChat()`, `useAskableKeyboardShortcut()`, `useAskablePageSource()`, `useAskableFormSource()`, `useAskableTableSource()`, `useAskableErrorSource()`, `useAskableUserSource()`, `useAskableNavigationSource()`, `useAskableDOMSource()`, `useAskableStorageSource()`, `useAskableCartSource()`, `useAskableMultistepSource()`, `useAskableScrollSource()`, `useAskableThemeSource()`, `useAskableWindowSource()`, `useAskableLocaleSource()`, `useAskableNetworkSource()`, `useAskableTimeSource()`, `useAskableFocusSource()`, `useAskableTabSource()`, `useAskablePerformanceSource()`, `useAskableBatterySource()`, `useAskableGeolocationSource()`, `useAskableViewport()`, `useAskableHistory()`, `<Askable>` |
| Angular 16+ | `@askable-ui/angular` | `AskableService`, `AskablePageSourceService`, `AskableFormSourceService`, `AskableErrorSourceService`, `AskableUserSourceService`, `AskableNavigationSourceService`, `AskableCartSourceService`, `AskableMultistepSourceService`, `AskableScrollSourceService`, `AskableThemeSourceService`, `AskableWindowSourceService`, `AskableLocaleSourceService`, `AskableNetworkSourceService`, `AskableTimeSourceService`, `AskableFocusSourceService`, `AskableTabSourceService`, `AskablePerformanceSourceService`, `AskableBatterySourceService`, `AskableGeolocationSourceService`, `AskableAgentService`, `AskableDirective`, `AskableViewportService`, `AskableHistoryService` |
| Qwik | `@askable-ui/qwik` | `useAskable()`, `<Askable>` for Qwik City apps |
| Web Component | `@askable-ui/web-component` | `<askable-context>` custom element, works in HTMX, Ember, vanilla HTML |
| React Native | `@askable-ui/react-native` | `useAskable()`, `<Askable>`, scroll view adapter |
| Vanilla JS | `@askable-ui/core` | `createAskableContext()`, zero dependencies |

---

## Framework quick starts

<details>
<summary><strong>Vue 3</strong></summary>

```bash
npm install @askable-ui/vue
```

```vue
<script setup>
import { Askable, useAskable } from '@askable-ui/vue';
const { promptContext } = useAskable();
const props = defineProps(['kpi']);
</script>

<template>
  <Askable :meta="{ metric: kpi.name, value: kpi.value, delta: kpi.delta }">
    <KPICard :data="kpi" />
  </Askable>
</template>
```

</details>

<details>
<summary><strong>Svelte 5 (runes)</strong></summary>

```bash
npm install @askable-ui/svelte
```

```svelte
<script lang="ts">
  import { useAskable } from '@askable-ui/svelte/useAskable.svelte';
  import Askable5 from '@askable-ui/svelte/Askable5.svelte';

  const { promptContext } = useAskable();
  let { kpi } = $props();
</script>

<Askable5 meta={{ metric: kpi.name, value: kpi.value, delta: kpi.delta }}>
  <KPICard data={kpi} />
</Askable5>
```

</details>

<details>
<summary><strong>Svelte 4 (stores)</strong></summary>

```bash
npm install @askable-ui/svelte
```

```svelte
<script>
  import { createAskableStore } from '@askable-ui/svelte';
  import Askable from '@askable-ui/svelte/Askable.svelte';

  const { promptContext } = createAskableStore();
  export let kpi;
</script>

<Askable meta={{ metric: kpi.name, value: kpi.value, delta: kpi.delta }}>
  <KPICard data={kpi} />
</Askable>
```

</details>

<details>
<summary><strong>SolidJS</strong></summary>

```bash
npm install @askable-ui/solid
```

```tsx
import { Askable, useAskable } from '@askable-ui/solid';

function KPICard(props: { kpi: { name: string; value: string; delta: string } }) {
  const { promptContext } = useAskable();

  return (
    <Askable meta={{ metric: props.kpi.name, value: props.kpi.value, delta: props.kpi.delta }}>
      <article>{props.kpi.value}</article>
    </Askable>
  );
}
```

</details>

<details>
<summary><strong>Angular 16+</strong></summary>

```bash
npm install @askable-ui/angular
```

```ts
// app.component.ts
import { Component, computed, inject } from '@angular/core';
import { AskableService, AskableDirective, useAskableCompose } from '@askable-ui/angular';

@Component({
  standalone: true,
  imports: [AskableDirective],
  template: `
    <article [askable]="{ metric: 'Revenue', value: '$1.2M' }" askableScope="kpis">
      $1.2M
    </article>
    <p>{{ promptContext() }}</p>
  `,
})
export class AppComponent {
  private askable = inject(AskableService);

  sections = computed(() => [
    { label: 'Focused element', value: this.askable.promptContext() },
  ]);

  { promptContext } = useAskableCompose(this.sections);
}
```

</details>

<details>
<summary><strong>Qwik</strong></summary>

```bash
npm install @askable-ui/qwik
```

```tsx
import { component$ } from '@builder.io/qwik';
import { Askable, useAskable } from '@askable-ui/qwik';

export const KPICard = component$<{ kpi: { metric: string; value: string } }>((props) => {
  const { promptContext } = useAskable();

  return (
    <Askable meta={{ metric: props.kpi.metric, value: props.kpi.value }}>
      <article>{props.kpi.value}</article>
    </Askable>
  );
});
```

</details>

<details>
<summary><strong>Web Component (HTMX / Ember / Vanilla)</strong></summary>

```bash
npm install @askable-ui/web-component
```

Or via CDN — no build step required:

```html
<script type="module" src="https://unpkg.com/@askable-ui/web-component/dist/index.js"></script>

<askable-context id="app">
  <button data-askable='{"action":"buy","sku":"abc123"}'>Buy now</button>
  <article data-askable='{"metric":"revenue","value":"$2.4M"}'>Revenue</article>
</askable-context>

<script type="module">
  const el = document.getElementById('app');
  el.addEventListener('askable:focus', (e) => {
    console.log(e.detail.promptContext);
    // → "Focused element:\n{\"action\":\"buy\",\"sku\":\"abc123\"}\nBuy now"
    sendToAI(e.detail.promptContext);
  });
</script>
```

</details>

<details>
<summary><strong>React Native</strong></summary>

```bash
npm install @askable-ui/react-native
```

```tsx
import { Askable, useAskable } from '@askable-ui/react-native';

function RevenueCard({ data }) {
  const { promptContext } = useAskable();

  return (
    <Askable meta={{ metric: 'revenue', value: data.value }}>
      <Pressable>
        <Text>{data.value}</Text>
      </Pressable>
    </Askable>
  );
}
```

See [`examples/react-native-expo`](./examples/react-native-expo) for a full runnable app.

</details>

<details>
<summary><strong>Vanilla JS</strong></summary>

```bash
npm install @askable-ui/core
```

```ts
import { createAskableContext } from '@askable-ui/core';

const ctx = createAskableContext();
ctx.observe(document.body);

ctx.on('focus', () => {
  const context = ctx.toContext();
  // "User is focused on: metric=revenue, value=$2.3M"
  fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ context, message: userMessage }),
  });
});
```

Or open [`examples/vanilla-chat/index.html`](./examples/vanilla-chat/index.html) directly in a browser — zero build step, zero install, works offline.

</details>

---

## Packages

| Package | Version | Description |
|---|---|---|
| [`@askable-ui/core`](https://www.npmjs.com/package/@askable-ui/core) | [![npm](https://img.shields.io/npm/v/@askable-ui/core?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/core) | Framework-agnostic core. Zero runtime deps. |
| [`@askable-ui/context`](https://www.npmjs.com/package/@askable-ui/context) | [![npm](https://img.shields.io/npm/v/@askable-ui/context?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/context) | Context packet types, schema, validators |
| [`@askable-ui/react`](https://www.npmjs.com/package/@askable-ui/react) | [![npm](https://img.shields.io/npm/v/@askable-ui/react?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/react) | React 18+ hooks and components |
| [`@askable-ui/vue`](https://www.npmjs.com/package/@askable-ui/vue) | [![npm](https://img.shields.io/npm/v/@askable-ui/vue?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/vue) | Vue 3 composables and components |
| [`@askable-ui/svelte`](https://www.npmjs.com/package/@askable-ui/svelte) | [![npm](https://img.shields.io/npm/v/@askable-ui/svelte?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/svelte) | Svelte 4 & 5 stores and components |
| [`@askable-ui/solid`](https://www.npmjs.com/package/@askable-ui/solid) | [![npm](https://img.shields.io/npm/v/@askable-ui/solid?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/solid) | SolidJS primitives and components |
| [`@askable-ui/angular`](https://www.npmjs.com/package/@askable-ui/angular) | [![npm](https://img.shields.io/npm/v/@askable-ui/angular?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/angular) | Angular 16+ injectable service and directive |
| [`@askable-ui/qwik`](https://www.npmjs.com/package/@askable-ui/qwik) | [![npm](https://img.shields.io/npm/v/@askable-ui/qwik?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/qwik) | Qwik adapter with useAskable() and `<Askable>` |
| [`@askable-ui/web-component`](https://www.npmjs.com/package/@askable-ui/web-component) | [![npm](https://img.shields.io/npm/v/@askable-ui/web-component?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/web-component) | `<askable-context>` custom element — HTMX, Ember, vanilla |
| [`@askable-ui/react-native`](https://www.npmjs.com/package/@askable-ui/react-native) | [![npm](https://img.shields.io/npm/v/@askable-ui/react-native?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/react-native) | React Native adapter |
| [`@askable-ui/mcp`](https://www.npmjs.com/package/@askable-ui/mcp) | [![npm](https://img.shields.io/npm/v/@askable-ui/mcp?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/mcp) | MCP server — expose UI context to Claude, Cursor, etc. |
| [`create-@askable-ui/app`](https://www.npmjs.com/package/@askable-ui/create-app) | [![npm](https://img.shields.io/npm/v/@askable-ui/create-app?color=4f46e5)](https://www.npmjs.com/package/@askable-ui/create-app) | Starter scaffold: React + Vite + CopilotKit |

---

## Features

- **Zero config** — one attribute, works with any DOM structure or component library
- **Real-time updates** — context refreshes on click, hover, focus, scroll — any interaction
- **Structured packets** — `ctx.toContextPacket()` emits typed, validated JSON for agent pipelines
- **Conversation history** — `useAskableHistory()` / `ctx.toHistoryContext(n)` for multi-turn awareness
- **Viewport awareness** — `useAskableViewport()` / `ctx.toViewportContext()` for all visible annotated elements
- **Composed context** — `useAskableCompose()` merges focus, viewport, history, and app sources into one string
- **Typed meta** — `asMeta<T>(focus)` casts `focus.meta` to your schema type without runtime overhead
- **Named contexts** — isolate `table`, `chart`, and `form` contexts independently on the same page
- **Explicit capture** — region, circle, lasso, and text-selection capture for user-directed AI
- **Privacy & redaction** — strip sensitive fields before data leaves the page
- **MCP bridge** — expose any context as `get_current_context` and `format_context_for_prompt` MCP tools
- **Ask AI button** — `useAskableAgent()` packages context + question into a request payload in one call
- **Streaming chat** — `useAskableChat()` multi-turn conversation with automatic context injection per turn
- **Streaming primitives** — `useAskableStream()` for one-shot streaming with `abort()`, `content`, and status
- **Form awareness** — `useAskableFormSource()` reads field values, labels, and HTML5 validation errors; masks passwords by default
- **Table awareness** — `useAskableTableSource()` exposes rows, visible page, selection, and table state for any table library
- **Error awareness** — `useAskableErrorSource()` captures validation errors and API failures; compatible with React Hook Form, Zod, VeeValidate
- **Page source** — `useAskablePageSource()` snapshots title, URL, headings, selected text, and links as a fallback for unannotated pages
- **Cart awareness** — `useAskableCartSource()` tracks ecommerce cart items, quantities, subtotal, discount, tax, shipping, and total; mutate with `addItem`, `removeItem`, `updateQuantity`, `setTotals`, `clearCart`
- **Wizard / stepper** — `useAskableMultistepSource()` tracks wizard progress: step name, index, total steps, completion percentage, and whether the flow is finished
- **Environment sources** — `useAskableScrollSource()`, `useAskableWindowSource()`, `useAskableThemeSource()`, `useAskableLocaleSource()`, `useAskableNetworkSource()`, `useAskableConnectionSource()`, `useAskablePermissionSource()` — the assistant knows the user's context without you describing it
- **Performance metrics** — `useAskablePerformanceSource()` exposes Core Web Vitals (LCP, FID, CLS, TTFB) and custom timing marks
- **Device sensors** — `useAskableBatterySource()` and `useAskableGeolocationSource()` for mobile-aware assistants
- **Time awareness** — `useAskableTimeSource()` provides current time, timezone, and configurable business hours status
- **Focus tracking** — `useAskableFocusSource()` reports the currently focused DOM element, ARIA role, and label
- **Navigation & tab state** — `useAskableTabSource()` for multi-tab UIs; `useAskableSearchSource()` for live search context
- **User behaviour** — `useAskableIdleSource()`, `useAskableAnalyticsSource()`, `useAskableAbTestSource()`, `useAskableFeatureFlagSource()` for session intelligence
- **Dev inspector** — `<AskableInspector />` overlay showing live context packets and source data
- **SSR safe** — defers to client lifecycle, no `window is not defined`
- **Zero runtime dependencies** in core

---

## Examples

| Example | Stack | What it shows |
|---|---|---|
| [`analytics-dashboard-react`](./examples/analytics-dashboard-react/) | Next.js · CopilotKit | Full production demo with region, circle, lasso, and text capture |
| [`vercel-ai-sdk`](./examples/vercel-ai-sdk/) | Next.js · Vercel AI SDK | Minimal integration — 4 steps, works with any AI provider |
| [`vue-dashboard`](./examples/vue-dashboard/) | Vue 3 · Vite | Vue composables + live context panel |
| [`svelte-dashboard`](./examples/svelte-dashboard/) | Svelte 5 · Vite | Runes API + live context panel |
| [`solid-dashboard`](./examples/solid-dashboard/) | SolidJS · Vite | SolidJS signals + AI chat sidebar with tabbed context inspector |
| [`angular-dashboard`](./examples/angular-dashboard/) | Angular 19 · standalone | Angular signals + injectable services |
| [`nextjs-app-router`](./examples/nextjs-app-router/) | Next.js 15 · App Router | Vercel AI SDK streaming chat with real-time UI context |
| [`mcp-server`](./examples/mcp-server/) | Node.js · Express | Standalone MCP server — connect Claude Desktop in 5 min |
| [`vanilla-chat`](./examples/vanilla-chat/) | Vanilla JS | Zero-install HTML demo, opens in a browser |
| [`react-native-expo`](./examples/react-native-expo/) | React Native · Expo | Mobile scroll context |

---

## Live links

- **Docs:** [askable-ui.com/docs](https://askable-ui.com/docs/)
- **Analytics dashboard demo:** [askable-mu.vercel.app](https://askable-mu.vercel.app/)
- **Zero-install vanilla demo:** [`examples/vanilla-chat/index.html`](./examples/vanilla-chat/index.html) — open directly in browser, no install
- **Vue 3 example:** [`examples/vue-dashboard/`](./examples/vue-dashboard/) — `npm install && npm run dev`
- **React + Next.js example:** [`examples/analytics-dashboard-react/`](./examples/analytics-dashboard-react/)
- **React Native example:** [`examples/react-native-expo/`](./examples/react-native-expo/)

---

## Using with coding agents

[`AGENTS.md`](./AGENTS.md) has copy-pasteable instructions for Claude, Cursor, Codex, and similar tools. Drop it into your project root and your coding agent will annotate elements correctly, avoid common mistakes, and wire up the full context pipeline.

---

## Contributing

PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

The easiest contribution: a framework adapter. If you use Qwik, HTMX, Lit, or Stencil, the adapter pattern is nearly mechanical — see any of the existing framework packages as a template and open an issue to claim it.

## License

MIT — see [LICENSE](./LICENSE)
