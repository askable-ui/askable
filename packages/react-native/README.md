# @askable-ui/react-native

React Native bindings for askable.

## First slice

- `useAskable()` hook backed by `@askable-ui/core`
- `<Askable ctx={...}>` wrapper that turns `onPress` / `onLongPress` into context updates

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
