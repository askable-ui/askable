/**
 * askable-ui MCP Server Quickstart
 *
 * This server does two things:
 *   1. Serves a demo frontend page on http://localhost:3001
 *   2. Exposes an MCP endpoint on http://localhost:3001/mcp
 *      that Claude Desktop (or any MCP client) can connect to
 *
 * Connect Claude Desktop by adding to claude_desktop_config.json:
 *   { "mcpServers": { "my-app": { "url": "http://localhost:3001/mcp" } } }
 */

import express from 'express';
import { createAskableMcpWebHandler, defaultPromptFormatter } from '@askable-ui/mcp';
import { createWebContextPacket } from '@askable-ui/context';

const PORT = process.env.PORT ?? 3001;

// --- In-memory context store ---
// In production this would come from your database / session store.
let currentPacket = createWebContextPacket({
  source: { app: 'mcp-demo', url: 'http://localhost:3001' },
  capture: { mode: 'element-focus' },
});

// --- MCP provider ---
// Implement AskableMcpContextProvider — the shape Claude calls into.
const provider = {
  getContext() {
    return currentPacket;
  },
  formatContextForPrompt(packet) {
    return defaultPromptFormatter(packet);
  },
};

// --- MCP HTTP handler ---
const mcpHandler = createAskableMcpWebHandler({
  provider,
  cors: true,
  authorize(request) {
    // Add auth here in production (bearer token, API key, etc.)
    // Returning true allows all requests.
    const origin = request.headers.get('origin');
    console.log(`[mcp] request from ${origin ?? 'unknown origin'}`);
    return true;
  },
});

// --- Express adapter ---
// createAskableMcpWebHandler returns a fetch-compatible handler.
// This small adapter bridges it to Express.
async function bridgeMcpRequest(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const url = `http://localhost:${PORT}${req.url}`;
  const fetchReq = new Request(url, {
    method: req.method,
    headers: /** @type {Record<string, string>} */ (req.headers),
    body: body.length > 0 ? body : undefined,
    duplex: 'half',
  });

  const fetchRes = await mcpHandler(fetchReq);

  res.status(fetchRes.status);
  for (const [key, value] of fetchRes.headers.entries()) {
    res.set(key, value);
  }
  const responseBody = await fetchRes.arrayBuffer();
  res.send(Buffer.from(responseBody));
}

// --- Express app ---
const app = express();
app.use(express.json());

// Serve frontend demo
app.use(express.static('public'));

// Context update endpoint — the browser pushes here on every focus/click
app.post('/update-context', (req, res) => {
  const packet = req.body;
  if (packet && typeof packet === 'object') {
    currentPacket = packet;
    console.log(`[context] updated: ${packet.capture?.mode ?? 'unknown'} — ${packet.target?.text ?? 'no text'}`);
  }
  res.json({ ok: true });
});

// MCP endpoint for Claude Desktop / any MCP client
app.all('/mcp', bridgeMcpRequest);
app.options('/mcp', bridgeMcpRequest);

app.listen(PORT, () => {
  console.log(`\n  askable-ui MCP server running\n`);
  console.log(`  Frontend: http://localhost:${PORT}`);
  console.log(`  MCP endpoint: http://localhost:${PORT}/mcp\n`);
  console.log(`  Add to claude_desktop_config.json:`);
  console.log(`  {`);
  console.log(`    "mcpServers": {`);
  console.log(`      "my-app": { "url": "http://localhost:${PORT}/mcp" }`);
  console.log(`    }`);
  console.log(`  }\n`);
});
