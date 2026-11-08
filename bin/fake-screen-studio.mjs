#!/usr/bin/env node
// Scaffold a new Fake Screen Studio project.
//
// The package itself is the template: the files listed in PAYLOAD are copied
// from the installed package into the target directory, and a few files
// (package.json, README.md, .gitignore, STUDIO_VERSION) are generated because
// they are project-specific or cannot survive `npm pack` (npm strips
// .gitignore from tarballs).
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(await fs.readFile(path.join(PKG_ROOT, 'package.json'), 'utf8'));

// Everything a scaffolded project needs. Keep in sync with `files` in
// package.json — test/scaffold.test.mjs fails if they drift apart.
export const PAYLOAD = ['AGENTS.md', 'index.html', 'tsconfig.json', 'src', 'scripts', 'docs/adr', 'docs/agents', 'scenarios/hello'];

const GITIGNORE = `node_modules/
dist/
.vite/
.scratch/
*.log
.DS_Store
Thumbs.db
`;

const HELP = `fake-screen-studio ${PKG.version}

Scaffold a new Fake Screen Studio project in <dir>.

Usage:
  fake-screen-studio <dir> [options]
  npx fake-screen-studio@latest my-video

Options:
  --name <name>   npm package name for the new project (default: derived from <dir>)
  --no-install    skip "npm install" after scaffolding
  -h, --help      show this help
  -v, --version   print the version

The target directory must be empty (or contain only .git/, README*, .gitignore).
`;

function fail(message, code = 1) {
  console.error(`error: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { dir: null, name: null, install: true, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '-v' || arg === '--version') opts.version = true;
    else if (arg === '--no-install') opts.install = false;
    else if (arg === '--name') {
      opts.name = argv[++i];
      if (!opts.name) fail('--name requires a value');
    } else if (arg.startsWith('-')) fail(`unknown option: ${arg}`);
    else if (opts.dir) fail(`unexpected argument: ${arg}`);
    else opts.dir = arg;
  }
  return opts;
}

function toPackageName(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[-._]+|[-._]+$/g, '') || 'my-video'
  );
}

// Files that may already exist in a "basically empty" directory without
// blocking the scaffold.
const ALLOWED_EXISTING = [/^\.git$/, /^README(\..*)?$/i, /^\.gitignore$/];

async function conflictList(target) {
  let entries;
  try {
    entries = await fs.readdir(target);
  } catch {
    return [];
  }
  return entries.filter((name) => !ALLOWED_EXISTING.some((re) => re.test(name)));
}

async function copyPayload(target) {
  for (const rel of PAYLOAD) {
    const from = path.join(PKG_ROOT, rel);
    if (!existsSync(from)) fail(`package is missing "${rel}" — reinstall fake-screen-studio`);
    const to = path.join(target, rel);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.cp(from, to, { recursive: true, force: true });
  }
}

async function writeFileIfMissing(file, content, notes) {
  if (existsSync(file)) {
    notes.push(`${path.basename(file)} already exists — left untouched`);
    return;
  }
  await fs.writeFile(file, content);
}

function projectPackageJson(dirName, name) {
  return JSON.stringify(
    {
      name,
      version: '0.1.0',
      private: true,
      type: PKG.type,
      description: `Fake Screen Studio project: ${dirName}`,
      scripts: {
        dev: 'vite',
        build: 'vite build',
        render: 'node scripts/render.mjs',
        'gen:index': 'tsx scripts/gen-index.ts',
      },
      devDependencies: PKG.devDependencies,
      allowScripts: PKG.allowScripts,
    },
    null,
    2,
  ) + '\n';
}

function projectReadme(dirName, name) {
  return `# ${dirName}

A [Fake Screen Studio](https://github.com/MuhSaider/fake-screen-studio) project (\`${name}\`).
Videos are described by JSON scenarios and rendered frame by frame — no screen
recording is involved.

## Quick start

\`\`\`bash
npm run dev     # live preview at http://localhost:5173
npm run render  # -> dist/<scenario>.mp4
\`\`\`

Edit \`scenarios/hello/scenario.json\`, or add \`scenarios/<your-video>/scenario.json\`.
The preview hot-reloads when a scenario file changes.

## Before writing a scenario

Read \`docs/agents/video-index.md\`. It is generated from \`src/registry/index.ts\`
and lists every action type, zoom preset, window template, and click anchor you
may use. Need something that isn't registered? Add it to the registry and the
engine first, then run \`npm run gen:index\`.

## Requirements

- Node.js 22 or newer
- Chrome, Edge, Chromium, or Brave. If it is not found automatically, set
  \`STUDIO_BROWSER\` to the browser executable path.
`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return;
  }
  if (opts.version) {
    console.log(PKG.version);
    return;
  }

  const target = path.resolve(opts.dir ?? '.');
  const dirName = path.basename(target);
  const name = opts.name ? toPackageName(opts.name) : toPackageName(dirName);

  const conflicts = await conflictList(target);
  if (conflicts.length) {
    fail(
      `${target} is not empty. Refusing to merge into an existing project.\n` +
        `Conflicting entries:\n  ${conflicts.join('\n  ')}\n` +
        'Pick an empty directory, or clear it yourself.',
    );
  }

  await fs.mkdir(target, { recursive: true });
  await copyPayload(target);

  const notes = [];
  await writeFileIfMissing(path.join(target, 'package.json'), projectPackageJson(dirName, name), notes);
  await writeFileIfMissing(path.join(target, 'README.md'), projectReadme(dirName, name), notes);
  await writeFileIfMissing(path.join(target, '.gitignore'), GITIGNORE, notes);
  await fs.writeFile(path.join(target, 'STUDIO_VERSION'), `${PKG.version}\n`);

  console.log(`Scaffolded ${name} into ${target}`);
  for (const note of notes) console.log(`  note: ${note}`);

  if (opts.install) {
    console.log('\nInstalling dependencies (npm install)...');
    const result = spawnSync('npm', ['install'], {
      cwd: target,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.status !== 0) {
      fail('npm install failed. Run it manually in the new project directory.', result.status ?? 1);
    }
  } else {
    console.log('\nSkipped npm install (--no-install).');
  }

  const rel = path.relative(process.cwd(), target) || '.';
  console.log(`
Next steps:
  cd ${rel}
${opts.install ? '' : '  npm install\n'}  npm run dev      # live preview
  npm run render   # render dist/hello.mp4
`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => fail(error?.stack ?? String(error)));
}
