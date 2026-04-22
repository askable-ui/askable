import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import type { Request, Response } from 'express';
import { BuiltInAgent, CopilotRuntime, createCopilotExpressHandler } from '@copilotkit/runtime/v2';

const port = Number(process.env.PORT ?? 3001);
const endpoint = '/api/copilotkit';
const frontendOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: `openai/${openAiModel}`,
      apiKey: openAiApiKey,
      prompt:
        'You are a helpful revenue operations copilot. Use the Askable current-focus context and recent focus history to answer precisely about the currently selected KPI, chart, or deal row. If the user has not selected anything yet, ask them what they want to inspect.',
    }),
  },
});

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(
  createCopilotExpressHandler({
    runtime,
    basePath: endpoint,
    mode: 'single-route',
    cors: {
      origin: frontendOrigin,
      credentials: true,
    },
  }),
);

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    endpoint,
    llmReady: Boolean(openAiApiKey),
    model: `openai/${openAiModel}`,
  });
});

app.listen(port, () => {
  const status = openAiApiKey
    ? `BuiltInAgent using openai/${openAiModel}`
    : `BuiltInAgent using openai/${openAiModel} (set OPENAI_API_KEY to enable live responses)`;
  console.log(`Copilot runtime listening on http://localhost:${port}${endpoint}`);
  console.log(`Frontend origin: ${frontendOrigin}`);
  console.log(`Agent: ${status}`);
});
