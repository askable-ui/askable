import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

// Serve only the two assets used by the website tests, never the checkout.
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/askable-ui-code.mp4', ['askable-ui-code.mp4', 'video/mp4']],
]);

createServer(async (request, response) => {
  const asset = assets.get(new URL(request.url, 'http://localhost').pathname);
  if (!asset || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(new URL(`../www/${asset[0]}`, import.meta.url));
    response.writeHead(200, { 'content-type': asset[1], 'content-length': body.length });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500).end();
  }
}).listen(4186, '127.0.0.1');
