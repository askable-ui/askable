# React Native Guide

`@askable-ui/react-native` is a press-driven adapter on top of `@askable-ui/core`. Where the web bindings observe DOM events automatically, the mobile adapter wires focus into explicit interactions — `onPress`, `onLongPress`, screen focus, list viewability, and `ScrollView` measurement — because React Native has no DOM to observe.

## Install

```bash
npm install @askable-ui/react-native @askable-ui/core
```

A runnable Expo reference app lives in [`examples/react-native-expo`](https://github.com/askable-ui/askable/tree/main/examples/react-native-expo).

## Quick start

Unlike the web adapters, React Native has no global context — you create one with `useAskable()` and pass its `ctx` to every `<Askable>` wrapper and source hook.

```tsx
import { Pressable, Text, View } from 'react-native';
import { Askable, useAskable } from '@askable-ui/react-native';

export function RevenueScreen() {
  const { ctx, focus, promptContext } = useAskable();

  return (
    <View>
      <Askable ctx={ctx} meta={{ metric: 'revenue', value: '$128k', period: 'Q3' }} text="Revenue card">
        <Pressable>
          <Text>$128k</Text>
        </Pressable>
      </Askable>

      {focus && <Text>Focused: {JSON.stringify(focus.meta)}</Text>}
    </View>
  );
}
```

## `<Askable>`

Clones a **single** pressable child and merges focus updates into its `onPress` and `onLongPress` handlers — the child's own handlers still run. Nested `<Askable>` wrappers contribute ancestor segments, so press-driven flows serialize the same hierarchy paths as DOM-based web flows.

```tsx
<Askable ctx={ctx} meta={{ widget: 'churn-rate', value: '4.2%' }} scope="dashboard" text="Churn rate">
  <Pressable onPress={() => navigate('ChurnDetail')}>
    <Text>Churn 4.2%</Text>
  </Pressable>
</Askable>
```

| Prop | Type | Description |
|---|---|---|
| `ctx` | `AskableContext` | **Required.** The context from `useAskable()`. |
| `meta` | `object \| string` | Structured data or a label for this element. |
| `scope` | `string` | Optional grouping scope. |
| `text` | `string` | Optional human-readable text stored with the focus. |
| `children` | a single pressable element | Must accept `onPress` / `onLongPress`. |

## `useAskable(options?)`

Creates (or accepts) a context and returns the current focus plus a serialized prompt string.

```tsx
const { ctx, focus, promptContext } = useAskable();

// ctx           — AskableContext to pass to <Askable> and source hooks
// focus         — current AskableFocus | null
// promptContext — serialized string for your LLM prompt
```

Pass `{ ctx }` to share an existing context (e.g. one created by `useAskableScreen`) instead of creating a new one.

## Screen focus

`useAskableScreen` pushes screen-level metadata into the context while the screen is active, and clears it on blur. It returns the context so you can hand it to `<Askable>` children — ideal with React Navigation's `useIsFocused()`.

```tsx
import { useIsFocused } from '@react-navigation/native';
import { useAskableScreen } from '@askable-ui/react-native';

export function OrdersScreen() {
  const isFocused = useIsFocused();
  const ctx = useAskableScreen({
    meta: { screen: 'orders', tab: 'open' },
    text: 'Orders list',
    active: isFocused,
  });

  return <OrdersList ctx={ctx} />;
}
```

## List viewability (FlatList / SectionList)

`useAskableVisibility` turns React Native's `onViewableItemsChanged` into focus updates, so the AI always knows which item is on screen. Wire its handler straight into the list.

```tsx
import { FlatList, Pressable, Text } from 'react-native';
import { useAskableVisibility } from '@askable-ui/react-native';

export function ProductFeed({ products }) {
  const { ctx, onViewableItemsChanged } = useAskableVisibility({
    getMeta: (item) => ({ product: item.id, name: item.name, price: item.price }),
    getText: (item) => item.name,
  });

  return (
    <FlatList
      data={products}
      keyExtractor={(p) => p.id}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      renderItem={({ item }) => (
        <Pressable><Text>{item.name}</Text></Pressable>
      )}
    />
  );
}
```

By default the first viewable item wins focus; override with `selectViewable`. Pass `active: false` to pause tracking (e.g. when the screen is blurred).

## ScrollView measurement

For plain `ScrollView`s (no viewability callback), `useAskableScrollView` measures children and reports the top-most visible one as you scroll.

```tsx
import { ScrollView, View, Pressable, Text } from 'react-native';
import { useAskableScrollView } from '@askable-ui/react-native';

export function Dashboard({ cards }) {
  const { ctx, onScroll, createOnItemLayout } = useAskableScrollView({
    getMeta: (card) => ({ card: card.id, title: card.title }),
    getText: (card) => card.title,
  });

  return (
    <ScrollView onScroll={onScroll} scrollEventThrottle={16}>
      {cards.map((card) => (
        <View key={card.id} onLayout={createOnItemLayout(card.id, card)}>
          <Pressable><Text>{card.title}</Text></Pressable>
        </View>
      ))}
    </ScrollView>
  );
}
```

`createOnItemLayout(key, item)` returns an `onLayout` handler that registers each child's position; the hook recomputes the visible item on every scroll. Use `measureItem` / `unmeasureItem` directly if you manage layout yourself.

## Custom sources

`useAskableSource` registers any app state on the context so the AI can read it. Pass a source object — `resolve()` returns the data the AI should see — and share the same `ctx`.

```tsx
import { useAskableSource } from '@askable-ui/react-native';

function CartSource({ ctx, cart }) {
  useAskableSource(
    'cart',
    {
      kind: 'cart',
      describe: 'Shopping cart contents',
      resolve: () => ({ items: cart, count: cart.length }),
    },
    { ctx },
  );
  return null;
}
```

The hook returns `notifyChanged()` — call it after the source data changes to refresh anything reading the context.

## Streaming and chat

`useAskableStream` and `useAskableChat` mirror the web adapters — they build a request from the current context and stream your backend's response. `fetch` works the same in React Native.

```tsx
import { useAskableStream } from '@askable-ui/react-native';

export function AskButton({ ctx }) {
  const { stream, content, isStreaming } = useAskableStream({ ctx });

  return (
    <>
      {isStreaming && <Text>Thinking…</Text>}
      {!!content && <Text>{content}</Text>}
      <Pressable
        disabled={isStreaming}
        onPress={() =>
          stream('Explain what I am looking at', async (req, emit) => {
            const res = await fetch('https://api.example.com/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(req),
            });
            emit(await res.text());
          })
        }
      >
        <Text>Ask AI</Text>
      </Pressable>
    </>
  );
}
```

> React Native's `fetch` does not expose a readable stream body, so emit the full text once (as above) or use a streaming transport such as `react-native-sse` / `expo/fetch` and `emit()` each chunk. `useAskableChat` follows the same pattern across multiple turns and injects the UI context automatically.

## Agent requests

Build a structured request with context, focus, and history straight from the context:

```tsx
const { ctx } = useAskable();

const req = await ctx.toAgentRequest('Why did this metric drop?', { history: 3 });

await fetch('https://api.example.com/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(req),
});
```

## API reference

See the [`@askable-ui/react-native` API reference](/api/react-native) for full prop and option tables.
