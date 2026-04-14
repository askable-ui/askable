# Askable Context Capture — React Native (Expo) Example

A runnable Expo app that demonstrates how `@askable-ui/react-native` captures mobile UI context.

## What it shows

- Shared `AskableContext` created with `useAskable()`
- Screen-level context updates with `useAskableScreen()` and React Navigation's `useIsFocused()`
- Visibility-driven list context updates with `useAskableVisibility()`
- Press-driven focus updates with `<Askable>` wrappers around `Pressable` cards
- A live prompt preview panel showing what an AI layer would receive

## Running locally

```bash
cd examples/react-native-expo
npm install
npm run start
```

Then open the project in Expo Go, an iOS simulator, or an Android emulator.

## Example flow

1. Launch the app on the **Dashboard** screen.
2. Tap a metric card like **Revenue**.
3. Notice the **Prompt context** panel update with the selected card metadata.
4. Open the **Insights** screen.
5. Notice the screen-level context changes because `useAskableScreen()` is bound to navigation focus.
6. Scroll the insights list and watch the leading visible card update context through `useAskableVisibility()`.
7. Tap an insight action card to further refine the prompt context.

## Key integration snippet

```tsx
const { ctx, promptContext } = useAskable({ name: 'react-native-example' });
const isFocused = useIsFocused();

useAskableScreen({
  ctx,
  active: isFocused,
  meta: { screen: 'Insights', section: 'analysis' },
  text: 'Insights analysis screen',
});

const { onViewableItemsChanged } = useAskableVisibility({
  ctx,
  active: isFocused,
  getMeta: (item) => ({ ...item.meta, visible: true }),
  getText: (item) => `${item.title} is visible`,
});

<FlatList onViewableItemsChanged={onViewableItemsChanged} /* ... */ />;

<Askable ctx={ctx} meta={{ panel: 'dropoff-analysis' }} text="Drop-off analysis panel">
  <Pressable>{/* ... */}</Pressable>
</Askable>;
```

See `App.tsx` for the complete example.
