// EMBERKEEP's simulation: the night, the hearth, the keeper, and everything
// that drifts in from the dark. Pure state and rules — no drawing, no DOM —
// stepped at a fixed rate by main.js, and by the screenshot scenes with an
// autopilot at the keeper's place. All randomness comes from the seeded
// generator the world is made with, so a seed replays the same night.

import {
  BLAZE, COMBO, EMBER, FIELD, FIEND, HEARTH, KEEPER, NIGHT, SPAWN, STEP,
} from './config.js';
import { makeRandom, range } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WON = 'won';
export const SCREEN_LOST = 'lost';

export const KIND_EMBER = 'ember';
export const KIND_GILDED = 'gilded';
export const KIND_FIEND = 'fiend';
export const KIND_MITE = 'mite';
export const KIND_SOOT = 'soot';

export const EVENT_FEED = 'feed';
export const EVENT_GILDED = 'gilded';
export const EVENT_HIT = 'hit';
export const EVENT_BLOWN = 'blown';
export const EVENT_SPLIT = 'split';
export const EVENT_WAVE = 'wave';
export const EVENT_GUST = 'gust';
export const EVENT_BLAZE = 'blaze';

/** A fresh night, on the title screen, waiting for the keeper to begin. */
export function makeWorld(seed) {
  return {
    screen: SCREEN_TITLE,
    paused: false,
    next: makeRandom(seed),
    time: 0, // seconds of this night played
    wave: 1,
    score: 0,
    best: 0,
    fed: 0, // embers fed to the flame
    blown: 0, // fiends blown off the field
    health: HEARTH.startHealth,
    combo: 1,
    comboTimer: 0,
    blaze: 0, // seconds of blaze left; 0 = the flame is calm
    keeper: { angle: -Math.PI / 2, gustTimer: 0, gustFlash: 0 },
    entities: [],
    particles: [],
    popups: [], // floating score notes (+50, -9, BLAZE!) the renderer lifts and fades
    titleTimer: 0, // the title screen's slow spawn clock for its drifting visitors
    spawnTimer: SPAWN.firstDelay,
    shake: 0,
    flash: 0, // a warm pulse when an ember lands, a red one when a fiend does
    events: [], // what happened this step, for sound and feel; main.js drains it
    dawnGlow: 0, // 0 in the dark, rising to 1 across the win screen
  };
}

export function startNight(world) {
  const best = world.best;
  const fresh = makeWorld(0);
  Object.assign(world, fresh, { best, screen: SCREEN_PLAY });
  world.next = makeRandom((Math.random() * 0xffffffff) >>> 0);
}

/** The wave a given second of the night belongs to (1-based, capped). */
export function waveAt(time) {
  return Math.min(NIGHT.waves, 1 + Math.floor(time / NIGHT.waveSeconds));
}

/** Seconds left until dawn. */
export function nightLeft(world) {
  return Math.max(0, NIGHT.waves * NIGHT.waveSeconds - world.time);
}

function spawnEntity(world) {
  const next = world.next;
  const wave = world.wave;
  const fiendShare = Math.min(0.62, SPAWN.fiendShare + SPAWN.fiendSharePerWave * (wave - 1));
  const fiendsAlive = world.entities.filter((e) => e.alive && e.kind !== KIND_EMBER && e.kind !== KIND_GILDED).length;
  const roll = next();
  let kind = KIND_EMBER;
  if (roll < fiendShare && fiendsAlive < SPAWN.maxFiends) {
    kind = KIND_FIEND;
    if (wave >= FIEND.sootFromWave && next() < FIEND.sootChance) kind = KIND_SOOT;
  } else if (next() < EMBER.gildedChance) {
    kind = KIND_GILDED;
  }
  // Spawn on the field's edge, aimed at the hearth with a little spread.
  const side = Math.floor(next() * 4);
  const along = next();
  let x = 0;
  let y = 0;
  if (side === 0) { x = along * FIELD.width; y = -30; }
  if (side === 1) { x = along * FIELD.width; y = FIELD.height + 30; }
  if (side === 2) { x = -30; y = along * FIELD.height; }
  if (side === 3) { x = FIELD.width + 30; y = along * FIELD.height; }
  const toHearth = Math.atan2(HEARTH.y - y, HEARTH.x - x) + range(next, -0.22, 0.22);
  const isFiend = kind === KIND_FIEND || kind === KIND_SOOT;
  const speed = isFiend
    ? FIEND.speed + FIEND.speedPerWave * (wave - 1)
    : EMBER.speed + EMBER.speedPerWave * (wave - 1);
  world.entities.push({
    kind,
    x,
    y,
    vx: Math.cos(toHearth) * speed,
    vy: Math.sin(toHearth) * speed,
    radius: kind === KIND_SOOT ? FIEND.sootRadius : kind === KIND_EMBER || kind === KIND_GILDED ? EMBER.radius : FIEND.radius,
    wanderPhase: next() * Math.PI * 2,
    gusted: 0, // how many gusts this fiend has taken
    alive: true,
  });
}

