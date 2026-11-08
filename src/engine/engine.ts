import type { ActionDef, Anchor, Scenario, TargetRef, WindowDef } from '../scenario/types';
import { ZOOM_PRESETS } from '../registry';
import { getEasing } from './easing';

const TITLEBAR_H = 36;
const OPEN_DUR = 0.35;
const MAX_BLUR_PX = 14;
const MS_PER_CHAR = 60;
const RIPPLE_DUR = 0.45;
const PRESS_DUR = 0.18;
const RIPPLE_SIZE = 64;

interface Pt {
  x: number;
  y: number;
}

interface CamState {
  scale: number;
  cx: number;
  cy: number;
}

interface CamShot {
  start: number;
  dur: number;
  to: CamState;
  ease: (p: number) => number;
}

interface Move {
  fromT: number;
  toT: number;
  from: Pt;
  to: Pt;
}

interface TypeSeg {
  window: string;
  start: number;
  end: number;
  text: string;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function captionButtonX(rect: { x: number; width: number }, n: number): number {
  // buttons are 40px wide, anchored right: close = n0, maximize = n1, minimize = n2
  return rect.x + rect.width - 20 - n * 40;
}

function anchorPoint(w: WindowDef, anchor: Anchor): Pt {
  const r = w.rect;
  switch (anchor) {
    case 'titlebar':
      return { x: r.x + r.width / 2, y: r.y + TITLEBAR_H / 2 };
    case 'caption:close':
      return { x: captionButtonX(r, 0), y: r.y + TITLEBAR_H / 2 };
    case 'caption:maximize':
      return { x: captionButtonX(r, 1), y: r.y + TITLEBAR_H / 2 };
    case 'caption:minimize':
      return { x: captionButtonX(r, 2), y: r.y + TITLEBAR_H / 2 };
    case 'body':
    default:
      return { x: r.x + r.width / 2, y: r.y + TITLEBAR_H + (r.height - TITLEBAR_H) / 2 };
  }
}

function typingPoint(w: WindowDef): Pt {
  return { x: w.rect.x + 40, y: w.rect.y + TITLEBAR_H + 52 };
}

function targetPoint(windows: Map<string, WindowDef>, target: TargetRef): Pt {
  const w = windows.get(target.window);
  if (!w) throw new Error(`target window "${target.window}" tidak ditemukan`);
  return anchorPoint(w, target.anchor ?? 'body');
}

export class Engine {
  private scenario: Scenario;
  private world: HTMLElement;
  private desktop!: HTMLElement;
  private cursor!: SVGSVGElement;
  private ripple!: HTMLElement;
  private windowEls = new Map<string, { el: HTMLElement; body: HTMLElement; typed: HTMLElement; caret: HTMLElement; def: WindowDef }>();
  private cameraShots: CamShot[] = [];
  private moves: Move[] = [];
  private typeSegs: TypeSeg[] = [];
  private openActions: { at: number; window: string }[] = [];

  constructor(stage: HTMLElement, scenario: Scenario) {
    this.scenario = scenario;
    stage.innerHTML = '';

    const world = document.createElement('div');
    world.id = 'world';
    world.style.width = `${scenario.width}px`;
    world.style.height = `${scenario.height}px`;
    stage.appendChild(world);
    this.world = world;

    this.buildDesktop();
    for (const w of [...scenario.windows].sort((a, b) => (a.z ?? 1) - (b.z ?? 1))) {
      this.buildWindow(w);
    }
    this.buildCursor();
    this.buildRipple();
    this.deriveCamera();
    this.deriveCursor();
    this.deriveTyping();
    this.openActions = scenario.actions
      .filter((a) => a.type === 'open_window')
      .map((a) => ({ at: a.at, window: String(a.window) }));
  }

  // ---------- build ----------

  private buildDesktop() {
    const desktop = document.createElement('div');
    desktop.id = 'desktop';
    const wallpaper = document.createElement('div');
    wallpaper.id = 'wallpaper';
    const taskbar = document.createElement('div');
    taskbar.id = 'taskbar';
    const iconColors = ['#4cc2ff', '#7a7a7a', '#f2c94c', '#eb5757', '#6fcf97', '#9b51e0'];
    for (const c of iconColors) {
      const ic = document.createElement('div');
      ic.className = 'task-icon';
      ic.style.background = c;
      taskbar.appendChild(ic);
    }
    desktop.append(wallpaper, taskbar);
    this.world.appendChild(desktop);
    this.desktop = desktop;
  }

