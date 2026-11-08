import { ACTIONS, ANCHORS, WINDOW_TEMPLATES, ZOOM_PRESETS } from '../registry';
import { EASINGS } from '../engine/easing';
import type { Anchor, Scenario } from './types';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function checkRect(r: unknown, where: string, errors: string[]) {
  if (!isRecord(r)) {
    errors.push(`${where}: rect wajib berupa object { x, y, width, height }`);
    return;
  }
  for (const k of ['x', 'y', 'width', 'height']) {
    if (!isNum(r[k])) errors.push(`${where}: rect.${k} harus angka`);
  }
  if (isNum(r.width) && r.width <= 0) errors.push(`${where}: rect.width harus > 0`);
  if (isNum(r.height) && r.height <= 0) errors.push(`${where}: rect.height harus > 0`);
}

/** Validate raw scenario JSON against the component registry and structural rules. */
export function validateScenario(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(raw)) return ['Scenario harus berupa object JSON'];

  const { name, duration, fps, width, height, windows, actions, zoomShots } = raw;

  if (typeof name !== 'string' || !name) errors.push('name wajib berupa string non-kosong');
  if (!isNum(duration) || duration <= 0) errors.push('duration wajib angka > 0 (detik)');
  if (!isNum(fps) || fps <= 0 || fps % 1 !== 0) errors.push('fps wajib bilangan bulat > 0');
  if (!isNum(width) || !isNum(height)) errors.push('width & height wajib angka');

  if (!Array.isArray(windows) || windows.length === 0) {
    errors.push('windows wajib array berisi minimal 1 window');
    return errors;
  }

  const ids = new Set<string>();
  windows.forEach((w, i) => {
    const where = `windows[${i}]`;
    if (!isRecord(w)) {
      errors.push(`${where}: wajib object`);
      return;
    }
    if (typeof w.id !== 'string' || !w.id) {
      errors.push(`${where}: id wajib string non-kosong`);
    } else if (ids.has(w.id)) {
      errors.push(`${where}: id "${w.id}" duplikat`);
    } else {
      ids.add(w.id);
    }
    if (typeof w.template !== 'string' || !WINDOW_TEMPLATES.some((t) => t.id === w.template)) {
      errors.push(
        `${where}: template "${String(w.template)}" tidak ada di registry (tersedia: ${WINDOW_TEMPLATES.map((t) => t.id).join(', ')})`,
      );
    }
    if (typeof w.title !== 'string') errors.push(`${where}: title wajib string`);
    checkRect(w.rect, where, errors);
    if (w.z !== undefined && !isNum(w.z)) errors.push(`${where}: z harus angka`);
    if (w.hidden !== undefined && typeof w.hidden !== 'boolean') errors.push(`${where}: hidden harus boolean`);
    if (w.content !== undefined) {
      if (!isRecord(w.content)) {
        errors.push(`${where}: content wajib object`);
      } else if (w.content.lines !== undefined && !Array.isArray(w.content.lines)) {
        errors.push(`${where}: content.lines wajib array of string`);
      }
    }
  });

  if (!Array.isArray(actions)) {
    errors.push('actions wajib array');
  } else {
    actions.forEach((a, i) => {
      const where = `actions[${i}]`;
      if (!isRecord(a)) {
        errors.push(`${where}: wajib object`);
        return;
      }
      const def = ACTIONS.find((d) => d.type === a.type);
      if (!def) {
        errors.push(
          `${where}: type "${String(a.type)}" tidak ada di registry (tersedia: ${ACTIONS.map((d) => d.type).join(', ')})`,
        );
        return;
      }
      for (const p of def.params) {
        if (p.required && a[p.name] === undefined) {
          errors.push(`${where} (${def.type}): param wajib "${p.name}" hilang`);
        }
      }
      if (!isNum(a.at)) {
        errors.push(`${where} (${def.type}): at wajib angka`);
      } else if (isNum(duration) && (a.at < 0 || a.at > duration)) {
        errors.push(`${where} (${def.type}): at ${a.at} di luar rentang 0..${duration}`);
      }
      if (def.type === 'open_window') {
        const w = windows.find((x) => isRecord(x) && x.id === a.window);
        if (!w) {
          errors.push(`${where}: window "${String(a.window)}" tidak ditemukan`);
        } else if (w.hidden !== true) {
          errors.push(`${where}: window "${String(a.window)}" harus berdeclare "hidden": true agar bisa dibuka`);
        }
      }
      if (def.type === 'type_text') {
        if (!ids.has(String(a.window))) errors.push(`${where}: window "${String(a.window)}" tidak ditemukan`);
        if (typeof a.text !== 'string' || a.text.length === 0) errors.push(`${where}: text wajib string non-kosong`);
      }
      if (def.type === 'click') {
        if (!isRecord(a.target)) {
          errors.push(`${where}: target wajib object { window, anchor? }`);
        } else {
          if (!ids.has(String(a.target.window))) errors.push(`${where}: target.window "${String(a.target.window)}" tidak ditemukan`);
          if (a.target.anchor !== undefined && !(ANCHORS as readonly string[]).includes(a.target.anchor as Anchor)) {
            errors.push(`${where}: anchor "${String(a.target.anchor)}" tidak dikenal (tersedia: ${ANCHORS.join(', ')})`);
          }
        }
      }
    });
  }

  if (!Array.isArray(zoomShots)) {
    errors.push('zoomShots wajib array (boleh kosong)');
  } else {
    let prevEnd = -1;
    zoomShots.forEach((z, i) => {
      const where = `zoomShots[${i}]`;
      if (!isRecord(z)) {
        errors.push(`${where}: wajib object`);
        return;
      }
      const preset = z.preset !== undefined ? ZOOM_PRESETS.find((p) => p.id === z.preset) : undefined;
      if (z.preset !== undefined && !preset) {
        errors.push(`${where}: preset "${String(z.preset)}" tidak ada di registry (tersedia: ${ZOOM_PRESETS.map((p) => p.id).join(', ')})`);
      }
      if (!isNum(z.start)) {
        errors.push(`${where}: start wajib angka`);
        return;
      }
      if (isNum(duration) && (z.start < 0 || z.start > duration)) errors.push(`${where}: start ${z.start} di luar rentang 0..${duration}`);
      if (z.start < prevEnd) errors.push(`${where}: zoom shot tumpang tindih dengan shot sebelumnya`);
      const dur = z.duration ?? preset?.duration;
      if (z.duration !== undefined && (!isNum(z.duration) || z.duration <= 0)) errors.push(`${where}: duration harus angka > 0`);
      if (dur === undefined && z.scale === undefined) {
        errors.push(`${where}: butuh "preset" atau "scale" eksplisit`);
      }
      prevEnd = z.start + (isNum(dur) ? dur : 0.9);
      if (z.scale !== undefined && (!isNum(z.scale) || z.scale <= 0)) errors.push(`${where}: scale harus angka > 0`);
      if (z.easing !== undefined && !(EASINGS as readonly string[]).includes(z.easing as string)) {
        errors.push(`${where}: easing "${String(z.easing)}" tidak dikenal (tersedia: ${EASINGS.join(', ')})`);
      }
      if (z.target === null || z.target === undefined) return;
      if (!isRecord(z.target)) {
        errors.push(`${where}: target harus { window, anchor? } atau null`);
      } else {
        if (!ids.has(String(z.target.window))) errors.push(`${where}: target.window "${String(z.target.window)}" tidak ditemukan`);
        if (z.target.anchor !== undefined && !(ANCHORS as readonly string[]).includes(z.target.anchor as Anchor)) {
          errors.push(`${where}: anchor "${String(z.target.anchor)}" tidak dikenal`);
        }
      }
    });
  }

  return errors;
}

export function parseScenario(text: string): { scenario?: Scenario; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { errors: [`JSON tidak valid: ${(e as Error).message}`] };
  }
  const errors = validateScenario(raw);
  if (errors.length) return { errors };
  return { scenario: raw as Scenario, errors: [] };
}
