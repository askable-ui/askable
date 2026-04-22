import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASKABLE_VERSION = '6.1.0';
const COPILOTKIT_VERSION = '1.56.2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_DIR = path.resolve(__dirname, '..', 'template');

export function toPackageName(rawName) {
  return rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function isDirectoryEmpty(targetDir) {
  if (!fs.existsSync(targetDir)) {
    return true;
  }

  const entries = fs.readdirSync(targetDir).filter((entry) => entry !== '.DS_Store');
  return entries.length === 0;
}

function render(content, projectName) {
  return content
    .replaceAll('__APP_NAME__', projectName)
    .replaceAll('__PACKAGE_NAME__', toPackageName(projectName) || 'askable-app')
    .replaceAll('__ASKABLE_VERSION__', ASKABLE_VERSION)
    .replaceAll('__COPILOTKIT_VERSION__', COPILOTKIT_VERSION);
}

function copyTemplate(templateDir, targetDir, projectName) {
  for (const entry of fs.readdirSync(templateDir, { withFileTypes: true })) {
    const sourcePath = path.join(templateDir, entry.name);
    const outputName = entry.name === '_gitignore' ? '.gitignore' : entry.name;
    const targetPath = path.join(targetDir, outputName);

    if (entry.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      copyTemplate(sourcePath, targetPath, projectName);
      continue;
    }

    const raw = fs.readFileSync(sourcePath, 'utf8');
    fs.writeFileSync(targetPath, render(raw, projectName));
  }
}

export async function runCli(args) {
  const [projectArg] = args;

  if (!projectArg || projectArg === '--help' || projectArg === '-h') {
    console.log(`create-askable-app\n\nUsage:\n  npx create-askable-app my-app\n`);
    return;
  }

  const projectName = projectArg.trim();
  const targetDir = path.resolve(process.cwd(), projectName);

  if (!isDirectoryEmpty(targetDir)) {
    throw new Error(`Target directory is not empty: ${targetDir}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  copyTemplate(TEMPLATE_DIR, targetDir, projectName);

  console.log(`\n✔ askable starter created at ${targetDir}\n`);
  console.log('Next steps:');
  console.log(`  cd ${projectName}`);
  console.log('  npm install');
  console.log('  cp .env.example .env');
  console.log('  npm run dev');
  console.log('\nTip: add OPENAI_API_KEY to .env when you want the CopilotKit runtime to answer.');
}
