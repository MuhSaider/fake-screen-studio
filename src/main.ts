import './style.css';
import { Engine } from './engine/engine';
import { parseScenario } from './scenario/validate';
import type { Scenario } from './scenario/types';

declare global {
  interface Window {
    __studio?: { ready: boolean; seek: (t: number) => void };
  }
}

const params = new URLSearchParams(location.search);
const renderMode = params.get('render') === '1';
// Default scenario: first scenarios/*/scenario.json known at build time (order: alphabetical).
const knownScenarios = Object.keys(import.meta.glob('/scenarios/*/scenario.json')).sort();
const scenarioParam = params.get('scenario') ?? knownScenarios[0] ?? '/scenarios/hello/scenario.json';
const scenarioUrl = scenarioParam.startsWith('/') ? scenarioParam : `/${scenarioParam}`;

const stage = document.getElementById('stage') as HTMLDivElement;
const errorBox = document.getElementById('errors') as HTMLPreElement;
const controls = document.getElementById('controls') as HTMLDivElement;
const playBtn = document.getElementById('play') as HTMLButtonElement;
const slider = document.getElementById('scrub') as HTMLInputElement;
const timeLabel = document.getElementById('time') as HTMLSpanElement;
const nameLabel = document.getElementById('name') as HTMLSpanElement;

let engine: Engine | null = null;
let scenario: Scenario | null = null;
let currentText = '';
let time = 0;
let playing = true;

function showError(errors: string[]) {
  errorBox.textContent = errors.join('\n');
  errorBox.style.display = errors.length ? 'block' : 'none';
}

function fit() {
  if (renderMode || !scenario) return;
  const s = Math.min(innerWidth / scenario.width, innerHeight / scenario.height);
  const x = (innerWidth - scenario.width * s) / 2;
  const y = (innerHeight - scenario.height * s) / 2;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
}

function mount(text: string) {
  const { scenario: s, errors } = parseScenario(text);
  if (!s) {
    showError(errors);
    return;
  }
  showError([]);
  scenario = s;
  engine = new Engine(stage, s);
  stage.style.width = `${s.width}px`;
  stage.style.height = `${s.height}px`;
  time = Math.min(time, s.duration);
  nameLabel.textContent = `${s.name} — ${s.fps}fps ${s.width}×${s.height}`;
  slider.max = String(s.duration);
  engine.seek(time);
  fit();
}

async function fetchScenario(): Promise<string> {
  const res = await fetch(scenarioUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Gagal memuat ${scenarioUrl}: HTTP ${res.status}`);
  return res.text();
}

function fmt(t: number) {
  return `${t.toFixed(2)}s`;
}

function loop(now: number) {
  const dt = Math.min((now - (loop as unknown as { last?: number }).last!) / 1000 || 0, 0.1);
  (loop as unknown as { last?: number }).last = now;
  if (playing && scenario) {
    time += dt;
    if (time >= scenario.duration) time = 0;
  }
  engine?.seek(time);
  if (document.activeElement !== slider) slider.value = String(time);
  timeLabel.textContent = `${fmt(time)} / ${fmt(scenario?.duration ?? 0)}`;
  requestAnimationFrame(loop);
}

async function main() {
  try {
    currentText = await fetchScenario();
    mount(currentText);
  } catch (e) {
    showError([(e as Error).message]);
  }

  if (renderMode) {
    controls.style.display = 'none';
    stage.style.transform = 'none';
    window.__studio = { ready: true, seek: (t) => engine?.seek(t) };
    return;
  }

  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? '⏸' : '▶';
  });
  slider.addEventListener('input', () => {
    time = Number(slider.value);
    engine?.seek(time);
  });
  addEventListener('resize', fit);

  // Live reload: poll the scenario file so agent edits show up without touching the browser.
  setInterval(async () => {
    try {
      const txt = await fetchScenario();
      if (txt !== currentText) {
        currentText = txt;
        mount(txt);
      }
    } catch {
      /* keep previewing the last good scenario while the file is mid-write */
    }
  }, 700);

  requestAnimationFrame(loop);
}

main();
