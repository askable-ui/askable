import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

export const runtime = 'edge';

const anthropic = createAnthropic();

export async function POST(req: Request) {
  const { messages, uiContext } = await req.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    uiContext?: string;
  };

  const systemPrompt = [
    'You are a helpful assistant embedded in a web application.',
    uiContext
      ? `\n## Current UI context\n${uiContext}`
      : 'No UI element is currently focused.',
  ].join('\n');

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
