#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const rootPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const expectedRange = `^${rootPkg.version}`;
const publishedVersion = JSON.parse(execFileSync(
  'npm',
  ['view', '@askable-ui/core', 'version', '--json'],
  { encoding: 'utf8' },
));
const publishedRange = `^${publishedVersion}`;
const releasePending = publishedVersion !== rootPkg.version;
const requiredRange = releasePending ? publishedRange : expectedRange;

const examplesDir = path.join(repoRoot, 'examples');
const exampleDirs = fs
  .readdirSync(examplesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const failures = [];
const inspected = [];

for (const exampleName of exampleDirs) {
  const packageJsonPath = path.join(examplesDir, exampleName, 'package.json');
  if (!fs.existsSync(packageJsonPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

  for (const section of sections) {
    const deps = pkg[section] ?? {};
    for (const [name, version] of Object.entries(deps)) {
      if (!name.startsWith('@askable-ui/')) continue;
      inspected.push(`${exampleName}:${section}:${name}=${version}`);
      if (version !== requiredRange) {
        failures.push({ exampleName, section, name, version });
      }
    }
  }
}

if (failures.length) {
  console.error(`Expected all example @askable-ui/* dependency ranges to equal ${requiredRange}.`);
  for (const failure of failures) {
    console.error(`- examples/${failure.exampleName}/package.json -> ${failure.section}.${failure.name} is ${failure.version}`);
  }
  process.exit(1);
}

if (releasePending) {
  console.log(
    `Release pending: packages are ${rootPkg.version}, while npm latest is ${publishedVersion}; `
      + `examples correctly remain on ${publishedRange}.`,
  );
}
console.log(`OK: ${inspected.length} example @askable-ui dependency entries match ${requiredRange}.`);
