// EMBERKEEP's entry point: boot the world, run it at a fixed step whatever
// the display's rate, paint every frame, and turn the world's events into
// sound. With ?shot=<scene>&seed=<n> in the URL it instead builds that
// screenshot scene and holds it still — the scenes in shots.js are how the
// entry's screenshots are taken, of the real game, in a browser.

import { FIELD, HEARTH, STEP } from './config.js';
import { makeInput } from './input.js';
import { draw } from './render.js';
import { shotWorld } from './shots.js';
import {
  EVENT_BLOWN, EVENT_FEED, EVENT_GILDED, EVENT_GUST, EVENT_HIT, EVENT_SPLIT, EVENT_WAVE,
  SCREEN_LOST, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON,
  makeWorld, startNight, stepWorld,
} from './world.js';
import { sfx, toggleMute, unlockAudio } from './audio.js';
import { BEST_KEY } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

// The canvas is a fixed 1280x720 logical field (its width/height attributes in
// index.html); CSS stretches it to the window and the input maps pointer
// positions back into field coordinates, so the game plays the same at any
// window size.
void FIELD;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? 1) >>> 0;

if (shotName !== null) {
  // A screenshot scene: build it, paint it once, and hold it for the camera.
  const world = shotWorld(shotName, seed);
  world.best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  draw(ctx, world);
  document.title = `EMBERKEEP shot ${shotName} — screen ${world.screen}, score ${world.score}`;
  window.__ember = { world, shot: shotName };
} else {
  const world = makeWorld((Math.random() * 0xffffffff) >>> 0);
  world.best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  const input = makeInput(canvas, HEARTH);
  window.__ember = { world };

  let lastScreen = world.screen;
  function announce() {
    if (world.screen === lastScreen) return;
    lastScreen = world.screen;
    if (world.screen === SCREEN_WON) status.textContent = `Dawn breaks. Final score ${world.score}.`;
    if (world.screen === SCREEN_LOST) status.textContent = `The flame is out. Final score ${world.score}.`;
    if (world.screen === SCREEN_PLAY) status.textContent = 'The night begins.';
  }

  function playEvents() {
    for (const event of world.events) {
      if (event === EVENT_FEED) sfx.feed(world.combo);
      else if (event === EVENT_GILDED) sfx.gilded();
      else if (event === EVENT_HIT) sfx.fiendHit();
      else if (event === EVENT_BLOWN) sfx.blown();
      else if (event === EVENT_SPLIT) sfx.split();
      else if (event === EVENT_WAVE) sfx.wave();
      else if (event === EVENT_GUST) sfx.gust();
    }
    if (world.screen === SCREEN_WON && lastScreen !== SCREEN_WON) sfx.dawn();
    if (world.screen === SCREEN_LOST && lastScreen !== SCREEN_LOST) sfx.over();
  }

  let accumulator = 0;
  let lastTime = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - lastTime) / 1000;
    lastTime = now;
    if (elapsed > 0.25) elapsed = 0.25; // a stalled tab never fast-forwards the night
    accumulator += elapsed;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      input.consume();
      if (input.mutePressed) toggleMute();
      if (input.pausePressed && world.screen === SCREEN_PLAY) world.paused = !world.paused;
      if (input.startPressed) {
        unlockAudio();
        if (world.screen === SCREEN_TITLE || world.screen === SCREEN_WON || world.screen === SCREEN_LOST) {
          startNight(world);
        }
      }
      const control = {
        turn: input.turn,
        mouseAngle: input.mouseFresh || input.turn === 0 ? input.mouseAngle : null,
        gust: input.gustPressed && world.screen === SCREEN_PLAY,
      };
      const before = world.screen;
      stepWorld(world, control);
      playEvents();
      if (before === SCREEN_PLAY && world.screen !== SCREEN_PLAY) {
        localStorage.setItem(BEST_KEY, String(world.best));
      }
      announce();
    }
    draw(ctx, world);
  }
  requestAnimationFrame(frame);
}
