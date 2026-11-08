# Video Index

> **Generated** by `npm run gen:index` from `src/registry/index.ts` — do not edit by hand.
> Edit the registry instead, then regenerate.

## Rules

- Read this **before** writing or editing a scenario file.
- Only use action types, zoom presets, window templates, and anchors **registered below**. If nothing fits, the component must be added to `src/registry/index.ts` (and its handler in the engine) first — never invent ad hoc fields or animations.
- Scenarios live at `scenarios/<nama-video>/scenario.json`. The preview (`npm run dev`) reloads automatically when the file changes; render with `npm run render`.
- Timing is in **seconds**; coordinates are in **1920×1080** screen space (top-left origin).
- Every scenario is validated against this registry before it renders; unknown types or missing required params are hard errors.

## Scenario shape

```json
{
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
}
```

- `zoomShots[].target: null` (or omitted) = zoom out to full screen.
- `zoomShots` must not overlap; each needs a `preset` or explicit `scale`/`duration`/`easing`.
- Windows with an `open_window` action must declare `"hidden": true`.
- Gestures (cursor motion, click ripple, typing speed) are **derived from actions** — never written into the scenario.

## Action types

### `open_window`

Membuka fake window yang sebelumnya hidden, dengan animasi scale+fade. Semua elemen di belakangnya (desktop dan window lain) ikut buram (blur) seiring animasi berjalan.

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `window` | `string` | yes | id window yang dibuka; window harus berdeclare "hidden": true |
| `at` | `number` | yes | waktu mulai membuka, dalam detik |

Example:

```json
{ "type": "open_window", "window": "notepad", "at": 1.2 }
```

### `type_text`

Cursor bergerak ke area pengetikan window, lalu mengetik teks karakter demi karakter (60ms/karakter) dengan caret berkedip.

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `window` | `string` | yes | id window yang menerima teks |
| `text` | `string` | yes | teks yang diketik |
| `at` | `number` | yes | waktu pengetikan mulai (teks pertama muncul); cursor tiba tepat sebelum waktu ini |

Example:

```json
{ "type": "type_text", "window": "notepad", "text": "Halo!", "at": 3.2 }
```

### `click`

Cursor bergerak ke titik target lalu mengklik: ripple 0,45 detik dan cursor mengecil sesaat.

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `target` | `{ window, anchor? }` | yes | window + anchor titik klik (default anchor: body) |
| `at` | `number` | yes | waktu klik; cursor tiba tepat sebelum waktu ini |

Example:

```json
{ "type": "click", "target": { "window": "notepad", "anchor": "caption:close" }, "at": 7.2 }
```


## Gestures (engine-derived defaults)

### `cursor-move`

Gerak antar titik yang diturunkan engine dari urutan action — tidak pernah ditulis manual.

- Durasi = min(0.9s, 0.3 + jarak/1200), easing ease-out-cubic
- Cursor selalu tiba tepat sebelum `at` action berikutnya
- Posisi awal: tengah-bawah layar

### `click-ripple`

Efek klik yang muncul di titik target.

- Ripple 0.45s: scale 0.3 → 1, opacity 0.5 → 0
- Cursor mengecil (scale 0.9) selama ~0.18s pertama

### `type-caret`

Pengetikan karakter demi karakter beserta caret.

- 60ms per karakter
- Caret berkedip 0,5s sejak teks pertama muncul
- Beberapa action type_text pada window yang sama berurutan otomatis

### `window-open`

Animasi membuka window + blur latar di belakangnya.

- Durasi 0.35s: scale 0.92 → 1, opacity 0 → 1
- Blur maksimum 14px pada desktop dan window yang lebih belakang


## Zoom presets

| Preset | Scale | Duration | Easing | Use for |
| --- | --- | --- | --- | --- |
| `zoom-to-detail` | 1.9 | 0.9s | `easeInOutCubic` | Zoom masuk ke area kerja (pengetikan/klik) agar penonton fokus ke detail. |
| `zoom-out-overview` | 1 | 0.9s | `easeInOutCubic` | Kembali ke tampilan seluruh layar. |

A zoom shot can override any of these fields explicitly (`scale`, `duration`, `easing`) while using the preset as its base.

## Window templates

### `generic`

Tiruan window ala Windows 11: titlebar 36px (judul di tengah, tombol minimize/maximize/close di kanan), sudut membulat 8px, bayangan lembut, area body gelap.

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | `string` | yes | teks judul di titlebar |
| `rect` | `{ x, y, width, height }` | yes | posisi & ukuran window dalam koordinat layar 1920×1080 |
| `z` | `number` | no | urutan tumpukan (default 1); window dengan z lebih tinggi menutupi yang lebih rendah |
| `hidden` | `boolean` | no | true bila window dibuka lewat action open_window |
| `content.lines` | `string[]` | no | baris teks statis di body (untuk konten yang tidak diketik) |


## Click anchors

Available values for `target.anchor` (default: `body`):

- `body`
- `titlebar`
- `caption:minimize`
- `caption:maximize`
- `caption:close`
