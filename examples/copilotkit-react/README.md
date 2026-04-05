# CopilotKit + Askable example

This example demonstrates the core Askable interaction pattern for AI-native UIs:

1. annotate a meaningful UI region
2. explicitly select it with `ctx.select()`
3. open an assistant panel
4. pass `promptContext` into the AI layer

## What this version includes

- three Askable metric cards
- explicit `Ask AI` buttons
- a side-panel assistant shell
- a visible `promptContext` preview
- a clear handoff point for CopilotKit or AI SDK wiring

## Next steps

- replace the mock assistant response with real CopilotKit wiring
- add streaming messages
- add richer dashboard widgets and examples
