import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

export const runtime = 'edge';

const anthropic = createAnthropic();

/**
 * Endpoint designed for use with useAskableChat / useAskableStream.
 * Receives an AskableAgentRequest + optional messages array.
 * Returns a plain text stream (compatible with ReadableStream<string> / TextDecoderStream).
 */
export async function POST(req: Request) {
  const body = await req.json() as {
    question: string;
    context: string;
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  const systemPrompt = [
    'You are a helpful assistant embedded in a web application.',
    body.context ? `\n## Current UI context\n${body.context}` : '',
  ].filter(Boolean).join('\n');

  const history = (body.messages ?? []).slice(0, -1).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    messages: [
      ...history,
      { role: 'user', content: body.question },
    ],
  });

  return result.toTextStreamResponse();
}
