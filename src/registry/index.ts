// Component registry — the single source of truth for what an agent may use
// in a scenario. docs/agents/video-index.md is generated from this file
// (npm run gen:index); the engine validates scenarios against it.

export interface ParamDef {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ActionEntry {
  type: string;
  summary: string;
  params: ParamDef[];
  example: string;
}

export interface GestureEntry {
  id: string;
  summary: string;
  defaults: string[];
}

export interface ZoomPresetEntry {
  id: string;
  summary: string;
  scale: number;
  duration: number;
  easing: string;
}

export interface WindowTemplateEntry {
  id: string;
  summary: string;
  slots: ParamDef[];
}

export const ANCHORS = [
  'body',
  'titlebar',
  'caption:minimize',
  'caption:maximize',
  'caption:close',
] as const;

export const ACTIONS: ActionEntry[] = [
  {
    type: 'open_window',
    summary:
      'Membuka fake window yang sebelumnya hidden, dengan animasi scale+fade. Semua elemen di belakangnya (desktop dan window lain) ikut buram (blur) seiring animasi berjalan.',
    params: [
      { name: 'window', type: 'string', required: true, description: 'id window yang dibuka; window harus berdeclare "hidden": true' },
      { name: 'at', type: 'number', required: true, description: 'waktu mulai membuka, dalam detik' },
    ],
    example: '{ "type": "open_window", "window": "notepad", "at": 1.2 }',
  },
  {
    type: 'type_text',
    summary:
      'Cursor bergerak ke area pengetikan window, lalu mengetik teks karakter demi karakter (60ms/karakter) dengan caret berkedip.',
    params: [
      { name: 'window', type: 'string', required: true, description: 'id window yang menerima teks' },
      { name: 'text', type: 'string', required: true, description: 'teks yang diketik' },
      { name: 'at', type: 'number', required: true, description: 'waktu pengetikan mulai (teks pertama muncul); cursor tiba tepat sebelum waktu ini' },
    ],
    example: '{ "type": "type_text", "window": "notepad", "text": "Halo!", "at": 3.2 }',
  },
  {
    type: 'click',
    summary:
      'Cursor bergerak ke titik target lalu mengklik: ripple 0,45 detik dan cursor mengecil sesaat.',
    params: [
      { name: 'target', type: '{ window, anchor? }', required: true, description: 'window + anchor titik klik (default anchor: body)' },
      { name: 'at', type: 'number', required: true, description: 'waktu klik; cursor tiba tepat sebelum waktu ini' },
    ],
    example: '{ "type": "click", "target": { "window": "notepad", "anchor": "caption:close" }, "at": 7.2 }',
  },
];

export const GESTURES: GestureEntry[] = [
  {
    id: 'cursor-move',
    summary: 'Gerak antar titik yang diturunkan engine dari urutan action — tidak pernah ditulis manual.',
    defaults: [
      'Durasi = min(0.9s, 0.3 + jarak/1200), easing ease-out-cubic',
      'Cursor selalu tiba tepat sebelum `at` action berikutnya',
      'Posisi awal: tengah-bawah layar',
    ],
  },
  {
    id: 'click-ripple',
    summary: 'Efek klik yang muncul di titik target.',
    defaults: [
      'Ripple 0.45s: scale 0.3 → 1, opacity 0.5 → 0',
      'Cursor mengecil (scale 0.9) selama ~0.18s pertama',
    ],
  },
  {
    id: 'type-caret',
    summary: 'Pengetikan karakter demi karakter beserta caret.',
    defaults: [
      '60ms per karakter',
      'Caret berkedip 0,5s sejak teks pertama muncul',
      'Beberapa action type_text pada window yang sama berurutan otomatis',
    ],
  },
  {
    id: 'window-open',
    summary: 'Animasi membuka window + blur latar di belakangnya.',
    defaults: [
      'Durasi 0.35s: scale 0.92 → 1, opacity 0 → 1',
      'Blur maksimum 14px pada desktop dan window yang lebih belakang',
    ],
  },
];

export const ZOOM_PRESETS: ZoomPresetEntry[] = [
  {
    id: 'zoom-to-detail',
    summary: 'Zoom masuk ke area kerja (pengetikan/klik) agar penonton fokus ke detail.',
    scale: 1.9,
    duration: 0.9,
    easing: 'easeInOutCubic',
  },
  {
    id: 'zoom-out-overview',
    summary: 'Kembali ke tampilan seluruh layar.',
    scale: 1,
    duration: 0.9,
    easing: 'easeInOutCubic',
  },
];

export const WINDOW_TEMPLATES: WindowTemplateEntry[] = [
  {
    id: 'generic',
    summary:
      'Tiruan window ala Windows 11: titlebar 36px (judul di tengah, tombol minimize/maximize/close di kanan), sudut membulat 8px, bayangan lembut, area body gelap.',
    slots: [
      { name: 'title', type: 'string', required: true, description: 'teks judul di titlebar' },
      { name: 'rect', type: '{ x, y, width, height }', required: true, description: 'posisi & ukuran window dalam koordinat layar 1920×1080' },
      { name: 'z', type: 'number', required: false, description: 'urutan tumpukan (default 1); window dengan z lebih tinggi menutupi yang lebih rendah' },
      { name: 'hidden', type: 'boolean', required: false, description: 'true bila window dibuka lewat action open_window' },
      { name: 'content.lines', type: 'string[]', required: false, description: 'baris teks statis di body (untuk konten yang tidak diketik)' },
    ],
  },
];
