import test from 'node:test';
import assert from 'node:assert/strict';
import { isDirectoryEmpty, toPackageName, runCli, TEMPLATES, ASKABLE_VERSION } from '../src/scaffold.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

test('toPackageName normalizes generated package names', () => {
  assert.equal(toPackageName('My Askable App'), 'my-askable-app');
  assert.equal(toPackageName('sales_dashboard'), 'sales_dashboard');
  assert.equal(toPackageName('  weird///name  '), 'weird-name');
});

test('isDirectoryEmpty returns true for missing directories', () => {
  const target = path.join(os.tmpdir(), `askable-missing-${Date.now()}`);
  assert.equal(isDirectoryEmpty(target), true);
});

test('isDirectoryEmpty ignores .DS_Store', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'askable-scaffold-'));
  fs.writeFileSync(path.join(target, '.DS_Store'), '');
  assert.equal(isDirectoryEmpty(target), true);
});

test('runCli rejects path traversal outside cwd', async () => {
  await assert.rejects(
    () => runCli(['../../malicious']),
    /Target directory must be inside the current working directory/,
  );
});

// --- Release-integrity guards ---------------------------------------------
// These catch the class of "ships broken on npm install" bugs: a template that
// is offered by the CLI but excluded from the published tarball, or a version
// constant that drifts from the package version.

test('scaffold version matches the package version (no hardcoded drift)', () => {
  assert.equal(
    ASKABLE_VERSION,
    pkg.version,
    `ASKABLE_VERSION (${ASKABLE_VERSION}) must equal package.json version (${pkg.version})`,
  );
});

test('every offered template directory is published in files[]', () => {
  const filesEntries = new Set(pkg.files);
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const [key, template] of Object.entries(TEMPLATES)) {
    const dirName = path.basename(template.dir);
    assert.ok(
      filesEntries.has(dirName),
      `Template "${key}" uses directory "${dirName}" which is missing from package.json "files" — it would be offered by the CLI but excluded from the published tarball`,
    );
    assert.ok(
      fs.existsSync(path.resolve(here, '..', dirName)),
      `Template "${key}" directory "${dirName}" does not exist on disk`,
    );
  }
});
