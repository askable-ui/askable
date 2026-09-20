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

Use Node.js 22 LTS. This example stays on [Expo SDK 55](https://expo.dev/changelog/sdk-55)
with React 19.2 and React Native 0.83. Its native dependencies match the SDK 55
bundled versions, not the latest versions from other SDKs.

```bash
cd examples/react-native-expo
npm ci --strict-peer-deps
npm run start
```

Use an SDK 55-compatible Expo Go client on Android or an iOS simulator, or create
a development build with `npm run android` / `npm run ios`. The current store
version of Expo Go may not support SDK 55; see
[Expo's version guidance](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).
For the browser version, run `npm run web`.

The example uses the published `@askable-ui/*` packages declared in its manifest
for both typechecking and bundling. It does not require installing or building
the repository's root workspace, and does not alias imports to workspace source.

## Validation

From this directory, using Node.js 22 LTS:

```bash
export CI=1
npm ci --strict-peer-deps
npm audit --audit-level=low
npm ls --all
npx expo install --check
npx --yes expo-doctor@1.20.4 --verbose
npm run test:dependencies
npm run typecheck
npx expo export --platform all --output-dir dist/export --max-workers 2
```

The Expo workflow runs these same commands. Export validates JavaScript and
asset bundling for Android, iOS, and web; it does not build or run a native app.
See [dependency security notes](SECURITY.md) for the audit baseline, the scoped
override, and remaining upstream maintenance risks.

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
