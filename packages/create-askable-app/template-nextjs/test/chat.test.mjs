import assert from 'node:assert/strict';
import { after, beforeEach, mock, test } from 'node:test';
import { DefaultChatTransport, readUIMessageStream } from 'ai';

// No provider request is ever forwarded to the network.
const MODEL = 'claude-haiku-4-5-20251001';
const PROVIDER_URL = 'https://api.anthropic.com/v1/messages';
const keyName = 'ANTHROPIC_API_KEY';
const previousKey = process.env[keyName];
process.env[keyName] = 'test-only-not-a-real-key';
after(() => {
  if (previousKey === undefined) delete process.env[keyName];
  else process.env[keyName] = previousKey;
});

const requests = [];
let providerError = false;
mock.method(globalThis, 'fetch', async (url, options) => {
  assert.equal(String(url), PROVIDER_URL, 'unexpected outbound request blocked');
  assert.equal(options.method, 'POST');
  const body = JSON.parse(options.body);
  assert.equal(body.model, MODEL);
  assert.equal(body.stream, true);
  requests.push(body);
  if (providerError) {
    return Response.json({ error: { type: 'authentication_error', message: 'private-provider-detail' } }, { status: 401 });
  }
  const events = [
    { type: 'message_start', message: { id: 'mock-message', model: MODEL, role: 'assistant', usage: { input_tokens: 1, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ...['Hello ', 'dashboard'].map((text) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })),
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 2 } },
    { type: 'message_stop' },
  ].map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
  return new Response(events, { headers: { 'Content-Type': 'text/event-stream' } });
});

const { POST } = await import('../app/api/chat/route.ts');
assert.equal(requests.length, 0, 'route imports must not invoke a provider');

beforeEach(() => {
  requests.length = 0;
  providerError = false;
});

const userMessage = (id, text) => ({ id, role: 'user', parts: [{ type: 'text', text }] });
const textOf = (message) => typeof message.content === 'string'
  ? message.content
  : message.content.filter((part) => part.type === 'text').map((part) => part.text).join('');
const systemOf = (request) => request.system.map((part) => part.text).join('\n');
const conversationOf = (request) => request.messages.filter((message) => message.role !== 'system')
  .map((message) => ({ role: message.role, text: textOf(message) }));

async function send(messages, uiContext) {
  const transport = new DefaultChatTransport({
    api: '/api/chat',
    fetch: async (url, options) => {
      assert.equal(url, '/api/chat');
      const response = await POST(new Request('http://example.test/api/chat', options));
      assert.match(response.headers.get('content-type'), /text\/event-stream/);
      assert.equal(response.headers.get('x-vercel-ai-ui-message-stream'), 'v1');
      return response;
    },
  });
  const stream = await transport.sendMessages({
    chatId: 'test-chat',
    trigger: 'submit-message',
    messages,
    body: { uiContext },
  });
  let message;
  for await (const update of readUIMessageStream({ stream, terminateOnError: true })) message = update;
  return message;
}

test('UI-message stream round trips through the installed provider and SDK transport', async () => {
  const first = userMessage('first', 'What is focused?');
  first.parts.push({ type: 'text', text: ' Explain briefly.' });
  const answer = await send([first], 'Revenue: $2.4M');
  assert.equal(answer.role, 'assistant');
  assert.equal(answer.parts.filter((part) => part.type === 'text').map((part) => part.text).join(''), 'Hello dashboard');
  assert.ok(answer.id);
  assert.equal(requests.length, 1);
  assert.match(systemOf(requests[0]), /Revenue: \$2.4M/);
  assert.deepEqual(conversationOf(requests[0]), [{ role: 'user', text: 'What is focused? Explain briefly.' }]);

  const second = await send([first, answer, userMessage('second', 'And now?')], 'Churn: 2.1%');
  assert.notEqual(second.id, answer.id);
  assert.equal(requests.length, 2);
  assert.match(systemOf(requests[1]), /Churn: 2.1%/);
  assert.doesNotMatch(systemOf(requests[1]), /Revenue: \$2.4M/);
  assert.deepEqual(conversationOf(requests[1]), [
    { role: 'user', text: 'What is focused? Explain briefly.' },
    { role: 'assistant', text: 'Hello dashboard' },
    { role: 'user', text: 'And now?' },
  ]);
});

test('missing context still allows a text conversation', async () => {
  const answer = await send([userMessage('first', 'Hello')]);
  assert.equal(answer.role, 'assistant');
  assert.doesNotMatch(systemOf(requests[0]), /undefined/);
});

test('provider errors are masked in the UI stream', async (t) => {
  providerError = true;
  t.mock.method(console, 'error', () => {});
  await assert.rejects(send([userMessage('first', 'Hello')]), (error) => {
    assert.doesNotMatch(error.message, /private-provider-detail|test-only-not-a-real-key/);
    return true;
  });
  assert.equal(requests.length, 1);
});

test('malformed JSON is rejected before any provider request', async () => {
  await assert.rejects(POST(new Request('http://example.test/api/chat', { method: 'POST', body: '{' })));
  assert.equal(requests.length, 0);
});
