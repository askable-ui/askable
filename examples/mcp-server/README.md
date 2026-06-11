# askable-ui — MCP Server Quickstart

Give **Claude Desktop** (or any MCP client) eyes into your web app in under 5 minutes.

When the user clicks a dashboard element, the MCP server tells Claude exactly which metric, deal, or row they're looking at — no screenshots, no description needed.

## How it works

```
Browser                       Server                    Claude Desktop
──────────────────────────────────────────────────────────────────────
User clicks KPI card
  → POST /update-context  →   stores packet in memory
                                                         get_current_context
                              ← returns packet       ←  (MCP tool call)
Claude answers accurately
```

## Quick start

```bash
npm install
npm start
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Connect Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-app": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

Restart Claude Desktop, then click an element in the browser and ask Claude:

> "What is the user currently looking at?"
> "What's the risk level of the focused deal?"
> "Summarize the current metric."

Claude will answer using the exact live data from the page.

## Adapting to your app

### 1. Add `data-askable` to your UI elements

```html
<!-- Any element with structured metadata -->
<div data-askable='{"metric":"nrr","value":118,"unit":"percent"}'>
  NRR: 118%
</div>

<tr data-askable='{"company":"Acme","stage":"Proposal","value":85000}'>
  ...
</tr>
```

### 2. Push context on focus/click

```javascript
async function pushContext(element) {
  const metadata = JSON.parse(element.dataset.askable);
  await fetch('/update-context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capture: { mode: 'element-focus' },
      source: { url: window.location.href, title: document.title },
      target: { metadata, text: element.textContent.trim() },
      privacy: { consent: 'explicit' },
    }),
  });
}
```

### 3. Add authentication in production

Edit `server.js` and replace the `authorize` function:

```javascript
const mcpHandler = createAskableMcpWebHandler({
  provider,
  cors: { origin: ['https://your-domain.com'] },
  authorize(request) {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    return token === process.env.MCP_SECRET_TOKEN;
  },
});
```

Then add to Claude Desktop config:
```json
{
  "mcpServers": {
    "my-app": {
      "url": "https://your-server.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_SECRET_TOKEN" }
    }
  }
}
```

## Using with a React/Vue/Svelte frontend

If your frontend uses the askable-ui framework adapters, you can push context using the native hook:

**React:**
```tsx
import { useAskable } from '@askable-ui/react';

function Dashboard() {
  const { promptContext } = useAskable({ observe: true });

  useEffect(() => {
    if (promptContext) {
      fetch('/update-context', { ... }); // or use askable.ctx.toContextPacket()
    }
  }, [promptContext]);
}
```

See the [`analytics-dashboard-react`](../analytics-dashboard-react/) example for a full integration.

## Deploy to production

The `createAskableMcpWebHandler` returns a standard fetch-compatible handler — deploy it anywhere:

**Vercel / Edge functions:**
```typescript
import { createAskableMcpWebHandler } from '@askable-ui/mcp';
export const POST = createAskableMcpWebHandler({ provider, cors: true });
```

**Cloudflare Workers:**
```typescript
export default { fetch: createAskableMcpWebHandler({ provider }) };
```

**AWS Lambda / Hono:**
```typescript
import { Hono } from 'hono';
const handler = createAskableMcpWebHandler({ provider });
app.all('/mcp', (c) => handler(c.req.raw));
```
