# Project

<!-- Add project-wide guidance here. -->

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles used as-is: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Video index

Before writing or editing a scenario, read `docs/agents/video-index.md`. Only use action types, gesture/zoom presets, and window templates registered there — if nothing fits, the component must be added to the registry first, never written ad hoc.
