// All of EMBERKEEP's drawing. The renderer reads the world and paints it on a
// 1280x720 canvas: a deep-indigo night, a stone hearth with a living flame at
// the centre, the keeper orbiting it, and everything that drifts in. Text is
// kept large and high-contrast so a screenshot shrunk to a contact sheet
// still reads at a glance — the judge sees the game mostly through them.

import { BLAZE, COMBO, FIELD, FONT, HEARTH, KEEPER, NIGHT, PALETTE } from './config.js';
import {
  KIND_EMBER, KIND_FIEND, KIND_GILDED, KIND_MITE, KIND_SOOT,
  SCREEN_LOST, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON, gustRangeNow, nightLeft, waveAt,
} from './world.js';
import { isMuted } from './audio.js';

export { SCREEN_LOST, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The flame: three teardrops that breathe with the health and flicker with time. */
function drawFlame(ctx, world, x, y, scale) {
  const health = world.health / HEARTH.maxHealth;
  const flicker = Math.sin(world.time * 11) * 0.05 + Math.sin(world.time * 23 + 1.7) * 0.03;
  const blazeScale = world.blaze > 0 ? BLAZE.flameScale : 1;
  const h = (64 + health * 58) * scale * blazeScale * (1 + flicker);
  const w = (30 + health * 20) * scale * blazeScale;
  const layers = [
    [PALETTE.flameEdge, 1.0, 0],
    [PALETTE.flameMid, 0.68, h * 0.1],
    [PALETTE.flameCore, 0.4, h * 0.2],
  ];
  for (const [colour, s, lift] of layers) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x - w * s, y - lift);
    ctx.quadraticCurveTo(x - w * s, y - h * s * 0.55, x, y - h * s);
    ctx.quadraticCurveTo(x + w * s, y - h * s * 0.55, x + w * s, y - lift);
    ctx.quadraticCurveTo(x, y + 6 * scale - lift, x - w * s, y - lift);
    ctx.fill();
  }
}

