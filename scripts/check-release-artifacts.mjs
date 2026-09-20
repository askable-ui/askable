#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run after the workspace build. Only the temporary consumer is installed into.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const packageDirs = ['context', 'core', 'bridge', 'mcp'];
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, cwd, timeout = 180_000) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, NODE_PATH: '' },
  });
  if (result.error || result.status !== 0) {
    throw new Error([
      `${command} ${args.join(' ')} failed (${result.signal ?? result.status}).`,
      result.error?.message,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'));
  }
  return result.stdout;
}

function checkInstalledPackages(consumer, packed) {
  const lock = readJson(path.join(consumer, 'package-lock.json'));
  const entries = Object.entries(lock.packages).filter(([location]) =>
    /(?:^|\/)node_modules\/@askable-ui\//.test(location),
  );
  assert.equal(entries.length, packed.length, 'Unexpected or nested Askable dependency');
  for (const artifact of packed) {
    const location = `node_modules/${artifact.name}`;
    const entry = lock.packages[location];
    assert.ok(entry, `Missing installed ${artifact.name}`);
    assert.ok(!entry.link, `${artifact.name} must not be a workspace link`);
    assert.equal(entry.version, artifact.version);
    assert.equal(entry.integrity, artifact.integrity, `${artifact.name} is not the packed artifact`);
    assert.ok(entry.resolved?.startsWith('file:'), `${artifact.name} came from a registry`);
    assert.equal(path.resolve(consumer, entry.resolved.slice(5)), artifact.tarball);

    const installed = path.join(consumer, location);
    assert.equal(realpathSync(installed), installed, `${artifact.name} must be isolated`);
    const manifest = readJson(path.join(installed, 'package.json'));
    assert.equal(manifest.name, artifact.name);
    assert.equal(manifest.version, artifact.version);
    // Type declarations are part of the public package contract too.
    assert.equal(typeof manifest.types, 'string', `${artifact.name} has no types entry`);
    assert.ok(statSync(path.join(installed, manifest.types)).size > 0);
  }
}

let temporary;
try {
  assert.equal(process.argv.length, 2, 'Usage: node scripts/check-release-artifacts.mjs');
  temporary = realpathSync(mkdtempSync(path.join(tmpdir(), 'askable-release-artifacts-')));
  const consumer = path.join(temporary, 'consumer');
  mkdirSync(consumer);
  const manifests = packageDirs.map((dir) => readJson(path.join(repoRoot, 'packages', dir, 'package.json')));
  const names = new Set(manifests.map((manifest) => manifest.name));
  for (const manifest of manifests) {
    for (const name of Object.keys({
      ...manifest.dependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    })) {
      assert.ok(!name.startsWith('@askable-ui/') || names.has(name), `Pack local dependency ${name} as well`);
    }
  }

  const packed = packageDirs.map((dir, index) => {
    const [artifact] = JSON.parse(run(npm, [
      'pack', path.join(repoRoot, 'packages', dir), '--json', '--ignore-scripts',
      '--pack-destination', temporary, '--workspaces=false',
    ], consumer));
    assert.equal(artifact.name, manifests[index].name);
    assert.equal(artifact.version, manifests[index].version);
    console.log(`Packed ${artifact.name}@${artifact.version}`);
    return { ...artifact, tarball: path.join(temporary, artifact.filename) };
  });

  const dependencies = Object.fromEntries(packed.map(({ name, tarball }) => [name, `file:${tarball}`]));
  writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({
    name: 'release-artifact-consumer',
    private: true,
    type: 'module',
    dependencies,
    // Force transitive local dependencies to the same tarballs, never registry versions.
    overrides: Object.fromEntries(packed.map(({ name }) => [name, `$${name}`])),
  }, null, 2));
  console.log('Installing all four tarballs in an isolated consumer...');
  run(npm, [
    'install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline',
    '--package-lock=true', '--workspaces=false',
  ], consumer);
  checkInstalledPackages(consumer, packed);

  // Copy, do not import from the checkout: bare imports must resolve in the consumer.
  copyFileSync(
    path.join(repoRoot, 'scripts/release-artifacts/public-api.test.mjs'),
    path.join(consumer, 'public-api.test.mjs'),
  );
  process.stdout.write(run(process.execPath, ['--test', 'public-api.test.mjs'], consumer, 30_000));
  console.log('OK: all four packed library artifacts passed public API checks.');
} catch (error) {
  console.error(`Release artifact verification failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