function burst(world, x, y, count, colour, speed) {
  for (let i = 0; i < count; i += 1) {
    const angle = world.next() * Math.PI * 2;
    const v = speed * (0.35 + world.next() * 0.85);
    world.particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - 26,
      life: 0.45 + world.next() * 0.5,
      maxLife: 0.95,
      size: 1.6 + world.next() * 2.6,
      colour,
    });
  }
}

/** A floating score note at a point: the renderer lifts it and fades it out. */
export function spawnPopup(world, x, y, text, colour) {
  world.popups.push({ x, y, text, colour, life: 0.95, maxLife: 0.95 });
}

/** How far a gust reaches right now: a blazing flame blows wider. */
export function gustRangeNow(world) {
  return KEEPER.gustRange * (world.blaze > 0 ? BLAZE.gustRangeMult : 1);
}

/** The keeper puffs: everything in the cone ahead is pushed away from the hearth. */
function gust(world) {
  const keeper = world.keeper;
  keeper.gustTimer = KEEPER.gustCooldown;
  keeper.gustFlash = 0.22;
  world.events.push(EVENT_GUST);
  const range = gustRangeNow(world);
  const powerMult = world.blaze > 0 ? BLAZE.gustPowerMult : 1;
  for (const e of world.entities) {
    if (!e.alive) continue;
    const dx = e.x - HEARTH.x;
    const dy = e.y - HEARTH.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range || dist < 1) continue;
    let diff = Math.atan2(dy, dx) - keeper.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > KEEPER.gustHalfAngle) continue;
    const falloff = 1 - dist / (range * 1.25);
    const isGood = e.kind === KIND_EMBER || e.kind === KIND_GILDED;
    const power = (isGood ? KEEPER.gustPowerOnEmber : KEEPER.gustPower * powerMult) * falloff;
    e.vx += (dx / dist) * power;
    e.vy += (dy / dist) * power;
    if (!isGood) {
      e.gusted += 1;
      // A gusted fiend tumbles: for a moment it cannot home in, so a gust
      // truly moves it and a second gust can finish blowing it off the field.
      e.blownTimer = 0.9;
      // Three gusts (two for a mite, four for a soot cloud) tear a fiend
      // apart: the bellows are a defence that can also finish a threat.
      const gustsToBurst = e.kind === KIND_MITE ? 2 : e.kind === KIND_SOOT ? 4 : 3;
      if (e.gusted >= gustsToBurst) {
        e.alive = false;
        world.score += FIEND.gustPoints;
        world.blown += 1;
        burst(world, e.x, e.y, 10, '#8f88b8', 120);
        spawnPopup(world, e.x, e.y - 14, `+${FIEND.gustPoints}`, '#b9b3e0');
        world.events.push(EVENT_BLOWN);
        continue;
      }
      if ((e.kind === KIND_FIEND) && world.wave >= FIEND.splitterFromWave
        && e.gusted === 1 && world.next() < FIEND.splitterChance) {
        e.alive = false;
        world.events.push(EVENT_SPLIT);
        for (let i = 0; i < 2; i += 1) {
          const spread = i === 0 ? -0.5 : 0.5;
          const back = Math.atan2(-dy, -dx) + spread;
          world.entities.push({
            kind: KIND_MITE, x: e.x, y: e.y,
            vx: Math.cos(back) * 60 + e.vx * 0.3, vy: Math.sin(back) * 60 + e.vy * 0.3,
            radius: 9, wanderPhase: world.next() * Math.PI * 2, gusted: 1, alive: true,
          });
        }
      }
    }
  }
}

