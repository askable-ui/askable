import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(__dirname, '..');
const distRoot = join(docsRoot, '.vitepress', 'dist');
const versions = JSON.parse(readFileSync(join(docsRoot, 'versions.json'), 'utf8'));
const slug = process.argv[2] ?? versions.current.slug;
const snapshotRoot = join(docsRoot, 'versions', slug);

rmSync(distRoot, { recursive: true, force: true });
const result = spawnSync('npm', ['run', 'build'], {
  cwd: docsRoot,
  env: {
    ...process.env,
    ASKABLE_DOCS_BASE: `/docs/${slug}/`,
  },
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

rmSync(snapshotRoot, { recursive: true, force: true });
mkdirSync(dirname(snapshotRoot), { recursive: true });
cpSync(distRoot, snapshotRoot, { recursive: true });
console.log(`Snapshot written to ${snapshotRoot}`);
