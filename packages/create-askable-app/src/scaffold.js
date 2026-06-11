import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASKABLE_VERSION = '0.14.0';
const COPILOTKIT_VERSION = '1.59.2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_DIR = path.resolve(__dirname, '..', 'template');

const TEMPLATES = {
  react: {
    label: 'React + Vite + CopilotKit',
    dir: TEMPLATE_DIR,
    postInstall: [
      'cp .env.example .env',
      'npm run dev',
    ],
    tip: 'Add OPENAI_API_KEY to .env to enable the CopilotKit AI runtime.',
  },
};

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
  const flagIndex = args.findIndex((a) => a === '--template' || a === '-t');
  const templateArg = flagIndex !== -1 ? args[flagIndex + 1] : 'react';
  const projectArgs = args.filter(
    (a, i) => a !== '--template' && a !== '-t' && (flagIndex === -1 || i !== flagIndex + 1),
  );
  const [projectArg] = projectArgs;

  if (!projectArg || projectArg === '--help' || projectArg === '-h') {
    console.log('create-askable-app\n');
    console.log('Usage:');
    console.log('  npm create @askable-ui/app <project-name> [--template react]\n');
    console.log('Templates:');
    for (const [key, t] of Object.entries(TEMPLATES)) {
      console.log(`  ${key.padEnd(12)} ${t.label}`);
    }
    console.log('');
    return;
  }

  const template = TEMPLATES[templateArg];
  if (!template) {
    const valid = Object.keys(TEMPLATES).join(', ');
    throw new Error(`Unknown template "${templateArg}". Valid options: ${valid}`);
  }

  const projectName = projectArg.trim();
  const targetDir = path.resolve(process.cwd(), projectName);

  if (!targetDir.startsWith(process.cwd() + path.sep) && targetDir !== process.cwd()) {
    throw new Error(`Target directory must be inside the current working directory: ${targetDir}`);
  }

  if (!isDirectoryEmpty(targetDir)) {
    throw new Error(`Target directory is not empty: ${targetDir}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  copyTemplate(template.dir, targetDir, projectName);

  const rel = path.relative(process.cwd(), targetDir);
  console.log(`\n  ✔ Created ${projectName} (${template.label})\n`);
  console.log('  Next steps:\n');
  console.log(`    cd ${rel}`);
  console.log('    npm install');
  for (const step of template.postInstall) {
    console.log(`    ${step}`);
  }
  console.log('');
  if (template.tip) {
    console.log(`  Tip: ${template.tip}\n`);
  }
  console.log('  Docs: https://askable-ui.com/docs\n');
}