  private buildWindow(def: WindowDef) {
    const el = document.createElement('div');
    el.className = 'window';
    el.dataset.id = def.id;
    const r = def.rect;
    el.style.left = `${r.x}px`;
    el.style.top = `${r.y}px`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
    el.style.zIndex = String(def.z ?? 1);

    const titlebar = document.createElement('div');
    titlebar.className = 'titlebar';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = def.title;
    const caps = document.createElement('div');
    caps.className = 'caps';
    caps.innerHTML = '<span class="cap min"></span><span class="cap max"></span><span class="cap close">✕</span>';
    titlebar.append(title, caps);

    const body = document.createElement('div');
    body.className = 'body';
    const lines = document.createElement('div');
    lines.className = 'lines';
    for (const line of def.content?.lines ?? []) {
      const p = document.createElement('p');
      p.textContent = line || '\u00a0';
      if (!line) p.classList.add('spacer');
      lines.appendChild(p);
    }
    const typed = document.createElement('div');
    typed.className = 'typed';
    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.textContent = '▏';
    typed.appendChild(caret);
    body.append(lines, typed);

    el.append(titlebar, body);
    if (def.hidden) el.style.display = 'none';
    this.world.appendChild(el);
    this.windowEls.set(def.id, { el, body, typed, caret, def });
  }

  private buildCursor() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.id = 'cursor';
    svg.setAttribute('width', '26');
    svg.setAttribute('height', '34');
    svg.setAttribute('viewBox', '0 0 26 34');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute(
      'd',
      'M2 2 L2 26 L8.5 20 L12.5 30 L17 28 L13 18.5 L22 18 Z',
    );
    path.setAttribute('fill', '#ffffff');
    path.setAttribute('stroke', '#000000');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    this.world.appendChild(svg);
    this.cursor = svg;
  }

  private buildRipple() {
    const el = document.createElement('div');
    el.id = 'ripple';
    el.style.display = 'none';
    this.world.appendChild(el);
    this.ripple = el;
  }

  // ---------- derived timelines (gesture defaults) ----------

  private deriveCamera() {
    const { width, height, zoomShots } = this.scenario;
    const windows = new Map(this.scenario.windows.map((w) => [w.id, w]));
    this.cameraShots = zoomShots.map((z) => {
      const preset = ZOOM_PRESETS.find((p) => p.id === z.preset);
      const scale = z.scale ?? preset?.scale ?? 1.4;
      const dur = z.duration ?? preset?.duration ?? 0.8;
      const easing = z.easing ?? preset?.easing ?? 'easeInOutCubic';
      let cx = width / 2;
      let cy = height / 2;
      if (z.target) {
        const p = targetPoint(windows, z.target);
        cx = p.x;
        cy = p.y;
      }
      return { start: z.start, dur, to: { scale, cx, cy }, ease: getEasing(easing) };
    });
  }

  private deriveCursor() {
    const { width, height, actions } = this.scenario;
    const windows = new Map(this.scenario.windows.map((w) => [w.id, w]));
    const waypoints: { at: number; p: Pt }[] = [];
    for (const a of [...actions].sort((x, y) => x.at - y.at)) {
      if (a.type === 'type_text') {
        const w = windows.get(String(a.window));
        if (w) waypoints.push({ at: a.at, p: typingPoint(w) });
      } else if (a.type === 'click' && a.target) {
        waypoints.push({ at: a.at, p: targetPoint(windows, a.target) });
      }
    }

    const moves: Move[] = [];
    let cur: Pt = { x: width / 2, y: height * 0.72 };
    let curT = 0;
    for (const wp of waypoints) {
      const dist = Math.hypot(wp.p.x - cur.x, wp.p.y - cur.y);
      const moveDur = Math.min(0.9, 0.3 + dist / 1200);
      let arrive = wp.at - moveDur;
      if (arrive < curT + 0.05) arrive = Math.max(curT, wp.at - 0.05);
      moves.push({ fromT: curT, toT: arrive, from: cur, to: wp.p });
      cur = wp.p;
      curT = arrive;
    }
    this.moves = moves;
  }

  private deriveTyping() {
    const clock = new Map<string, number>();
    const segs: TypeSeg[] = [];
    for (const a of [...this.scenario.actions].sort((x, y) => x.at - y.at)) {
      if (a.type !== 'type_text') continue;
      const win = String(a.window);
      const text = String(a.text);
      const start = Math.max(a.at, clock.get(win) ?? 0);
      const end = start + (text.length * MS_PER_CHAR) / 1000;
      segs.push({ window: win, start, end, text });
      clock.set(win, end);
    }
    this.typeSegs = segs;
  }

  // ---------- per-frame ----------

  seek(tRaw: number): void {
    const t = Math.max(0, Math.min(tRaw, this.scenario.duration));
    this.applyCamera(t);
    this.applyWindows(t);
    this.applyTyping(t);
    this.applyRipple(t);
    this.applyCursor(t);
  }

