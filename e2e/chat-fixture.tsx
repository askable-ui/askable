import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createAskableContext, type AskableAgentRequest } from '@askable-ui/core';
import { useAskableChat } from '../packages/react/src/useAskableChat.js';

const ctx = createAskableContext();
ctx.push({ company: 'Acme' }, 'Acme account');

function ReviewedChat() {
  const chat = useAskableChat({ ctx });
  const [question, setQuestion] = useState('Explain this account');
  const [review, setReview] = useState<AskableAgentRequest | null>(null);

  async function prepare() {
    const request = await ctx.toAgentRequest(question, { packet: true, requestId: 'review-1' });
    setReview(JSON.parse(JSON.stringify(request)) as AskableAgentRequest);
  }

  async function send() {
    if (!review) return;
    await chat.appendRequest(review, async (request, _messages, emit, signal) => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      emit(await response.text());
    });
  }

  return (
    <main>
      <h1>Reviewed context</h1>
      <button onClick={() => ctx.push({ company: 'Acme' }, 'Acme account')}>Focus Acme</button>
      <button onClick={() => ctx.push({ company: 'Globex' }, 'Globex account')}>Focus Globex</button>
      <label>Question<input value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
      <button onClick={prepare}>Review</button>
      {review && <pre aria-label="Reviewed payload">{JSON.stringify(review, null, 2)}</pre>}
      <button disabled={!review || chat.isStreaming} onClick={send}>Send approved</button>
      <button disabled={!chat.isStreaming} onClick={chat.abort}>Stop</button>
      <button onClick={chat.clearMessages}>Clear chat</button>
      <output aria-label="Chat status">{chat.status}</output>
      {chat.error instanceof Error && <p role="alert">{chat.error.message}</p>}
      <section aria-label="Conversation">
        {chat.messages.map((message) => <p key={message.id}>{message.content}</p>)}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<ReviewedChat />);
