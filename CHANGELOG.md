# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.1.0] - 2026-11-08

First public release.

### Added

- `fake-screen-studio` scaffolder (`npx fake-screen-studio <dir>`) that copies the engine,
  render pipeline, docs, and a starter scenario into a new project.
- Deterministic scenario engine: fake Windows 11 desktop, windows, cursor, typing, click
  ripples, and smooth zoom shots driven by a JSON scenario.
- Live preview with `npm run dev` and scenario file hot-reload.
- Frame-by-frame MP4 rendering with `npm run render` (headless browser + ffmpeg).
- Generated component index (`npm run gen:index` → `docs/agents/video-index.md`).
- Cross-platform browser detection with a `STUDIO_BROWSER` override.
- Packaging contract tests using `node:test`.
- README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, MIT license, issue/PR templates, and CI.

[Unreleased]: https://github.com/MuhSaider/fake-screen-studio/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MuhSaider/fake-screen-studio/releases/tag/v0.1.0
