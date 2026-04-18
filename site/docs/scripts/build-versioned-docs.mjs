import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(__dirname, '..');
const repoRoot = resolve(docsRoot, '..', '..');
const versionsPath = join(docsRoot, 'versions.json');
const outputRoot = join(repoRoot, 'site', 'www', 'docs');
const distRoot = join(docsRoot, '.vitepress', 'dist');

const versions = JSON.parse(readFileSync(versionsPath, 'utf8'));
const current = versions.current;
const archived = versions.archived ?? [];

function runBuild(base) {
  rmSync(distRoot, { recursive: true, force: true });
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: docsRoot,
    env: {
      ...process.env,
      ASKABLE_DOCS_BASE: base,
    },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function copyDir(from, to) {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

runBuild('/docs/');
copyDir(distRoot, outputRoot);

const currentVersionOutput = join(outputRoot, current.slug);
runBuild(`/docs/${current.slug}/`);
copyDir(distRoot, currentVersionOutput);

for (const version of archived) {
  const snapshotRoot = join(docsRoot, 'versions', version.slug);
  if (!existsSync(snapshotRoot)) {
    throw new Error(`Missing archived docs snapshot: ${snapshotRoot}`);
  }
  copyDir(snapshotRoot, join(outputRoot, version.slug));
}

writeFileSync(join(outputRoot, 'versions.json'), JSON.stringify(versions, null, 2) + '\n');
