import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// Exercise the real pack/install/check lifecycle without changing the workspace build.
test('artifact verifier fails closed and cleans up on success and failure', { timeout: 180_000 }, () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'askable-artifact-checker-test-'));
  const scratch = path.join(fixture, 'scratch');
  try {
    mkdirSync(scratch);
    mkdirSync(path.join(fixture, 'scripts/release-artifacts'), { recursive: true });
    for (const file of ['scripts/check-release-artifacts.mjs', 'scripts/release-artifacts/public-api.test.mjs']) {
      cpSync(path.join(repoRoot, file), path.join(fixture, file));
    }
    for (const name of ['context', 'core', 'bridge', 'mcp']) {
      const source = path.join(repoRoot, 'packages', name);
      const target = path.join(fixture, 'packages', name);
      mkdirSync(target, { recursive: true });
      cpSync(path.join(source, 'package.json'), path.join(target, 'package.json'));
      cpSync(path.join(source, 'dist'), path.join(target, 'dist'), { recursive: true });
    }

    const verify = () => {
      const env = {
        ...process.env, TMPDIR: scratch, TMP: scratch, TEMP: scratch,
        NODE_DISABLE_COMPILE_CACHE: '1',
      };
      // The nested suite must run as a fresh CLI, not as this test runner's child.
      delete env.NODE_TEST_CONTEXT;
      const result = spawnSync(process.execPath, ['scripts/check-release-artifacts.mjs'], {
        cwd: fixture,
        encoding: 'utf8',
        timeout: 60_000,
        env,
      });
      assert.ifError(result.error);
      assert.equal(result.signal, null);
      assert.deepEqual(readdirSync(scratch), [], 'Verifier left a temporary consumer behind');
      return { status: result.status, output: result.stdout + result.stderr };
    };

    const valid = verify();
    assert.equal(valid.status, 0, valid.output);

    const manifestPath = path.join(fixture, 'packages/bridge/package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, exports: {} }));
    const missingExport = verify();
    assert.equal(missingExport.status, 1, missingExport.output);
    assert.match(missingExport.output, /ERR_PACKAGE_PATH_NOT_EXPORTED/);
    writeFileSync(manifestPath, JSON.stringify(manifest));

    const bridgeDist = path.join(fixture, 'packages/bridge/dist');
    renameSync(path.join(bridgeDist, 'index.js'), path.join(bridgeDist, 'original.js'));
    writeFileSync(path.join(bridgeDist, 'index.js'), `
export * from './original.js';
export function createPostMessageTransport(options = {}) {
  return {
    id: 'postmessage',
    async send(envelope) {
      options.targetWindow.postMessage(
        { type: 'askable:bridge:context', envelope }, options.targetOrigin ?? '*',
      );
      return { ok: true, requestId: envelope.requestId, transportId: 'postmessage' };
    },
  };
}
`);
    const unsafeOrigin = verify();
    assert.equal(unsafeOrigin.status, 1, unsafeOrigin.output);
    assert.match(unsafeOrigin.output, /Missing expected rejection/);
    assert.match(unsafeOrigin.output, /bridge requires targetOrigin/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
