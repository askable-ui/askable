import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createWebContextPacket, isWebContextPacket, webContextPacketSchema } from '@askable-ui/context';
import { createAskableContext, createAskableUserSource } from '@askable-ui/core';
import {
  createAskableBridge,
  createAskableBridgeEnvelope,
  createFunctionTransport,
  createPostMessageTransport,
  isAskableBridgeEnvelope,
} from '@askable-ui/bridge';
import {
  ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL,
  ASKABLE_MCP_PAGE_BRIDGE_VERSION,
  createAskableMcpContextProvider,
  createAskableMcpPageBridge,
  createAskableMcpRemoteProvider,
} from '@askable-ui/mcp';

// All transport fixtures stay in memory; even an accidental real fetch fails.
globalThis.fetch = async () => { throw new Error('Network access is forbidden in artifact API checks'); };
const origin = 'https://artifact.invalid';
const raw = 'synthetic-raw-fixture';
const safe = 'Public fixture';
const packet = () => createWebContextPacket({
  source: { app: 'artifact-check', timestamp: '2026-01-01T00:00:00.000Z' },
  capture: { mode: 'semantic' },
  target: { text: safe },
  privacy: { redacted: true, consent: 'explicit' },
});

const cliPath = fileURLToPath(new URL('node_modules/@askable-ui/mcp/dist/cli.js', import.meta.url));
const cliBin = process.platform === 'win32'
  ? cliPath
  : fileURLToPath(new URL('node_modules/.bin/askable-mcp', import.meta.url));

test('installed MCP executable prints help and rejects missing or invalid arguments', () => {
  for (const [args, status, message] of [
    [['--help'], 0, /Usage:/],
    [[], 1, /one of --url or --file is required/],
    [['--unknown-option'], 1, /Unknown option/],
  ]) {
    const result = spawnSync(process.execPath, [cliBin, ...args], { encoding: 'utf8', timeout: 5_000 });
    assert.ifError(result.error);
    assert.equal(result.status, status, result.stderr);
    assert.equal(result.stdout, '', 'stdout must remain reserved for MCP');
    assert.match(result.stderr, message);
  }
});

test('MCP executable resolves symlinks containing spaces and URL characters', {
  skip: process.platform === 'win32', // Creating symlinks can require administrator privileges on Windows.
}, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'askable-cli-'));
  try {
    const link = path.join(directory, 'cli shortcut #.js');
    symlinkSync(cliPath, link);
    const result = spawnSync(process.execPath, [link, '--help'], { encoding: 'utf8', timeout: 5_000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /Usage:/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('installed MCP executable serves a packet through a real stdio client', { timeout: 10_000 }, async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'askable-cli-'));
  const fixture = path.join(directory, 'packet.json');
  const expected = packet();
  writeFileSync(fixture, JSON.stringify(expected));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliBin, '--file', fixture, '--require-redacted'],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'artifact-check', version: '1.0.0' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.ok(tools.some(({ name }) => name === 'get_current_context'));
    const result = await client.callTool({ name: 'get_current_context', arguments: {} });
    assert.ok(!result.isError);
    assert.deepEqual(JSON.parse(result.content[0].text), expected);
    writeFileSync(fixture, JSON.stringify({ ...expected, privacy: { ...expected.privacy, redacted: false } }));
    const blocked = await client.callTool({ name: 'get_current_context', arguments: {} });
    assert.equal(blocked.isError, true);
  } finally {
    await transport.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('all public imports resolve to installed files, not workspace links', () => {
  for (const name of ['context', 'core', 'bridge', 'mcp']) {
    const packageName = `@askable-ui/${name}`;
    const installed = realpathSync(new URL(`node_modules/${packageName}/`, import.meta.url));
    const resolved = realpathSync(fileURLToPath(import.meta.resolve(packageName)));
    assert.ok(resolved.startsWith(`${installed}${path.sep}`), packageName);
  }
});

test('context exports its packet factory, schema and privacy guard', () => {
  assert.equal(webContextPacketSchema.type, 'object');
  assert.equal(isWebContextPacket(packet()), true);
  for (const privacy of [undefined, null, {}, { redacted: 'true', consent: 'explicit' }]) {
    assert.equal(isWebContextPacket({ ...packet(), privacy }), false);
  }
});

test('bridge requires targetOrigin when no sending-page origin is available', async () => {
  assert.equal(typeof globalThis.window, 'undefined');
  const posted = [];
  const targetWindow = { postMessage: (...args) => posted.push(args) };
  const envelope = createAskableBridgeEnvelope(packet());
  await assert.rejects(() => createPostMessageTransport({ targetWindow }).send(envelope), /target origin|targetOrigin/i);
  assert.equal(posted.length, 0, 'Missing targetOrigin must not broadcast');
  const ack = await createPostMessageTransport({ targetWindow, targetOrigin: origin }).send(envelope);
  assert.equal(ack.ok, true);
  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0], [{ type: 'askable:bridge:context', envelope }, origin]);
});

