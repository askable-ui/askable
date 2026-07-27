#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const rootPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const mcpPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages/mcp/package.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages/mcp/server.json'), 'utf8'));
const expectedSchema = 'https://static.modelcontextprotocol.io/schemas/2025-07-09/server.schema.json';
const errors = [];

if (manifest.$schema !== expectedSchema) {
  errors.push(`$schema must be ${expectedSchema}`);
}
if (manifest.version !== rootPackage.version || manifest.version !== mcpPackage.version) {
  errors.push('root, MCP package, and MCP server manifest versions must match');
}
if (typeof manifest.description !== 'string' || manifest.description.length > 100) {
  errors.push('description must be a string of at most 100 characters');
}
if (!Array.isArray(manifest.packages) || manifest.packages.length === 0) {
  errors.push('packages must contain at least one package entry');
} else {
  const npmPackage = manifest.packages.find((entry) => entry.identifier === mcpPackage.name);
  if (!npmPackage) {
    errors.push(`packages must include ${mcpPackage.name}`);
  } else {
    if (npmPackage.registry_type !== 'npm') errors.push('MCP package registry_type must be npm');
    if (npmPackage.version !== mcpPackage.version) errors.push('MCP package entry version must match package.json');
    if (npmPackage.transport?.type !== 'stdio') errors.push('MCP package transport must be stdio');
  }
}
if (!mcpPackage.files?.includes('server.json')) {
  errors.push('packages/mcp/package.json files must publish server.json');
}

if (errors.length) {
  console.error('Invalid packages/mcp/server.json:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OK: MCP Registry manifest and package metadata align at ${manifest.version}.`);
