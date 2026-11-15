// Drives the local game in headless Chrome over CDP (Node 24 stdlib only:
// fetch + WebSocket). Two modes:
//   node tools/drive.mjs shots   — capture the four ?shot= scenes as JPEGs in
//                                  screenshots/, printing each scene's world
//                                  state so the frames can be verified honest
//   node tools/drive.mjs play    — a real interactive session: Enter to start,
//                                  arrow keys and Space to play ~24 s, state
//                                  sampled as it goes, one live screenshot
// The Chrome binary is the puppeteer-cache build (the managed Chromium
// refuses standalone headless use on this VM).
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CHROME = join(homedir(), '.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome');
const PORT = 9333;
const GAME = 'http://127.0.0.1:8901';
const OUT = new URL('../screenshots/', import.meta.url);

if (!existsSync(CHROME)) throw new Error(`chrome not found at ${CHROME}`);

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--window-size=1280,900', '--force-device-scale-factor=1',
  '--mute-audio', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDebugger() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chrome debugger never came up');
}

let nextId = 1;
const pending = new Map();
let ws;
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolvePromise, rejectPromise) => {
    pending.set(id, { resolvePromise, rejectPromise });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function openTab(url) {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const tab = await res.json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolvePromise, rejectPromise } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rejectPromise(new Error(JSON.stringify(msg.error)));
      else resolvePromise(msg.result);
    }
  });
  await send('Page.enable');
  await send('Runtime.enable');
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 600));
  return result.result.value;
}

async function waitFor(expression, timeoutMs = 30000) {
  const start = Date.now();
  for (;;) {
    const value = await evaluate(expression).catch(() => undefined);
    if (value) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${expression}`);
    await sleep(200);
  }
}

async function screenshot(path) {
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 84 });
  writeFileSync(path, Buffer.from(shot.data, 'base64'));
}

async function key(code, type = 'keyDown') {
  const keys = { Enter: 13, Space: 32, ArrowLeft: 37, ArrowRight: 39, KeyA: 65, KeyD: 68 };
  await send('Input.dispatchKeyEvent', {
    type, code, key: code === 'Space' ? ' ' : code, windowsVirtualKeyCode: keys[code] ?? 0,
  });
}

const stateExpr = `(() => { const w = window.__ember && window.__ember.world; if (!w) return null;
  return { screen: w.screen, score: w.score, health: Math.round(w.health), wave: w.wave,
    fed: w.fed, blown: w.blown, alive: w.entities.length, combo: w.combo,
    angle: +w.keeper.angle.toFixed(2) }; })()`;

async function shots() {
  const scenes = [
    ['1-title.jpg', 'title'],
    ['2-play.jpg', 'play'],
    ['3-dawn.jpg', 'dawn'],
    ['4-over.jpg', 'over'],
  ];
  const seed = process.argv[3] ?? '1';
  for (const [file, scene] of scenes) {
    await send('Page.navigate', { url: `${GAME}/?shot=${scene}&seed=${seed}` });
    await waitFor(`document.title.startsWith('EMBERKEEP shot')`);
    await sleep(350);
    const state = await evaluate(stateExpr);
    await screenshot(new URL(file, OUT));
    console.log(file, scene, JSON.stringify(state), 'title:', await evaluate('document.title'));
  }
}

async function play() {
  await send('Page.navigate', { url: `${GAME}/` });
  await waitFor(`!!(window.__ember && window.__ember.world)`);
  console.log('boot:', JSON.stringify(await evaluate(stateExpr)));
  await key('Enter'); await key('Enter', 'keyUp');
  await sleep(600);
  console.log('after Enter:', JSON.stringify(await evaluate(stateExpr)));
  // Play: sweep the keeper back and forth, gusting regularly, for ~24 s.
  const moves = ['ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowLeft'];
  for (let round = 0; round < 8; round += 1) {
    const code = moves[round % moves.length];
    await key(code);
    await sleep(1400);
    await key('Space'); await key('Space', 'keyUp');
    await sleep(700);
    await key(code, 'keyUp');
    console.log(`t+${(round + 1) * 2.1}s:`, JSON.stringify(await evaluate(stateExpr)));
  }
  await screenshot(new URL('../tools/play-live.jpg', import.meta.url));
  console.log('live screenshot saved to tools/play-live.jpg');
}

try {
  await waitForDebugger();
  await openTab('about:blank');
  if (process.argv[2] === 'play') await play();
  else await shots();
} finally {
  try { ws?.close(); } catch { /* already closed */ }
  chrome.kill('SIGKILL');
}