test('bridge rejects unredacted, unconsented and malformed packets before dispatch', async () => {
  const sent = [];
  const bridge = createAskableBridge({
    requireRedacted: true,
    allowedConsent: ['explicit'],
    transports: [createFunctionTransport((envelope) => sent.push(envelope))],
  });
  try {
    for (const privacy of [
      { redacted: false, consent: 'explicit' },
      { redacted: true, consent: 'none' },
      { redacted: 'true', consent: 'explicit' },
      undefined,
    ]) {
      await assert.rejects(() => bridge.send({ ...packet(), privacy }));
    }
    assert.equal(sent.length, 0);
    assert.equal((await bridge.send(packet()))[0].ok, true);
    assert.equal(sent.length, 1);
    const envelope = sent[0];
    assert.equal(isAskableBridgeEnvelope(envelope), true);
    for (const malformed of [null, [], {},
      { ...envelope, requestId: '' },
      { ...envelope, consent: 'approved' },
      { ...envelope, payload: null },
      { ...envelope, payload: { packet: { ...packet(), privacy: { redacted: true } } } },
    ]) {
      assert.equal(isAskableBridgeEnvelope(malformed), false);
    }
  } finally {
    bridge.dispose();
  }
});

function assertSanitized(value) {
  if (typeof value === 'string') assert.equal(value.includes(raw), false, 'Raw fixture escaped sanitization');
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!['rawMeta', 'rawText', 'rawAncestors', 'internal'].includes(key), `Exposed raw field: ${key}`);
      assertSanitized(child);
    }
  }
}

test('core public focus, history, events, packets and requests contain only sanitized state', async () => {
  const ctx = createAskableContext({
    sanitizeMeta: ({ internal, ...rest }) => rest,
    sanitizeText: () => safe,
  });
  const events = [];
  ctx.on('focus', (focus) => events.push(focus));
  try {
    for (const id of ['first', 'second']) {
      ctx.push({ id, internal: raw }, raw, {
        ancestors: [{ meta: { id: 'parent', internal: raw }, text: raw }],
      });
    }
    assert.deepEqual(ctx.getFocus().meta, { id: 'second' });
    assert.equal(ctx.getFocus().text, safe);
    assert.equal(ctx.getHistory().length, 2);
    assert.equal(events.length, 2);
    const value = await ctx.toContextPacketAsync({ history: 2 });
    assert.equal(value.privacy.redacted, true);
    assert.equal(value.target.text, safe);
    assertSanitized({
      focus: ctx.getFocus(), history: ctx.getHistory(), events, packet: value,
      prompt: ctx.toContext({ history: 2 }),
      request: await ctx.toAgentRequest('Describe the fixture', { packet: true, history: 2 }),
    });
  } finally {
    ctx.destroy();
  }
});

