# @askable-ui/react-native

React Native bindings for askable-ui.

This initial slice focuses on explicit mobile interactions: `useAskable()` provides a context backed by `@askable-ui/core`, `useAskableScreen()` lets you mirror screen focus into that context, `useAskableScrollView()` mirrors raw `ScrollView` measurement into that context, `useAskableVisibility()` mirrors viewability updates from mobile lists, and `<Askable />` turns `onPress` / `onLongPress` interactions into prompt-ready focus updates.

A runnable Expo reference app lives in [`examples/react-native-expo`](https://github.com/askable-ui/askable/tree/main/examples/react-native-expo).

## Install

```bash
npm install @askable-ui/react-native @askable-ui/core
```

---

## `<Askable>`

Clones a single React Native pressable child and merges focus updates into its `onPress` and `onLongPress` handlers.

```tsx
import { Pressable, Text } from 'react-native';
import { Askable, useAskable } from '@askable-ui/react-native';

function RevenueCard() {
  const { ctx } = useAskable();

  return (
    <Askable ctx={ctx} meta={{ widget: 'revenue' }} text="Revenue card">
      <Pressable>
        <Text>Revenue</Text>
      </Pressable>
    </Askable>
  );
}
```

**Props:**

| Prop | Type | Description |
|---|---|---|
| `ctx` | `AskableContext` | Context instance that receives focus updates |
| `meta` | `Record<string, unknown> \| string` | Metadata pushed into the context on press |
| `text` | `string` | Optional human-readable label stored alongside `meta` |
| `children` | `ReactElement` | A single child that accepts `onPress` / `onLongPress` props |

---

## `useAskable(options?)`

Returns a React Native-friendly wrapper around an `AskableContext`.

```ts
import { useAskable } from '@askable-ui/react-native';

const { focus, promptContext, ctx } = useAskable();
```

**Options:**

| Option | Type | Description |
|---|---|---|
| `ctx` | `AskableContext` | Reuse an existing context instead of creating a new one |
| `name` | `string` | Optional context name passed through to `createAskableContext()` |
| `viewport` | `boolean` | Optional viewport-aware core context mode |
| `events` | `AskableEvent[]` | Forwarded to the underlying core context |

**Returns:**

| Value | Type | Description |
|---|---|---|
| `focus` | `AskableFocus \| null` | Current focus created by press-driven updates |
| `promptContext` | `string` | Natural-language context string for your LLM prompt |
| `ctx` | `AskableContext` | Full context instance for `push()`, `clear()`, `toHistoryContext()`, etc. |

## `useAskableScreen(options)`

Pushes screen-level context into the shared `AskableContext` while a screen is active.

```tsx
import { useIsFocused } from '@react-navigation/native';
import { useAskable, useAskableScreen } from '@askable-ui/react-native';

function RevenueScreen() {
  const isFocused = useIsFocused();
  const { ctx } = useAskable();

  useAskableScreen({
    ctx,
    active: isFocused,
    meta: { screen: 'RevenueScreen' },
    text: 'Revenue screen',
  });

  return null;
}
```

**Options:**

| Option | Type | Description |
|---|---|---|
| `ctx` | `AskableContext` | Reuse an existing context instead of creating a new one |
| `meta` | `Record<string, unknown> \| string` | Screen metadata pushed when the screen is active |
| `text` | `string` | Optional label stored alongside the screen metadata |
| `active` | `boolean` | Whether the screen is currently focused. Default: `true` |
| `clearOnBlur` | `boolean` | Clear the context when the screen becomes inactive. Default: `true` |
| `name` / `viewport` / `events` | Core options | Forwarded when the hook creates its own context |

## `useAskableScrollView(options)`

Mirrors raw `ScrollView` measurement into the shared `AskableContext` by tracking child layouts and selecting the top visible measured item.

```tsx
import { Pressable, ScrollView, Text } from 'react-native';
import { Askable, useAskable, useAskableScrollView } from '@askable-ui/react-native';

const cards = [
  { id: 'rev', title: 'Revenue', meta: { widget: 'revenue' } },
  { id: 'pipe', title: 'Pipeline', meta: { widget: 'pipeline' } },
];

function DashboardFeed() {
  const { ctx } = useAskable();
  const { onScroll, createOnItemLayout } = useAskableScrollView({
    ctx,
    getMeta: (card) => ({ ...card.meta, visible: true }),
    getText: (card) => `${card.title} is leading the dashboard scroll view`,
  });

  return (
    <ScrollView onScroll={onScroll} scrollEventThrottle={16}>
      {cards.map((card) => (
        <Askable key={card.id} ctx={ctx} meta={card.meta} text={card.title}>
          <Pressable onLayout={createOnItemLayout(card.id, card)}>
            <Text>{card.title}</Text>
          </Pressable>
        </Askable>
      ))}
    </ScrollView>
  );
}
```

**Options:**

| Option | Type | Description |
|---|---|---|
| `ctx` | `AskableContext` | Reuse an existing context instead of creating a new one |
| `active` | `boolean` | Whether scroll updates should currently affect focus. Default: `true` |
| `clearOnBlur` | `boolean` | Clear existing scroll focus when tracking becomes inactive. Default: `true` |
| `getMeta` | `(item, measured) => Record<string, unknown> \| string` | Maps the visible measured item into askable metadata |
| `getText` | `(item, measured) => string` | Optional human-readable label stored alongside the metadata |
| `selectVisible` | `(items) => item \| null` | Override which measured item should win focus. Default: the top-most visible item |
| `name` / `viewport` / `events` | Core options | Forwarded when the hook creates its own context |

**Returns:**

| Value | Type | Description |
|---|---|---|
| `ctx` | `AskableContext` | Context instance used for scroll-driven focus updates |
| `onScroll` | `(event) => void` | Attach to `ScrollView.onScroll` |
| `measureItem` | `(key, item, layout) => void` | Manually register/update a child layout |
| `unmeasureItem` | `(key) => void` | Remove a child layout when it leaves the tree |
| `clearVisibleItem` | `() => void` | Clear the current scroll-driven focus |
| `createOnItemLayout` | `(key, item) => onLayoutHandler` | Convenience helper for `onLayout` wiring |

## `useAskableVisibility(options)`

Mirrors `FlatList` / `SectionList` viewability callbacks into the shared `AskableContext`.

```tsx
import { FlatList, Text, View } from 'react-native';
import { useAskable, useAskableVisibility } from '@askable-ui/react-native';

const rows = [
  { id: 'deal-1', title: 'Enterprise renewal' },
  { id: 'deal-2', title: 'Expansion pipeline' },
];

function DealsList() {
  const { ctx } = useAskable();
  const { onViewableItemsChanged } = useAskableVisibility({
    ctx,
    getMeta: (item) => ({ dealId: item.id }),
    getText: (item) => item.title,
  });

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      onViewableItemsChanged={onViewableItemsChanged}
      renderItem={({ item }) => (
        <View>
          <Text>{item.title}</Text>
        </View>
      )}
    />
  );
}
```

**Options:**

| Option | Type | Description |
|---|---|---|
| `ctx` | `AskableContext` | Reuse an existing context instead of creating a new one |
| `active` | `boolean` | Whether visibility updates should currently affect focus. Default: `true` |
| `clearOnBlur` | `boolean` | Clear existing visibility focus when tracking becomes inactive. Default: `true` |
| `getMeta` | `(item, token) => Record<string, unknown> \| string` | Maps the visible row into askable metadata |
| `getText` | `(item, token) => string` | Optional human-readable label stored alongside the metadata |
| `selectViewable` | `(tokens) => token \| null` | Override which visible token should win focus. Default: the first visible item |
| `name` / `viewport` / `events` | Core options | Forwarded when the hook creates its own context |

## Notes

- This adapter currently covers press-driven interactions, lightweight screen-awareness, raw `ScrollView` measurement, and list viewability callbacks.
- `useAskableScreen()` is designed to pair with React Navigation's `useIsFocused()` or a similar focus signal.
- `useAskableScrollView()` is a good fit for custom dashboard layouts built with `ScrollView`.
- `useAskableVisibility()` is ideal for `FlatList` / `SectionList`.
- Existing child `onPress` / `onLongPress` handlers are preserved and still run.