  private applyCamera(t: number) {
    const state: CamState = { scale: 1, cx: this.scenario.width / 2, cy: this.scenario.height / 2 };
    for (const s of this.cameraShots) {
      if (t < s.start) break;
      const p = clamp01((t - s.start) / s.dur);
      const e = s.ease(p);
      state.scale = lerp(state.scale, s.to.scale, e);
      state.cx = lerp(state.cx, s.to.cx, e);
      state.cy = lerp(state.cy, s.to.cy, e);
      if (p < 1) break;
    }
    const { width, height } = this.scenario;
    this.world.style.transform = `translate(${width / 2}px, ${height / 2}px) scale(${state.scale}) translate(${-state.cx}px, ${-state.cy}px)`;
  }

  private applyWindows(t: number) {
    // Front window = the opened window with the highest z; its open progress
    // drives the blur of everything behind it (desktop + lower-z windows).
    let frontZ = -Infinity;
    let blurP = 0;
    for (const oa of this.openActions) {
      const win = this.windowEls.get(oa.window);
      if (!win || t < oa.at) continue;
      const p = clamp01((t - oa.at) / OPEN_DUR);
      win.el.style.display = '';
      win.el.style.opacity = String(p);
      win.el.style.transform = `scale(${0.92 + 0.08 * p})`;
      const z = win.def.z ?? 1;
      if (z > frontZ) {
        frontZ = z;
        blurP = p;
      }
    }

    const blur = blurP > 0 ? `blur(${(MAX_BLUR_PX * blurP).toFixed(2)}px)` : '';
    this.desktop.style.filter = blur;
    for (const w of this.windowEls.values()) {
      const z = w.def.z ?? 1;
      w.el.style.filter = frontZ > -Infinity && z < frontZ ? blur : '';
      const opened = this.openActions.find((oa) => oa.window === w.def.id);
      if (opened && t < opened.at) {
        w.el.style.display = 'none';
        w.el.style.opacity = '0';
      }
    }
  }

  private applyTyping(t: number) {
    for (const w of this.windowEls.values()) {
      const segs = this.typeSegs.filter((s) => s.window === w.def.id);
      let full = '';
      let firstStart = Infinity;
      for (const s of segs) {
        firstStart = Math.min(firstStart, s.start);
        const chars = t <= s.start ? 0 : Math.floor(((t - s.start) * 1000) / MS_PER_CHAR);
        full += s.text.slice(0, Math.min(chars, s.text.length));
      }
      const caretOn = t >= firstStart && Math.floor((t - firstStart) / 0.5) % 2 === 0;
      // rebuild text node before caret
      const textNode = w.typed.firstChild && w.typed.firstChild.nodeType === 3 ? w.typed.firstChild : null;
      if (textNode) textNode.textContent = full;
      else w.typed.insertBefore(document.createTextNode(full), w.caret);
      w.caret.style.display = caretOn ? '' : 'none';
    }
  }

  private applyRipple(t: number) {
    for (const a of this.scenario.actions) {
      if (a.type !== 'click' || !a.target) continue;
      const p = (t - a.at) / RIPPLE_DUR;
      if (p < 0 || p > 1) continue;
      const win = this.windowEls.get(a.target.window);
      if (!win) continue;
      const pt = anchorPoint(win.def, a.target.anchor ?? 'body');
      const e = getEasing('easeOutCubic')(p);
      this.ripple.style.display = '';
      this.ripple.style.left = `${pt.x - RIPPLE_SIZE / 2}px`;
      this.ripple.style.top = `${pt.y - RIPPLE_SIZE / 2}px`;
      this.ripple.style.transform = `scale(${0.3 + 0.7 * e})`;
      this.ripple.style.opacity = String(0.5 * (1 - p));
      return;
    }
    this.ripple.style.display = 'none';
  }

  private applyCursor(t: number) {
    let pos: Pt = this.moves.length ? this.moves[0].from : { x: this.scenario.width / 2, y: this.scenario.height * 0.72 };
    for (const m of this.moves) {
      if (t >= m.toT) {
        pos = m.to;
      } else if (t > m.fromT) {
        const p = (t - m.fromT) / Math.max(m.toT - m.fromT, 0.0001);
        const e = getEasing('easeOutCubic')(p);
        pos = { x: lerp(m.from.x, m.to.x, e), y: lerp(m.from.y, m.to.y, e) };
        break;
      } else {
        break;
      }
    }

    let press = 1;
    for (const a of this.scenario.actions) {
      if (a.type !== 'click') continue;
      const p = (t - a.at) / PRESS_DUR;
      if (p >= 0 && p <= 1) {
        press = 0.9;
        break;
      }
    }

    this.cursor.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${press})`;
  }
}