test('core user source applies omitFields and sanitize to resolved state as well as data', async () => {
  const profile = { name: raw, role: raw, plan: raw, email: raw };
  for (const [options, expected] of [
    [{ omitFields: Object.keys(profile) }, {}],
    [{ sanitize: () => ({ name: safe, role: 'viewer' }) }, { name: safe, role: 'viewer' }],
  ]) {
    const ctx = createAskableContext();
    try {
      ctx.registerSource('user', createAskableUserSource({ getUser: async () => profile, ...options }));
      const resolved = await ctx.resolveSource('user');
      assert.equal(resolved.state.authenticated, true);
      for (const field of ['name', 'role', 'plan']) assert.equal(resolved.state[field], expected[field]);
      assert.deepEqual(resolved.data, expected);
      assertSanitized({
        resolved,
        prompt: await ctx.toContextAsync({ sources: ['user'] }),
        packet: await ctx.toContextPacketAsync({ sources: ['user'] }),
      });
    } finally {
      ctx.destroy();
    }
  }
});

test('core maxTokens keeps sync and async JSON parseable and within the character cap', async () => {
  const ctx = createAskableContext();
  const escaped = '"\\\n'.repeat(200);
  try {
    ctx.push({ id: 'fixture', description: escaped, nested: { rows: [1, 2, 3] } });
    const full = ctx.toPromptContext({ format: 'json' });
    assert.ok(full.length > 240, 'Fixture must exercise truncation');
    for (const maxTokens of [1, 30, 60]) {
      const output = ctx.toPromptContext({ format: 'json', maxTokens });
      assert.doesNotThrow(() => JSON.parse(output));
      assert.ok(output.length <= maxTokens * 4);
    }
    assert.equal(JSON.parse(ctx.toPromptContext({ format: 'json', maxTokens: 30 })).meta.id, 'fixture');
    ctx.push({ id: 'fixture' });
    ctx.registerSource('records', { resolve: () => ({ text: escaped }) });
    for (const maxTokens of [1, 30, 60]) {
      const output = await ctx.toPromptContextAsync({ format: 'json', sources: ['records'], maxTokens });
      assert.doesNotThrow(() => JSON.parse(output));
      assert.ok(output.length <= maxTokens * 4);
    }
    assert.throws(() => ctx.toPromptContext({ format: 'json', maxTokens: 0 }), RangeError);
  } finally {
    ctx.destroy();
  }
});

test('bridge sendAgentRequest accepts a real core request without re-resolving context', async () => {
  const ctx = createAskableContext({ sanitizeText: () => safe });
  const sent = [];
  const bridge = createAskableBridge({
    requireRedacted: true,
    transports: [createFunctionTransport((envelope) => sent.push(envelope))],
  });
  try {
    assert.equal(typeof bridge.sendAgentRequest, 'function');
    ctx.push({ id: 'fixture' }, raw);
    const request = await ctx.toAgentRequest('Describe the fixture', {
      packet: true, requestId: 'artifact-request', metadata: { fixture: true },
    });
    const [ack] = await bridge.sendAgentRequest(request);
    assert.equal(ack.ok, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].requestId, request.requestId);
    assert.deepEqual(sent[0].payload, {
      packet: request.packet, question: request.question,
      prompt: request.context, metadata: request.metadata,
    });
    assertSanitized(sent);
  } finally {
    bridge.dispose();
    ctx.destroy();
  }
});

const invalidPackets = () => [
  null, {},
  { ...packet(), privacy: undefined },
  { ...packet(), privacy: { redacted: 'true', consent: 'explicit' } },
  { ...packet(), target: { text: 42, metadata: { fixture: raw } } },
  { ...packet(), surrounding: { sources: [{ label: 42 }] } },
];

test('MCP remote provider rejects malformed packets through its public fetch adapter', async () => {
  for (const value of invalidPackets()) {
    const provider = createAskableMcpRemoteProvider({
      url: `${origin}/context`, fetch: async () => Response.json(value),
    });
    await assert.rejects(() => provider.getContext(), (error) => {
      assert.match(error.message, /Invalid Context packet/i);
      assert.equal(error.message.includes(raw), false);
      return true;
    });
  }
  const value = packet();
  const provider = createAskableMcpRemoteProvider({
    url: `${origin}/context`, fetch: async () => Response.json(value),
  });
  assert.deepEqual(await provider.getContext(), value);
});

