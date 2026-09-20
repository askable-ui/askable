import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { assertStandaloneClassicScript } from './classic-script.mjs';

const dist = new URL('../dist/', import.meta.url);

test('manifest content scripts are self-contained classic scripts', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', dist), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.content_scripts.flatMap((entry) => entry.js), ['content.js']);
  for (const entry of manifest.content_scripts) {
    for (const filename of entry.js) {
      const code = await readFile(new URL(filename, dist), 'utf8');
      assert.ok(code.length > 0, `${filename} must not be empty`);
      assertStandaloneClassicScript(code, filename);
    }
  }
  assert.equal(manifest.background.type, 'module');
  assert.ok((await readFile(new URL(manifest.background.service_worker, dist))).length > 0);
  const popup = await readFile(new URL(manifest.action.default_popup, dist), 'utf8');
  assert.match(popup, /<script\b[^>]*type="module"[^>]*src="[^\"]+"/);
  assert.ok((await readFile(new URL('popup.js', dist))).length > 0);
});

test('classic smoke check accepts an IIFE and import-like text', () => {
  assertStandaloneClassicScript('(() => { const text = "import(\\\"not-code\\\")"; })();', 'content.js');
});

for (const [name, code] of [
  ['shared static import', 'import { capture } from "./chunks/shared.js"; capture();'],
  ['export', 'export const capture = () => {};'],
  ['import.meta', 'console.log(import.meta.url);'],
  ['top-level await', 'await Promise.resolve();'],
  ['dynamic import', '(() => { void import("./chunks/shared.js"); })();'],
  ['comment-separated dynamic import', '(() => { void import /* lazy */ ("./shared.js"); })();'],
  ['CommonJS require', '(() => { require("./shared.js"); })();'],
  ['worker importScripts', '(() => { importScripts("./shared.js"); })();'],
]) {
  test(`classic smoke check rejects ${name}`, () => {
    assert.throws(() => assertStandaloneClassicScript(code, 'content.js'));
  });
}
