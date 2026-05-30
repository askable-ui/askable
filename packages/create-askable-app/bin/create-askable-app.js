#!/usr/bin/env node
import { runCli } from '../src/scaffold.js';

runCli(process.argv.slice(2)).catch((error) => {
  console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
