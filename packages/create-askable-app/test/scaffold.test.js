import test from 'node:test';
import assert from 'node:assert/strict';
import { isDirectoryEmpty, toPackageName } from '../src/scaffold.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
