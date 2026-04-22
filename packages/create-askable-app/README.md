# create-askable-app

Scaffold a runnable **React + Vite + CopilotKit + askable-ui** starter app.

## Usage

```bash
npx create-askable-app my-app
cd my-app
npm install
npm run dev
```

The generated app includes:

- a small analytics dashboard annotated with `data-askable`
- `useAskable()` pre-wired for hover + click focus tracking
- `useCopilotReadable()` pushing current and recent Askable context into CopilotKit
- a local Express runtime wired to `@copilotkit/runtime`
- a starter README and `.env.example`

## Notes

- The scaffold writes files only. It does **not** auto-run `npm install`.
- If `OPENAI_API_KEY` is missing, the generated runtime still starts so the app boots locally, but Copilot responses stay disabled until you add a real key.
