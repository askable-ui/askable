# @askable-ui/react-native

React Native bindings for askable.

## Current slice

- `useAskable()` hook backed by `@askable-ui/core`
- `useAskableScreen()` hook for screen/navigation-aware context updates
- `useAskableVisibility()` hook for FlatList / SectionList visibility-driven context updates
- `useAskableScrollView()` hook for raw `ScrollView` measurement-driven visibility tracking
- `<Askable ctx={...}>` wrapper that turns `onPress` / `onLongPress` into context updates
- Runnable Expo example in [`examples/react-native-expo`](../../examples/react-native-expo)

## Example

```tsx
import { Pressable, Text } from 'react-native';
import { Askable, useAskable } from '@askable-ui/react-native';

export function RevenueCard() {
  const { ctx, promptContext } = useAskable();

  return (
    <Askable ctx={ctx} meta={{ widget: 'revenue' }} text="Revenue card">
      <Pressable>
        <Text>Revenue</Text>
      </Pressable>
    </Askable>
  );
}
```

## Screen awareness

Use `useAskableScreen()` to push the active screen into context. It is designed to pair cleanly with React Navigation's `useIsFocused()` without forcing a hard dependency on React Navigation inside this package.

```tsx
import { useIsFocused } from '@react-navigation/native';
import { useAskable, useAskableScreen } from '@askable-ui/react-native';

export function RevenueScreen() {
  const isFocused = useIsFocused();
  const { ctx, promptContext } = useAskable();

  useAskableScreen({
    ctx,
    active: isFocused,
    meta: { screen: 'RevenueScreen' },
    text: 'Revenue screen',
  });

  return null;
}
```

## List visibility awareness

Use `useAskableVisibility()` with `FlatList` / `SectionList` viewability callbacks to mirror the top visible item into askable context while the user scrolls.

```tsx
import { FlatList, Text, View } from 'react-native';
import { useAskable, useAskableVisibility } from '@askable-ui/react-native';

const products = [
  { id: 'p-1', title: 'Revenue Dashboard' },
  { id: 'p-2', title: 'Pipeline Summary' },
];

export function ProductList() {
  const { ctx } = useAskable();
  const { onViewableItemsChanged } = useAskableVisibility({
    ctx,
    getMeta: (item) => ({ productId: item.id }),
    getText: (item) => item.title,
  });

  return (
    <FlatList
      data={products}
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

## Raw ScrollView tracking

For dashboards or custom feeds built with `ScrollView`, use `useAskableScrollView()` to measure child layouts and mirror the top visible card into askable context.

```tsx
import { Pressable, ScrollView, Text } from 'react-native';
import { Askable, useAskable, useAskableScrollView } from '@askable-ui/react-native';

const cards = [
  { id: 'revenue', title: 'Revenue', meta: { widget: 'revenue' } },
  { id: 'pipeline', title: 'Pipeline', meta: { widget: 'pipeline' } },
];

export function Dashboard() {
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
