// Generate docs/agents/video-index.md from the component registry
// (src/registry/index.ts) so the index an agent reads can never go stale.
import fs from 'node:fs';
import path from 'node:path';
import { ACTIONS, ANCHORS, GESTURES, WINDOW_TEMPLATES, ZOOM_PRESETS } from '../src/registry/index';

const out = path.resolve('docs/agents/video-index.md');

const paramTable = (params: { name: string; type: string; required: boolean; description: string }[]) =>
  ['| Param | Type | Required | Description |', '| --- | --- | --- | --- |', ...params.map((p) => `| \`${p.name}\` | \`${p.type}\` | ${p.required ? 'yes' : 'no'} | ${p.description} |`)].join('\n');

const skeleton = `{
  "name": "judul-video",
  "duration": 30,
  "fps": 60,
  "width": 1920,
  "height": 1080,
  "windows": [
    { "id": "app", "template": "generic", "title": "Judul Window",
      "rect": { "x": 220, "y": 130, "width": 1480, "height": 840 },
      "content": { "lines": ["baris teks statis"] } },
    { "id": "front", "template": "generic", "title": "Judul", "hidden": true, "z": 2,
      "rect": { "x": 540, "y": 300, "width": 840, "height": 520 },
      "content": { "lines": [] } }
  ],
  "actions": [
    { "type": "open_window", "window": "front", "at": 1.2 },
    { "type": "type_text", "window": "front", "text": "Teks yang diketik", "at": 3.0 },
    { "type": "click", "target": { "window": "front", "anchor": "caption:close" }, "at": 7.0 }
  ],
  "zoomShots": [
    { "preset": "zoom-to-detail", "start": 2.6, "target": { "window": "front", "anchor": "body" } },
    { "preset": "zoom-out-overview", "start": 6.4, "target": null }
  ]
}`;

const md = `# Video Index

> **Generated** by \`npm run gen:index\` from \`src/registry/index.ts\` — do not edit by hand.
> Edit the registry instead, then regenerate.

## Rules

- Read this **before** writing or editing a scenario file.
- Only use action types, zoom presets, window templates, and anchors **registered below**. If nothing fits, the component must be added to \`src/registry/index.ts\` (and its handler in the engine) first — never invent ad hoc fields or animations.
- Scenarios live at \`scenarios/<nama-video>/scenario.json\`. The preview (\`npm run dev\`) reloads automatically when the file changes; render with \`npm run render\`.
- Timing is in **seconds**; coordinates are in **1920×1080** screen space (top-left origin).
- Every scenario is validated against this registry before it renders; unknown types or missing required params are hard errors.

## Scenario shape

\`\`\`json
${skeleton}
\`\`\`

- \`zoomShots[].target: null\` (or omitted) = zoom out to full screen.
- \`zoomShots\` must not overlap; each needs a \`preset\` or explicit \`scale\`/\`duration\`/\`easing\`.
- Windows with an \`open_window\` action must declare \`"hidden": true\`.
- Gestures (cursor motion, click ripple, typing speed) are **derived from actions** — never written into the scenario.

## Action types

${ACTIONS.map(
  (a) => `### \`${a.type}\`

${a.summary}

${paramTable(a.params)}

Example:

\`\`\`json
${a.example}
\`\`\`
`,
).join('\n')}

## Gestures (engine-derived defaults)

${GESTURES.map((g) => `### \`${g.id}\`

${g.summary}

${g.defaults.map((d) => `- ${d}`).join('\n')}
`).join('\n')}

## Zoom presets

| Preset | Scale | Duration | Easing | Use for |
| --- | --- | --- | --- | --- |
${ZOOM_PRESETS.map((z) => `| \`${z.id}\` | ${z.scale} | ${z.duration}s | \`${z.easing}\` | ${z.summary} |`).join('\n')}

A zoom shot can override any of these fields explicitly (\`scale\`, \`duration\`, \`easing\`) while using the preset as its base.

## Window templates

${WINDOW_TEMPLATES.map(
  (w) => `### \`${w.id}\`

${w.summary}

${paramTable(w.slots)}
`,
).join('\n')}

## Click anchors

Available values for \`target.anchor\` (default: \`body\`):

${ANCHORS.map((a) => `- \`${a}\``).join('\n')}
`;

fs.writeFileSync(out, md);
console.log(`Wrote ${out} (${md.length} bytes)`);
