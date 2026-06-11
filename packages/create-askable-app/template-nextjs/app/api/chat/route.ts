import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

export const runtime = 'edge';

const anthropic = createAnthropic();

export async function POST(req: Request) {
  const { messages, uiContext } = await req.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    uiContext?: string;
  };

  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: [
      'You are a helpful assistant embedded in a web app.',
      uiContext ? `\n## Current UI context\n${uiContext}` : '',
    ].join('\n'),
    messages,
  });

  return result.toDataStreamResponse();
}
