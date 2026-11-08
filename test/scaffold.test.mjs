// Packaging contract tests: the published package *is* the scaffold template, so
// the failure modes worth guarding are "we shipped the wrong files" and "the
// generated package.json is not a valid, private project".
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { PAYLOAD } from '../bin/fake-screen-studio.mjs';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'bin', 'fake-screen-studio.mjs');
const PKG = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));

async function tempDir(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fake-screen-studio-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

async function scaffold(t, args = []) {
  const tmp = await tempDir(t);
  const target = path.join(tmp, 'my-video');
  await run(process.execPath, [CLI, target, '--no-install', ...args]);
  return target;
}

const exists = async (p) =>
  fs.access(p).then(
    () => true,
    () => false,
  );

test('every scaffolded path is part of the npm payload', () => {
  const files = PKG.files.map((entry) => entry.replace(/\/$/, ''));
  assert.ok(files.length, 'package.json must declare a files whitelist');
  for (const entry of PAYLOAD) {
    assert.ok(
      files.some((f) => f === entry || entry.startsWith(`${f}/`)),
      `"${entry}" is copied by the CLI but missing from package.json "files"`,
    );
  }
});

test('scaffolds a runnable project into an empty directory', async (t) => {
  const target = await scaffold(t);

  for (const rel of [
    'AGENTS.md',
    'index.html',
    'tsconfig.json',
    'src/main.ts',
    'src/engine/engine.ts',
    'src/registry/index.ts',
    'scripts/render.mjs',
    'scripts/gen-index.ts',
    'docs/adr/0001-render-frame-by-frame.md',
    'docs/agents/video-index.md',
    'scenarios/hello/scenario.json',
    'README.md',
    '.gitignore',
    'STUDIO_VERSION',
  ]) {
    assert.ok(await exists(path.join(target, rel)), `expected ${rel} to exist`);
  }

  assert.equal((await fs.readFile(path.join(target, 'STUDIO_VERSION'), 'utf8')).trim(), PKG.version);

  const gitignore = await fs.readFile(path.join(target, '.gitignore'), 'utf8');
  assert.match(gitignore, /^node_modules\/$/m);
  assert.match(gitignore, /^dist\/$/m);
});

test('repo-only files never reach the new project', async (t) => {
  const target = await scaffold(t);

  for (const rel of [
    'node_modules',
    'dist',
    '.git',
    'bin',
    'test',
    '.github',
    'package-lock.json',
    'CONTEXT.md',
    'docs/assets',
  ]) {
    assert.equal(await exists(path.join(target, rel)), false, `${rel} must not be scaffolded`);
  }
});

test('generated package.json is private and independent of the CLI package', async (t) => {
  const target = await scaffold(t, ['--name', 'My Video!']);
  const pkg = JSON.parse(await fs.readFile(path.join(target, 'package.json'), 'utf8'));

  assert.equal(pkg.name, 'my-video');
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.bin, undefined);
  assert.equal(pkg.files, undefined);
  assert.deepEqual(pkg.devDependencies, PKG.devDependencies);
  assert.deepEqual(Object.keys(pkg.scripts).sort(), ['build', 'dev', 'gen:index', 'render']);
});

test('refuses to merge into a non-empty directory', async (t) => {
  const tmp = await tempDir(t);
  const target = path.join(tmp, 'busy');
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, 'important.txt'), 'keep me');

  await assert.rejects(
    run(process.execPath, [CLI, target, '--no-install']),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /not empty/);
      return true;
    },
  );
  assert.equal(await fs.readFile(path.join(target, 'important.txt'), 'utf8'), 'keep me');
});

test('--help and --version exit cleanly', async () => {
  const help = await run(process.execPath, [CLI, '--help']);
  assert.match(help.stdout, /Scaffold a new Fake Screen Studio project/);

  const version = await run(process.execPath, [CLI, '--version']);
  assert.equal(version.stdout.trim(), PKG.version);
});
