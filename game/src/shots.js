// The screenshot scenes behind ?shot=title|play|dawn|over. Each one plays the
// real rules forward from a fresh, seeded world, steered by an autopilot
// keeper, so the frame is what a real game looks like and the same seed
// always gives the same frame. The play pilot guards the flame the way a
// careful player does. The dawn scene runs that pilot to the end of the
// night and shows the win it earns; the "over" scene runs a hurried pilot —
// it chases embers and never guards — and shows the loss it earns. Both end
// scenes search a short list of seeds for a night that genuinely ends the
// way the scene is named; a scene never fakes its ending.

import { HEARTH, KEEPER, STEP } from './config.js';
import {
  KIND_EMBER, KIND_FIEND, KIND_GILDED, KIND_MITE, KIND_SOOT,
  SCREEN_LOST, SCREEN_PLAY, SCREEN_WON, makeWorld, startNight, stepWorld,
} from './world.js';

const TITLE_STEPS = 150; // 2.5 s of idle title: the flame breathes on its screen
const PLAY_SECONDS = 64; // well into wave 3: splitters about, combo up, field busy
const END_LIMIT_SECONDS = 200; // longer than a night, so a scene can always settle
const SEED_TRIES = [0, 11, 23, 37, 41, 53, 67, 71, 83, 97];

/** The angle an entity bears from the hearth, and its distance. */
function bearing(e) {
  const dx = e.x - HEARTH.x;
  const dy = e.y - HEARTH.y;
  return { angle: Math.atan2(dy, dx), dist: Math.hypot(dx, dy) };
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const isThreat = (e) => e.kind === KIND_FIEND || e.kind === KIND_MITE || e.kind === KIND_SOOT;
const isFood = (e) => e.kind === KIND_EMBER || e.kind === KIND_GILDED;

/**
 * The careful pilot: it guards the bearing of the closest threat, gusts when
 * a threat is close and roughly ahead, and otherwise keeps the way clear for
 * the nearest ember. It plays well but not perfectly — the flame still takes
 * the odd knock, and its score is a real game's score.
 */
function carefulControl(world) {
  let threatInfo = null;
  let foodInfo = null;
  for (const e of world.entities) {
    const info = bearing(e);
    if (isThreat(e) && (threatInfo === null || info.dist < threatInfo.dist)) threatInfo = info;
    if (isFood(e) && (foodInfo === null || info.dist < foodInfo.dist)) foodInfo = info;
  }
  const target = threatInfo !== null && threatInfo.dist < 330 ? threatInfo.angle
    : foodInfo !== null ? foodInfo.angle
      : -Math.PI / 2;
  const aligned = threatInfo !== null && Math.abs(angleDiff(threatInfo.angle, world.keeper.angle)) < 0.3;
  return {
    turn: 0,
    mouseAngle: target,
    gust: aligned && threatInfo.dist < KEEPER.gustRange - 30 && world.keeper.gustTimer <= 0,
  };
}

/** The hurried pilot: chases the nearest ember, never guards a bearing, never gusts. */
function hurriedControl(world) {
  let foodInfo = null;
  for (const e of world.entities) {
    if (!isFood(e)) continue;
    const info = bearing(e);
    if (foodInfo === null || info.dist < foodInfo.dist) foodInfo = info;
  }
  return { turn: 0, mouseAngle: foodInfo !== null ? foodInfo.angle : Math.PI / 2, gust: false };
}

/** Play one seeded night under a pilot until it ends or the limit passes. */
function runScene(seed, pilot, limitSeconds) {
  const world = makeWorld(seed);
  startNight(world);
  world.next = makeWorld(seed).next; // startNight reseeds for live play; scenes stay seeded
  const steps = Math.floor(limitSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, pilot(world));
    if (world.screen !== SCREEN_PLAY) break;
  }
  return world;
}

/** The first seeded night, from the try list, that ends on the wanted screen. */
function endedScene(seed, pilot, wanted) {
  for (const add of SEED_TRIES) {
    const world = runScene(seed + add, pilot, END_LIMIT_SECONDS);
    if (world.screen === wanted) return world;
  }
  return runScene(seed, pilot, END_LIMIT_SECONDS);
}

/** Build the world a ?shot= scene shows. Unknown names fall back to the title. */
export function shotWorld(name, seed) {
  if (name === 'play') {
    const world = makeWorld(seed);
    startNight(world);
    world.next = makeWorld(seed).next;
    const steps = Math.floor(PLAY_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) stepWorld(world, carefulControl(world));
    return world;
  }
  if (name === 'dawn') {
    const world = endedScene(seed, carefulControl, SCREEN_WON);
    world.dawnGlow = 1; // the win screen, fully dawned
    return world;
  }
  if (name === 'over') return endedScene(seed, hurriedControl, SCREEN_LOST);
  const world = makeWorld(seed);
  for (let i = 0; i < TITLE_STEPS; i += 1) stepWorld(world, { turn: 0, mouseAngle: null, gust: false });
  return world;
}
