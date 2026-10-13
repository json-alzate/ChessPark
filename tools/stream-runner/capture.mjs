#!/usr/bin/env node
/**
 * Prueba de captura del directo: abre la página en Chrome headless, toma los frames con
 * `Page.startScreencast`, los codifica con ffmpeg (h264_videotoolbox) y mide el consumo.
 *
 * Es la semilla del runner (ver docs/features/TRANSMISION_24_7.md, Fase 0/3). Hoy sirve para
 * comparar variantes de la escena: escribe un MP4, o empuja a un RTMP si se pasa `--rtmp`.
 *
 *   node tools/stream-runner/capture.mjs --url=http://localhost:4312/?renderer=css \
 *     --seconds=60 --out=/tmp/prueba.mp4 --label=css
 */
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.length ? v.join('=') : 'true'];
    })
);

const cfg = {
  url: args.url ?? 'http://localhost:4312/',
  seconds: Number(args.seconds ?? 60),
  warmup: Number(args.warmup ?? 8),
  fps: Number(args.fps ?? 30),
  width: Number(args.width ?? 1920),
  height: Number(args.height ?? 1080),
  bitrate: args.bitrate ?? '3M',
  quality: Number(args.quality ?? 80),
  // Chrome entrega 60 fps; con 30 fps de salida basta un frame de cada dos.
  nth: Number(args.nth ?? 2),
  chrome: args.chrome ?? process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  out: args.out ?? '/tmp/stream-capture.mp4',
  rtmp: args.rtmp,
  label: args.label ?? 'captura',
  report: args.report,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** "1:02:03.45" | "2:03.45" | "3.45" -> segundos */
function parseCpuTime(s) {
  return s.split(':').reduce((acc, part) => acc * 60 + parseFloat(part), 0);
}

/** CPU (segundos acumulados) y memoria (KB) de un árbol de procesos. */
function treeUsage(rootPid) {
  const out = execFileSync('ps', ['-axo', 'pid=,ppid=,cputime=,rss=,comm='], { encoding: 'utf8' });
  const procs = out
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map(([, pid, ppid, cpu, rss]) => ({ pid: +pid, ppid: +ppid, cpu: parseCpuTime(cpu), rss: +rss }));
  const inTree = new Set([rootPid]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of procs) {
      if (!inTree.has(p.pid) && inTree.has(p.ppid)) {
        inTree.add(p.pid);
        grew = true;
      }
    }
  }
  const mine = procs.filter((p) => inTree.has(p.pid));
  return { cpu: mine.reduce((a, p) => a + p.cpu, 0), rssKb: mine.reduce((a, p) => a + p.rss, 0), n: mine.length };
}

async function main() {
  const outputArgs = cfg.rtmp ? ['-f', 'flv', cfg.rtmp] : [cfg.out];
  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-hide_banner', '-y',
      '-use_wallclock_as_timestamps', '1',
      '-f', 'image2pipe', '-c:v', 'mjpeg', '-i', 'pipe:0',
      '-vf', `fps=${cfg.fps}`,
      '-c:v', 'h264_videotoolbox', '-b:v', cfg.bitrate, '-g', String(cfg.fps * 2), '-pix_fmt', 'yuv420p',
      '-an',
      ...outputArgs,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] }
  );
  let ffLast = '';
  ffmpeg.stderr.on('data', (d) => {
    const m = d.toString().split(/\r|\n/).filter((l) => l.includes('frame='));
    if (m.length) ffLast = m[m.length - 1];
  });
  const ffExit = new Promise((resolve) => ffmpeg.on('close', resolve));
  ffmpeg.stdin.on('error', () => {});

  const browser = await puppeteer.launch({
    executablePath: cfg.chrome,
    headless: 'new',
    args: ['--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    defaultViewport: { width: cfg.width, height: cfg.height, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`console.error: ${m.text()}`));

  const client = await page.createCDPSession();
  let frames = 0;
  client.on('Page.screencastFrame', ({ data, sessionId }) => {
    frames++;
    ffmpeg.stdin.write(Buffer.from(data, 'base64'));
    client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });

  await page.goto(cfg.url, { waitUntil: 'networkidle0' });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: cfg.quality, everyNthFrame: cfg.nth, maxWidth: cfg.width, maxHeight: cfg.height });

  const chromePid = browser.process().pid;
  await sleep(cfg.warmup * 1000);

  // Ventana de medida: desde que pasó el calentamiento.
  const t0 = Date.now();
  const f0 = frames;
  const c0 = { chrome: treeUsage(chromePid), ff: treeUsage(ffmpeg.pid), node: process.cpuUsage() };
  let maxRss = 0;
  while (Date.now() - t0 < cfg.seconds * 1000) {
    await sleep(2000);
    maxRss = Math.max(maxRss, treeUsage(chromePid).rssKb + treeUsage(ffmpeg.pid).rssKb);
  }
  const wall = (Date.now() - t0) / 1000;
  const c1 = { chrome: treeUsage(chromePid), ff: treeUsage(ffmpeg.pid), node: process.cpuUsage() };
  const f1 = frames;
  const gpuInfo = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl && ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'sin WebGL';
  });

  await client.send('Page.stopScreencast').catch(() => {});
  ffmpeg.stdin.end();
  await ffExit;
  await browser.close();

  const nodeCpu = (c1.node.user + c1.node.system - c0.node.user - c0.node.system) / 1e6;
  const chromeCores = (c1.chrome.cpu - c0.chrome.cpu) / wall;
  const ffCores = (c1.ff.cpu - c0.ff.cpu) / wall;
  const nodeCores = nodeCpu / wall;

  let output = {};
  if (!cfg.rtmp) {
    try {
      const probe = JSON.parse(
        execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,duration', '-of', 'json', cfg.out], { encoding: 'utf8' })
      );
      output = { frames: Number(probe.streams[0].nb_read_frames), duration: Number(probe.streams[0].duration) };
    } catch (e) {
      output = { error: String(e.message).slice(0, 120) };
    }
  }

  const report = {
    label: cfg.label,
    url: cfg.url,
    resolution: `${cfg.width}x${cfg.height}@${cfg.fps}`,
    medidoDuranteS: Math.round(wall),
    screencastFps: Number(((f1 - f0) / wall).toFixed(1)),
    ffmpegUltimaLinea: ffLast.replace(/\s+/g, ' ').trim(),
    salida: output,
    nucleosCpu: {
      chrome: Number(chromeCores.toFixed(2)),
      ffmpeg: Number(ffCores.toFixed(2)),
      runnerNode: Number(nodeCores.toFixed(2)),
      total: Number((chromeCores + ffCores + nodeCores).toFixed(2)),
    },
    memoriaMB: { chromeMasFfmpegMax: Math.round(maxRss / 1024) },
    webgl: gpuInfo,
    problemas: problems,
  };
  console.log(JSON.stringify(report, null, 2));
  if (cfg.report) writeFileSync(cfg.report, JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error('FALLO', e);
  process.exit(1);
});