class PageWindow {
  location = { origin };
  listeners = new Set();
  reply;
  addEventListener(type, listener) { assert.equal(type, 'message'); this.listeners.add(listener); }
  removeEventListener(type, listener) { assert.equal(type, 'message'); this.listeners.delete(listener); }
  postMessage(message, targetOrigin) { this.reply({ message, targetOrigin }); }
  async request(type, options) {
    let timer;
    try {
      const response = await new Promise((resolve, reject) => {
        this.reply = resolve;
        timer = setTimeout(() => reject(new Error(`No page response for ${type}`)), 2_000);
        for (const listener of this.listeners) {
          listener({ origin, source: this, data: {
            protocol: ASKABLE_MCP_PAGE_BRIDGE_PROTOCOL,
            version: ASKABLE_MCP_PAGE_BRIDGE_VERSION,
            requestId: 'artifact-page-request', type, options,
          } });
        }
      });
      assert.equal(response.targetOrigin, origin);
      assert.equal(response.message.requestId, 'artifact-page-request');
      return response.message;
    } finally {
      clearTimeout(timer);
      this.reply = undefined;
    }
  }
}

const pageRequests = [
  ['get_current_context', {}],
  ['format_context_for_prompt', {}],
  ['read_current_resource', { resource: { format: 'packet', includePacket: true } }],
  ['read_current_resource', { resource: { format: 'prompt', includePacket: true } }],
];

function assertPageRejected(response, type) {
  assert.equal(response.type, `${type}:error`);
  assert.equal(typeof response.error?.message, 'string');
  for (const key of ['packet', 'text', 'resource']) assert.equal(Object.hasOwn(response, key), false);
  assert.equal(JSON.stringify(response).includes(raw), false);
}

test('MCP page bridge rejects invalid packets in every response format', async () => {
  for (const value of invalidPackets()) {
    const window = new PageWindow();
    const bridge = createAskableMcpPageBridge({
      window, requireRedacted: true, provider: {
        getContext: () => value,
        formatContextForPrompt: () => assert.fail('Invalid packet reached prompt formatting'),
      },
    });
    try {
      for (const [type, options] of pageRequests) assertPageRejected(await window.request(type, options), type);
    } finally {
      bridge.dispose();
      assert.equal(window.listeners.size, 0);
    }
  }
});

test('same-origin page options cannot forge redaction on a real core provider', async () => {
  for (const asyncProvider of [false, true]) {
    for (const hostRedacted of [undefined, false, true]) {
      const ctx = createAskableContext(hostRedacted ? { sanitizeText: () => safe } : {});
      ctx.push({ id: 'fixture' }, raw);
      const source = asyncProvider ? ctx : {
        toContextPacket: ctx.toContextPacket.bind(ctx), toContext: ctx.toContext.bind(ctx),
      };
      const provider = createAskableMcpContextProvider(source, hostRedacted === undefined ? {} : {
        privacy: { redacted: hostRedacted, consent: 'implicit' },
      });
      const window = new PageWindow();
      const bridge = createAskableMcpPageBridge({ window, provider, requireRedacted: true });
      try {
        for (const [type, resource] of pageRequests) {
          const response = await window.request(type, {
            ...resource, history: 1,
            privacy: { redacted: true, consent: 'explicit' },
            provenance: { producer: 'page-caller', method: 'manual' },
          });
          if (!hostRedacted) {
            assertPageRejected(response, type);
          } else {
            assert.equal(response.type, `${type}:result`);
            assertSanitized(response);
            const value = response.packet ?? response.resource?.packet;
            if (value) assert.equal(value.privacy.consent, 'implicit');
          }
        }
      } finally {
        bridge.dispose();
        ctx.destroy();
        assert.equal(window.listeners.size, 0);
      }
    }
  }
});
