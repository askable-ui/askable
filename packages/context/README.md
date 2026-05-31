# @askable-ui/context

Typed packet format and schema for sending web context to AI agents.

This package is intentionally small: it defines the versioned packet shape,
exports a JSON Schema, and includes helpers for constructing and identifying
packets. Capture runtimes such as `@askable-ui/core`, browser extensions, and
MCP bridges can all emit the same packet format.

```ts
import { createWebContextPacket } from '@askable-ui/context';

const packet = createWebContextPacket({
  capture: { mode: 'element-focus', gesture: 'click' },
  target: {
    text: 'Revenue',
    metadata: { metric: 'revenue', value: '$2.3M' },
  },
});
```