function feedEmber(world, e) {
  const gilded = e.kind === KIND_GILDED;
  world.combo = Math.min(COMBO.max, world.combo + (world.comboTimer > 0 ? 1 : 0));
  if (world.comboTimer <= 0) world.combo = 1;
  world.comboTimer = COMBO.window;
  // A full combo catches the flame: the blaze starts on the feed that fills
  // it, and while it burns every feed is worth double.
  if (world.combo >= COMBO.max && world.blaze <= 0) {
    world.blaze = BLAZE.duration;
    world.events.push(EVENT_BLAZE);
    spawnPopup(world, HEARTH.x, HEARTH.y - 96, 'BLAZE!', '#ffb340');
    burst(world, HEARTH.x, HEARTH.y - 20, 26, '#ffb340', 190);
  }
  const points = (gilded ? EMBER.gildedPoints : EMBER.points) * world.combo
    * (world.blaze > 0 ? BLAZE.pointsMult : 1);
  world.score += points;
  world.fed += 1;
  world.health = Math.min(HEARTH.maxHealth, world.health + (gilded ? EMBER.gildedFuel : EMBER.fuel));
  world.flash = 0.35;
  burst(world, HEARTH.x, HEARTH.y - 20, gilded ? 16 : 9, gilded ? '#ffe98a' : '#ffc95e', 130);
  spawnPopup(world, HEARTH.x, HEARTH.y - 64, `+${points}`, gilded ? '#ffe98a' : '#ffc95e');
  world.events.push(gilded ? EVENT_GILDED : EVENT_FEED);
}

function fiendHits(world, e) {
  const damage = e.kind === KIND_SOOT ? FIEND.sootDamage : FIEND.damage;
  world.health -= damage;
  world.combo = 1;
  world.comboTimer = 0;
  world.blaze = 0; // a fiend through the guard douses the blaze as well
  world.shake = 0.35;
  world.flash = -0.4;
  burst(world, HEARTH.x, HEARTH.y, 14, '#ff5d47', 160);
  spawnPopup(world, HEARTH.x, HEARTH.y - 64, `-${damage}`, '#ff5d47');
  world.events.push(EVENT_HIT);
}

/**
 * The title screen's quiet life: embers and fiends drift at the hearth at
 * half pace and the keeper circles it slowly, so the cover shows the game
 * itself waiting — a living field, not an empty one. Nothing scores here;
 * what reaches the fire just sparks and is gone.
 */
function driftTitle(world) {
  world.time += STEP;
  world.keeper.angle += STEP * 0.3;
  world.titleTimer -= STEP;
  if (world.titleTimer <= 0 && world.entities.length < 8) {
    spawnEntity(world);
    world.titleTimer = 0.9;
  }
  for (const e of world.entities) {
    if (!e.alive) continue;
    const dx = HEARTH.x - e.x;
    const dy = HEARTH.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = (e.kind === KIND_EMBER || e.kind === KIND_GILDED ? EMBER.speed : FIEND.speed) * 0.5;
    const wander = Math.sin(world.time * 1.7 + e.wanderPhase) * 14;
    e.vx += (((dx / dist) * speed + (-dy / dist) * wander) - e.vx) * Math.min(1, 2.2 * STEP);
    e.vy += (((dy / dist) * speed + (dx / dist) * wander) - e.vy) * Math.min(1, 2.2 * STEP);
    e.x += e.vx * STEP;
    e.y += e.vy * STEP;
    if (dist < HEARTH.radius + e.radius) {
      e.alive = false;
      burst(world, HEARTH.x, HEARTH.y - 16, 5, '#ffc95e', 90);
    }
  }
  world.entities = world.entities.filter((e) => e.alive);
}

/**
 * Advance the world one fixed step. `control` is {turn, mouseAngle, gust}:
 * main.js fills it from the input, the screenshot scenes from an autopilot.
 */
