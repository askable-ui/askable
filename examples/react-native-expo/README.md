# Askable Context Capture — React Native (Expo) Example

A runnable Expo app that demonstrates how `@askable-ui/react-native` captures mobile UI context.

## What it shows

- Shared `AskableContext` created with `useAskable()`
- Screen-level context updates with `useAskableScreen()` and React Navigation's `useIsFocused()`
- Raw `ScrollView` measurement-driven context updates with `useAskableScrollView()`
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
2. Scroll the dashboard and watch the leading metric card update context through `useAskableScrollView()`.
3. Tap a metric card like **Revenue** to refine the prompt context further.
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
  meta: { screen: 'Dashboard', section: 'overview' },
  text: 'Dashboard overview screen',
});

const { onScroll, createOnItemLayout } = useAskableScrollView({
  ctx,
  active: isFocused,
  getMeta: (card) => ({ ...card.meta, visible: true, source: 'scrollview-measurement' }),
  getText: (card) => `${card.title} is currently leading the dashboard scroll view`,
});

<ScrollView onScroll={onScroll} scrollEventThrottle={16}>
  {dashboardCards.map((card) => (
    <Askable key={card.title} ctx={ctx} meta={card.meta} text={card.text}>
      <Pressable onLayout={createOnItemLayout(card.title, card)}>{/* ... */}</Pressable>
    </Askable>
  ))}
</ScrollView>;
```

See `App.tsx` for the complete example.
