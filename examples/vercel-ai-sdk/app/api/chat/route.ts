import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, generateId, streamText, type UIMessage } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, uiContext } = await req.json() as {
    messages: UIMessage[];
    uiContext?: string;
  };

  const systemPrompt = [
    'You are a helpful AI assistant embedded in a sales analytics dashboard.',
    'Answer questions concisely — 1-3 sentences unless asked for detail.',
    '',
    uiContext
      ? `Current UI context (what the user is looking at right now):\n${uiContext}`
      : 'No UI element is currently focused.',
  ].join('\n');

  const result = streamText({
    model: openai.chat('gpt-4o-mini'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({ originalMessages: messages, generateMessageId: generateId });
}