export function stepWorld(world, control) {
  world.events.length = 0;
  const keeper = world.keeper;

  if (world.screen === SCREEN_WON) world.dawnGlow = Math.min(1, world.dawnGlow + STEP / 2.5);
  // Particles and the flame's mood move on every screen.
  for (const p of world.particles) {
    p.x += p.vx * STEP;
    p.y += p.vy * STEP;
    p.vy += 60 * STEP;
    p.life -= STEP;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
  world.shake = Math.max(0, world.shake - STEP);
  world.flash = Math.abs(world.flash) <= STEP ? 0 : world.flash - Math.sign(world.flash) * STEP;
  keeper.gustFlash = Math.max(0, keeper.gustFlash - STEP);
  world.blaze = Math.max(0, world.blaze - STEP);
  for (const p of world.popups) {
    p.y -= 34 * STEP;
    p.life -= STEP;
  }
  world.popups = world.popups.filter((p) => p.life > 0);
  if (world.screen === SCREEN_TITLE) driftTitle(world);
  if (world.screen !== SCREEN_PLAY || world.paused) return;

  world.time += STEP;
  const newWave = waveAt(world.time);
  if (newWave !== world.wave) {
    world.wave = newWave;
    world.events.push(EVENT_WAVE);
  }
  if (world.time >= NIGHT.waves * NIGHT.waveSeconds) {
    world.screen = SCREEN_WON;
    world.score += Math.round(world.health) * 5; // the dawn bonus: what flame is left
    world.best = Math.max(world.best, world.score);
    world.blaze = 0;
    // Dawn scatters the night: every fiend left on the field burns away to
    // ash and the last embers lift off, so the win screen is a clear sky.
    for (const e of world.entities) {
      burst(world, e.x, e.y, 7, e.kind === KIND_EMBER || e.kind === KIND_GILDED ? '#ffc95e' : '#8f88b8', 110);
    }
    world.entities = [];
    return;
  }
  if (world.health <= 0) {
    world.health = 0;
    world.screen = SCREEN_LOST;
    world.best = Math.max(world.best, world.score);
    return;
  }

  // The keeper: keys turn, a fresh mouse angle steers straight there.
  if (control.turn !== 0) keeper.angle += control.turn * KEEPER.turnSpeed * STEP;
  else if (control.mouseAngle !== null && control.mouseAngle !== undefined) {
    let diff = control.mouseAngle - keeper.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    keeper.angle += diff * Math.min(1, 14 * STEP);
  }
  keeper.gustTimer = Math.max(0, keeper.gustTimer - STEP);
  if (control.gust && keeper.gustTimer <= 0) gust(world);

  world.comboTimer = Math.max(0, world.comboTimer - STEP);
  if (world.comboTimer <= 0) world.combo = 1;

  // Spawning.
  world.spawnTimer -= STEP;
  if (world.spawnTimer <= 0 && world.entities.filter((e) => e.alive).length < SPAWN.maxAlive) {
    spawnEntity(world);
    const interval = Math.max(SPAWN.minInterval, SPAWN.interval + SPAWN.intervalPerWave * (world.wave - 1));
    world.spawnTimer = interval * (0.7 + world.next() * 0.6);
  }

  // Drift: everything homes on the hearth, wandering as it comes; a gust's
  // push decays and the homing reasserts itself, so a blown fiend returns
  // unless it was blown off the field.
  for (const e of world.entities) {
    if (!e.alive) continue;
    const dx = HEARTH.x - e.x;
    const dy = HEARTH.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const base = e.kind === KIND_FIEND || e.kind === KIND_SOOT || e.kind === KIND_MITE
      ? FIEND.speed + FIEND.speedPerWave * (world.wave - 1)
      : EMBER.speed + EMBER.speedPerWave * (world.wave - 1);
    const wander = Math.sin(world.time * 1.7 + e.wanderPhase) * (e.kind === KIND_EMBER || e.kind === KIND_GILDED ? EMBER.wander : FIEND.wander);
    const hx = (dx / dist) * base + (-dy / dist) * wander;
    const hy = (dy / dist) * base + (dx / dist) * wander;
    // While tumbling from a gust, a fiend keeps its blown velocity and only
    // slowly steadies; everything else steers toward its homing velocity.
    const tumbling = (e.blownTimer ?? 0) > 0;
    if (tumbling) e.blownTimer -= STEP;
    const steer = tumbling ? 0.35 : 2.2;
    e.vx += (hx - e.vx) * Math.min(1, steer * STEP);
    e.vy += (hy - e.vy) * Math.min(1, steer * STEP);
    e.x += e.vx * STEP;
    e.y += e.vy * STEP;

    if (dist < HEARTH.radius + e.radius * 0.4) {
      e.alive = false;
      if (e.kind === KIND_EMBER || e.kind === KIND_GILDED) feedEmber(world, e);
      else fiendHits(world, e);
      continue;
    }
    if (e.x < -70 || e.x > FIELD.width + 70 || e.y < -70 || e.y > FIELD.height + 70) {
      e.alive = false;
      if (e.kind === KIND_FIEND || e.kind === KIND_MITE || e.kind === KIND_SOOT) {
        world.score += FIEND.gustPoints;
        world.blown += 1;
        spawnPopup(world,
          Math.min(FIELD.width - 30, Math.max(30, e.x)),
          Math.min(FIELD.height - 20, Math.max(30, e.y)),
          `+${FIEND.gustPoints}`, '#b9b3e0');
        world.events.push(EVENT_BLOWN);
      }
    }
  }
  world.entities = world.entities.filter((e) => e.alive);
}
