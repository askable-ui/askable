#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = path.join(repoRoot, 'packages');
const workflowPaths = [
  '.github/workflows/publish_preview.yml',
  '.github/workflows/publish_release.yml',
];

const publicPackageDirs = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((dir) => {
    const packageJsonPath = path.join(packagesDir, dir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) return false;
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return pkg.private !== true;
  })
  .sort();

const failures = [];

for (const workflowPath of workflowPaths) {
  const contents = fs.readFileSync(path.join(repoRoot, workflowPath), 'utf8');
  for (const packageDir of publicPackageDirs) {
    const expectedPath = `packages/${packageDir}`;
    if (!contents.includes(expectedPath)) {
      failures.push(`${workflowPath} does not publish ${expectedPath}`);
    }
  }
}

if (failures.length) {
  console.error('Every public workspace package must be covered by preview and release publishing.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OK: ${publicPackageDirs.length} public packages are covered by both publish workflows.`);