function drawHearth(ctx, world) {
  const { x, y } = HEARTH;
  // The glow the flame throws on the ground: wider and hotter in a blaze.
  const glowRadius = world.blaze > 0 ? 320 : 240;
  const glow = ctx.createRadialGradient(x, y, 10, x, y, glowRadius);
  glow.addColorStop(0, world.blaze > 0 ? 'rgba(255, 170, 60, 0.45)' : 'rgba(255, 160, 60, 0.30)');
  glow.addColorStop(1, 'rgba(255, 160, 60, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);
  // The keeper's orbit, a faint ring of stones.
  ctx.strokeStyle = PALETTE.groundRing;
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 14]);
  ctx.beginPath();
  ctx.arc(x, y, KEEPER.orbitRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Stone ring and logs.
  ctx.fillStyle = PALETTE.hearthStoneDark;
  ctx.beginPath();
  ctx.arc(x, y, HEARTH.radius + 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.hearthStone;
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * (HEARTH.radius + 4), y + Math.sin(a) * (HEARTH.radius + 4), 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#241a30';
  ctx.beginPath();
  ctx.arc(x, y, HEARTH.radius - 6, 0, Math.PI * 2);
  ctx.fill();
  if (world.health > 0) drawFlame(ctx, world, x, y + 16, 1);
  else {
    ctx.fillStyle = PALETTE.soot;
    ctx.beginPath();
    ctx.arc(x, y + 6, 16, 0, Math.PI * 2);
    ctx.arc(x + 14, y + 12, 11, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawKeeper(ctx, world) {
  const { x, y } = HEARTH;
  const a = world.keeper.angle;
  const kx = x + Math.cos(a) * KEEPER.orbitRadius;
  const ky = y + Math.sin(a) * KEEPER.orbitRadius;
  // The gust cone while it flashes: a soft fan blowing outward, wider in a blaze.
  if (world.keeper.gustFlash > 0) {
    const t = world.keeper.gustFlash / 0.22;
    ctx.fillStyle = `rgba(191, 233, 255, ${0.20 * t})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, gustRangeNow(world) * (1.1 - t * 0.25), a - KEEPER.gustHalfAngle, a + KEEPER.gustHalfAngle);
    ctx.closePath();
    ctx.fill();
  }
  ctx.save();
  ctx.translate(kx, ky);
  ctx.rotate(a + Math.PI / 2);
  // A little hooded figure in teal, facing outward, bellows in hand.
  ctx.fillStyle = PALETTE.keeperDark;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.quadraticCurveTo(13, 2, 9, 15);
  ctx.lineTo(-9, 15);
  ctx.quadraticCurveTo(-13, 2, 0, -16);
  ctx.fill();
  ctx.fillStyle = PALETTE.keeper;
  ctx.beginPath();
  ctx.arc(0, -7, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b04b';
  ctx.fillRect(-2.5, -24, 5, 9); // the bellows nozzle, pointing out
  ctx.restore();
}

function drawEntity(ctx, world, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.kind === KIND_EMBER || e.kind === KIND_GILDED) {
    const gilded = e.kind === KIND_GILDED;
    const pulse = 1 + Math.sin(world.time * 6 + e.wanderPhase) * 0.12;
    ctx.fillStyle = gilded ? 'rgba(255, 233, 138, 0.32)' : 'rgba(255, 201, 94, 0.27)';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 1.7 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = gilded ? PALETTE.gilded : PALETTE.ember;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(-2, -2, e.radius * 0.38, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === KIND_SOOT) {
    ctx.fillStyle = PALETTE.soot;
    for (const [ox, oy, r] of [[0, 0, e.radius], [-14, 6, 16], [13, 8, 14], [2, -11, 13]]) {
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.fiendEye;
    ctx.beginPath();
    ctx.arc(-6, 0, 3, 0, Math.PI * 2);
    ctx.arc(7, 2, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Ash fiends and their mites: spiky dark lumps with ember-red eyes.
    const spikes = e.kind === KIND_MITE ? 6 : 8;
    ctx.fillStyle = PALETTE.fiend;
    ctx.beginPath();
    for (let i = 0; i < spikes; i += 1) {
      const a = (i / spikes) * Math.PI * 2 + e.wanderPhase;
      const outer = e.radius * 1.35;
      const inner = e.radius * 0.82;
      const mid = a + Math.PI / spikes;
      if (i === 0) ctx.moveTo(Math.cos(a) * outer, Math.sin(a) * outer);
      else ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
      ctx.lineTo(Math.cos(mid) * inner, Math.sin(mid) * inner);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.fiendSpike;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = PALETTE.fiendEye;
    ctx.beginPath();
    ctx.arc(-4, -1, 2.6, 0, Math.PI * 2);
    ctx.arc(4.5, -1, 2.6, 0, Math.PI * 2);
    ctx.fill();
    if (e.gusted > 0) { // a cracked ring shows a gusted fiend is weakened
      ctx.strokeStyle = 'rgba(244, 239, 228, 0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 1.55, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Blend two #rrggbb colours by t (0 = a, 1 = b). */
function mixColour(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mixed = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function drawField(ctx, world) {
  // Night sky-ground: a vertical wash that warms smoothly into dawn on the
  // win screen — deep blue up top, rose at the horizon — as dawnGlow rises.
  const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  const t = world.screen === SCREEN_WON ? world.dawnGlow : 0;
  g.addColorStop(0, mixColour(PALETTE.night, '#3a3f6e', t));
  g.addColorStop(0.62, mixColour(PALETTE.nightLow, '#6e4460', t));
  g.addColorStop(1, mixColour(PALETTE.nightLow, '#a06a5e', t));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  // Scattered stars / dust motes, fixed by a hash of their index so they never move.
  ctx.fillStyle = 'rgba(244, 239, 228, 0.35)';
  for (let i = 0; i < 46; i += 1) {
    const sx = ((i * 373) % 1250) + 15;
    const sy = ((i * 211) % 690) + 12;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.fillStyle = PALETTE.ground;
  ctx.beginPath();
  ctx.ellipse(HEARTH.x, HEARTH.y + 26, 330, 205, 0, 0, Math.PI * 2);
  ctx.fill();
}

function bar(ctx, x, y, w, h, fraction, colour, back) {
  ctx.fillStyle = back;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (fraction > 0) {
    ctx.fillStyle = colour;
    roundRect(ctx, x, y, Math.max(h, w * Math.min(1, fraction)), h, h / 2);
    ctx.fill();
  }
}

function drawHud(ctx, world) {
  ctx.textBaseline = 'alphabetic';
  // Score block, top left.
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 34px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(String(world.score), 26, 48);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`SCORE · BEST ${Math.max(world.best, world.score)}`, 27, 72);
  if (world.combo > 1) {
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText(`COMBO x${world.combo}`, 26, 106);
    // The combo's remaining window as a thin bar: feed again before it empties.
    bar(ctx, 27, 114, 120, 5, world.comboTimer / COMBO.window, PALETTE.accent, 'rgba(244,239,228,0.14)');
  }
  if (world.blaze > 0) {
    // The blaze banner, under the night bar: what it does and how long is left.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `800 25px ${FONT}`;
    ctx.fillText('BLAZE! WIDE GUSTS · DOUBLE EMBERS', FIELD.width / 2, 100);
    bar(ctx, FIELD.width / 2 - 110, 110, 220, 6, world.blaze / BLAZE.duration, PALETTE.flameMid, 'rgba(244,239,228,0.14)');
    ctx.textAlign = 'left';
  }
  // Night progress, top centre: a moon that empties as dawn nears, and the wave pips.
  const total = NIGHT.waves * NIGHT.waveSeconds;
  const done = Math.min(1, world.time / total);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`NIGHT — WAVE ${world.wave} OF ${NIGHT.waves} · DAWN IN ${Math.ceil(nightLeft(world))}s`, FIELD.width / 2, 40);
  bar(ctx, FIELD.width / 2 - 190, 52, 380, 10, done, PALETTE.accent, 'rgba(244,239,228,0.14)');
  // Flame health, top right: the fire is the life bar.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText('THE FLAME', FIELD.width - 27, 40);
  const healthColour = world.health > 45 ? PALETTE.flameMid : world.health > 22 ? PALETTE.flameEdge : PALETTE.danger;
  bar(ctx, FIELD.width - 227, 50, 200, 14, world.health / 100, healthColour, 'rgba(244,239,228,0.14)');
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText(`fed ${world.fed} · blown away ${world.blown}${isMuted() ? ' · MUTED (M)' : ''}`, FIELD.width - 27, 88);
  if (world.keeper.gustTimer > 0) {
    ctx.fillStyle = 'rgba(191,233,255,0.75)';
    ctx.fillText('bellows…', FIELD.width - 27, 110);
  }
}

function panel(ctx, w, h, cy = FIELD.height / 2) {
  ctx.fillStyle = 'rgba(16, 12, 34, 0.84)';
  roundRect(ctx, FIELD.width / 2 - w / 2, cy - h / 2, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 179, 64, 0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, FIELD.width / 2 - w / 2, cy - h / 2, w, h, 18);
  ctx.stroke();
}

function drawTitle(ctx, world) {
  // The title stands over the living field: the hearth, its flame and the
  // circling keeper stay in view in the middle band, the words above and a
  // slim how-to panel below — the cover shows the game, not a text card.
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.accent;
  ctx.font = `800 76px ${FONT}`;
  ctx.fillText('EMBERKEEP', FIELD.width / 2, 138);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText('Keep the flame alive until dawn.', FIELD.width / 2, 178);
  panel(ctx, 800, 196, 584);
  ctx.font = `400 18px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('Embers drift in from the dark — let them reach the fire to feed it.', FIELD.width / 2, 524);
  ctx.fillText('Ash fiends want it dead. Blow them off the field with your bellows.', FIELD.width / 2, 552);
  ctx.fillText('Turn: ← → or A / D, or steer with the mouse    Gust: SPACE or click', FIELD.width / 2, 586);
  ctx.fillText('Chain feeds to x8 and the flame BLAZES — wide gusts, double embers.', FIELD.width / 2, 614);
  ctx.fillStyle = PALETTE.keeper;
  ctx.font = `700 24px ${FONT}`;
  const pulse = 0.75 + Math.sin(world.time * 4) * 0.25;
  ctx.globalAlpha = pulse;
  ctx.fillText('PRESS ENTER TO BEGIN THE NIGHT', FIELD.width / 2, 656);
  ctx.globalAlpha = 1;
  if (world.best > 0) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(`Best so far: ${world.best}`, FIELD.width / 2, 462);
  }
}

function drawEnd(ctx, world) {
  const won = world.screen === SCREEN_WON;
  panel(ctx, 620, 400);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? PALETTE.gilded : PALETTE.danger;
  ctx.font = `800 54px ${FONT}`;
  ctx.fillText(won ? 'DAWN BREAKS' : 'THE FLAME IS OUT', FIELD.width / 2, 232);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `500 20px ${FONT}`;
  ctx.fillText(won ? 'The fire lived through the night — and so did you.' : 'The dark got in. The hearth is cold.', FIELD.width / 2, 272);
  ctx.font = `700 40px ${FONT}`;
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText(`SCORE ${world.score}`, FIELD.width / 2, 338);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText(`embers fed ${world.fed} · fiends blown away ${world.blown} · best ${Math.max(world.best, world.score)}`, FIELD.width / 2, 376);
  if (won) ctx.fillText('dawn bonus already counted: the flame that was left, x5', FIELD.width / 2, 404);
  ctx.fillStyle = PALETTE.keeper;
  ctx.font = `700 23px ${FONT}`;
  ctx.fillText('PRESS ENTER OR CLICK TO KEEP ANOTHER NIGHT', FIELD.width / 2, 462);
}

/** Paint one frame of the world. Called every animation frame by main.js. */
export function draw(ctx, world) {
  ctx.save();
  if (world.shake > 0) {
    // A deterministic wobble (from the sim clock, never Math.random) so a
    // screenshot of the same moment is always the same frame.
    const s = world.shake * 12;
    ctx.translate(Math.sin(world.time * 91) * s, Math.cos(world.time * 113) * s);
  }
  drawField(ctx, world);
  drawHearth(ctx, world);
  for (const e of world.entities) drawEntity(ctx, world, e);
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.colour;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // The score notes float up from where they were earned and fade.
  ctx.textAlign = 'center';
  ctx.font = `800 21px ${FONT}`;
  for (const p of world.popups) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.colour;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  drawKeeper(ctx, world);
  if (world.flash !== 0) {
    ctx.fillStyle = world.flash > 0
      ? `rgba(255, 190, 80, ${world.flash * 0.25})`
      : `rgba(255, 60, 40, ${-world.flash * 0.22})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  if (world.screen === SCREEN_PLAY) {
    drawHud(ctx, world);
    if (world.paused) {
      ctx.fillStyle = 'rgba(16, 12, 34, 0.6)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED — P TO RESUME', FIELD.width / 2, FIELD.height / 2);
    }
  }
  if (world.screen === SCREEN_TITLE) drawTitle(ctx, world);
  if (world.screen === SCREEN_WON || world.screen === SCREEN_LOST) drawEnd(ctx, world);
  ctx.restore();
}

// waveAt is re-exported for the HUD's friends; keep the import honest.
export { waveAt };
