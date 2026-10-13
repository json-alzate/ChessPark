#!/usr/bin/env node
/**
 * Comprueba en una página real que el ELO de los puzzles SUBE de forma gradual y no se estanca.
 *
 * Abre la página, anota el ELO y el tema de cada puzzle y falla si:
 *  - un puzzle tiene el mismo ELO o menos que el anterior (salvo cuando la escalera se reinicia),
 *  - hay un salto mayor que --max-jump.
 *
 * Los tiempos se aceleran para no esperar horas; con `startElo` se coloca la escalera en un
 * ELO difícil (los temas tienen pocos puzzles en los extremos), y con `--wrap` se atraviesa el
 * tope para ver el reinicio.
 *
 *   node tools/stream-runner/check-ladder.mjs --url=http://localhost:4302/ --start-elo=1900 --seconds=90
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.slice(2).split('=');
    return [k, v.length ? v.join('=') : 'true'];
  })
);

const base = args.url ?? 'http://localhost:4302/';
const seconds = Number(args.seconds ?? 90);
const startElo = Number(args['start-elo'] ?? 1900);
// Un puzzle dura ~2,4 s aquí frente a ~35 s reales: la escalera se acelera igual (2 h * 2,4/35).
const ladder = Number(args.ladder ?? 494000);
const maxJump = Number(args['max-jump'] ?? 40);
const chrome = args.chrome ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = args.profile ?? '/tmp/stream-check-profile';

const query = `ladder=${ladder}&startElo=${startElo}&block=25000&countdown=1&present=300&opponent=300&move=300&close=300&renderer=none`;

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--hide-scrollbars'],
  defaultViewport: { width: 1920, height: 1080 },
  userDataDir: profile,
});
const page = await browser.newPage();
await page.goto(`${base}?${query}`, { waitUntil: 'domcontentloaded' });

const seen = [];
let last = '';
const t0 = Date.now();
while (Date.now() - t0 < seconds * 1000) {
  const s = await page.evaluate(() => {
    const values = [...document.querySelectorAll('ls-hud-panel .value')].map((e) => e.textContent.trim());
    return { tema: values[0], elo: Number(values[1]), fase: document.querySelector('ls-hud-panel .now .label')?.textContent.trim() };
  });
  const key = `${s.tema}|${s.elo}`;
  if (s.fase === 'Look closely' && key !== last && Number.isFinite(s.elo)) {
    seen.push(s);
    last = key;
  }
  await new Promise((r) => setTimeout(r, 100));
}
await browser.close();

const problems = [];
const steps = [];
seen.forEach((s, i) => {
  if (i === 0) return;
  const step = s.elo - seen[i - 1].elo;
  steps.push(step);
  const wrapped = step < -300;
  if (!wrapped && step <= 0) problems.push(`ESTANCADO/BAJA: ${seen[i - 1].tema} ${seen[i - 1].elo} -> ${s.tema} ${s.elo} (${step})`);
  if (!wrapped && step > maxJump) problems.push(`SALTO: ${seen[i - 1].tema} ${seen[i - 1].elo} -> ${s.tema} ${s.elo} (+${step})`);
});

console.log(seen.map((s) => `${s.tema.padEnd(20)} ${s.elo}`).join('\n'));
console.log(`\npuzzles: ${seen.length} | cambios de ELO: ${steps.join(', ')}`);
console.log(problems.length ? `\nFALLA:\n  ${problems.join('\n  ')}` : '\nOK: el ELO sube en cada puzzle, sin estancarse ni dar saltos.');
process.exit(problems.length || seen.length < 5 ? 1 : 0);
