// Render a scenario to MP4: start a Vite dev server, drive the preview page
// in headless Chrome frame-by-frame (see docs/adr/0001-render-frame-by-frame.md),
// screenshot every frame, encode with ffmpeg-static.
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import ffmpegStatic from 'ffmpeg-static';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

// Random free port (never fixed) so two projects can render concurrently.
const PORT = 5300 + Math.floor(Math.random() * 600);

// Scenario: explicit arg, else first scenarios/*/scenario.json found.
let scenarioPath = process.argv[2];
if (!scenarioPath) {
  const dirs = (await fs.readdir('scenarios', { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const found = [];
  for (const d of dirs) {
    const p = path.join('scenarios', d, 'scenario.json');
    try {
      await fs.access(p);
      found.push(p);
    } catch {
      /* dir without scenario.json */
    }
  }
  if (!found.length) {
    console.error('No scenarios/<name>/scenario.json found — create one first, or pass a path as an argument.');
    process.exit(1);
  }
  scenarioPath = found[0];
  if (found.length > 1) {
    console.log(`Found ${found.length} scenarios; using ${scenarioPath}. Pass one explicitly: npm run render -- scenarios/<name>/scenario.json`);
  }
}
const scenario = JSON.parse(await fs.readFile(scenarioPath, 'utf8'));
const { duration, fps, width, height } = scenario;
const frames = Math.ceil(duration * fps);

const outDir = path.resolve('dist');
const framesDir = path.join(outDir, '.frames');
await fs.mkdir(framesDir, { recursive: true });
for (const f of await fs.readdir(framesDir)) await fs.rm(path.join(framesDir, f));

const server = await createServer({
  server: { port: PORT, strictPort: false },
  logLevel: 'silent',
});
await server.listen();
const actualPort = server.httpServer.address().port;

// Cross-platform browser lookup: STUDIO_BROWSER wins, then the usual install
// locations per OS, then PATH lookup on Linux.
function which(name) {
  try {
    return execFileSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

function browserCandidates() {
  const candidates = [];
  if (process.env.STUDIO_BROWSER) candidates.push(process.env.STUDIO_BROWSER);

  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    for (const root of roots) {
      candidates.push(
        path.join(root, 'Google/Chrome/Application/chrome.exe'),
        path.join(root, 'Microsoft/Edge/Application/msedge.exe'),
        path.join(root, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
        path.join(root, 'Chromium/Application/chrome.exe'),
      );
    }
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    );
    if (process.env.HOME) {
      candidates.push(path.join(process.env.HOME, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
    }
  } else {
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'brave-browser']) {
      const found = which(name);
      if (found) candidates.push(found);
    }
  }
  return candidates;
}

async function launchBrowser() {
  const executablePath = browserCandidates().find((p) => p && existsSync(p));
  if (!executablePath) {
    throw new Error(
      'No Chrome, Edge, Chromium, or Brave found.\n' +
        'Install one, or set STUDIO_BROWSER to the browser executable path.\n' +
        '  Windows: set STUDIO_BROWSER=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe\n' +
        '  macOS/Linux: export STUDIO_BROWSER=/path/to/chrome',
    );
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--disable-lcd-text'],
  });
}

const browser = await launchBrowser();
const started = Date.now();
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${actualPort}/?render=1&scenario=/${scenarioPath.replaceAll('\\', '/')}`, {
    waitUntil: 'networkidle0',
  });
  await page.waitForFunction(() => window.__studio?.ready === true, { timeout: 15000 });

  console.log(`Rendering ${scenario.name}: ${frames} frames @ ${fps}fps ${width}×${height}`);
  for (let i = 0; i < frames; i++) {
    const t = i / fps;
    await page.evaluate((tt) => window.__studio.seek(tt), t);
    await page.screenshot({
      path: path.join(framesDir, `${String(i + 1).padStart(5, '0')}.png`),
      captureBeyondViewport: false,
    });
    if ((i + 1) % 60 === 0 || i === frames - 1) {
      const pct = (((i + 1) / frames) * 100).toFixed(0);
      const secs = ((Date.now() - started) / 1000).toFixed(0);
      console.log(`  frame ${i + 1}/${frames} (${pct}%) — ${secs}s`);
    }
  }

  const outName = `${scenario.name}.mp4`;
  const outPath = path.join(outDir, outName);
  console.log('Encoding', outPath);
  await new Promise((resolve, reject) => {
    const ff = spawn(
      ffmpegStatic,
      [
        '-y',
        '-framerate', String(fps),
        '-i', path.join(framesDir, '%05d.png'),
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outPath,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let err = '';
    ff.stderr.on('data', (d) => (err += d));
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${err.slice(-2000)}`))));
  });

  await fs.rm(framesDir, { recursive: true, force: true });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Done: ${outPath} (${secs}s)`);
} finally {
  await browser.close();
  await server.close();
}
