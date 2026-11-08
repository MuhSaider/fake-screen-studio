# Contributing to Fake Screen Studio

Thanks for taking the time to contribute. This project is small and opinionated, so a
short conversation before a large change saves everyone work — open an issue first for
anything beyond a typo or a focused bug fix.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

```bash
git clone https://github.com/MuhSaider/fake-screen-studio.git
cd fake-screen-studio
npm ci
npm test              # packaging + scaffold contract tests
npx tsc --noEmit      # typecheck
npm run dev           # preview
npm run render        # render scenarios/hello/scenario.json (~2 min)
```

Requirements: Node.js 22+ and a Chrome/Edge/Chromium/Brave install (or `STUDIO_BROWSER`).

## What to change, and where

- **Scenarios** (`scenarios/*/scenario.json`) describe a video; they do not change engine
  behaviour. Read [`docs/agents/video-index.md`](docs/agents/video-index.md) first.
- **Components** (new action, zoom preset, window template, click anchor) are added to
  `src/registry/index.ts` *and* implemented in `src/engine/`. Then run
  `npm run gen:index` and commit the regenerated index. A component that exists in the
  registry but not in the engine (or vice versa) is a bug.
- **Engine behaviour** that changes how every video looks or renders needs an ADR in
  `docs/adr/` (see the existing two for the expected shape). Small fixes do not.
- **Renderer** (`scripts/render.mjs`) must stay cross-platform. Absolute browser paths
  belong in the candidate list *and* behind the `STUDIO_BROWSER` override.

## The packaging contract

The npm package **is** the project template. `bin/fake-screen-studio.mjs` copies the
paths in its `PAYLOAD` list, and `package.json` `files` must cover every one of them.
`test/scaffold.test.mjs` fails if they drift, and it also asserts that repository-only
files (`.github/`, `test/`, `scenarios/demo/`, `docs/assets/`, `CONTEXT.md`, the CLI
itself) never end up in a generated project.

If you add a runtime file that a generated project needs, update **both** lists and add
an assertion to the test.

## Style

- TypeScript for `src/` and `scripts/*.ts`; plain ESM `.mjs` for the CLI and renderer —
  no build step, no runtime dependencies.
- No formatter or linter is configured. Match the surrounding code: single quotes, two
  spaces, semicolons, small functions with comments only where the reason is not obvious.
- English for code, error messages, README, and contributor docs. Architecture records
  and agent-facing docs are still Indonesian; translating them is welcome work.

## Tests

```bash
npm test
```

Tests use the built-in `node:test` runner. Anything that touches packaging, scaffold
output, or scenario validation should come with a test. Rendering itself is verified
manually: render a scenario, extract a few frames from the MP4, and look at them — do not
trust "command succeeded" alone.

## Commit and pull request

- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
  `docs:`, `refactor:`, `test:`). One logical change per PR.
- Keep PR descriptions focused: what changed, why, and how you verified it. Screenshots
  of rendered frames are worth more than prose for visual changes.
- CI must be green: typecheck, `gen:index` drift check, and tests.

## Release process

Maintainers only:

1. Update `CHANGELOG.md` and bump `version` in `package.json`.
2. `npm test && npx tsc --noEmit`.
3. `npm login` (once per machine), then `npm publish`.
4. `git tag v<version> && git push --tags`, and create a GitHub release with the rendered
   demo MP4 attached.
5. Render `scenarios/hello/scenario.json` and attach the MP4 to the release; keep the GIF
   in `docs/assets/` small (< 3 MB).

## Reporting bugs

Use the GitHub issue templates. Include OS, Node version, browser and version, the
scenario file (or a reduced version), and the last ~20 lines of output. If a render looks
wrong, attach a frame.
