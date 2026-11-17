// EMBERKEEP — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. The keeper guards the
// hearth at the field's centre against a 150-second night of five waves.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second at any refresh rate. */
export const STEP = 1 / 60;

/** The hearth the player defends: its flame is both the score's hearth and the health bar. */
export const HEARTH = { x: 640, y: 392, radius: 56, maxHealth: 100, startHealth: 78 };

/** The keeper orbits the hearth and puffs gusts outward along the orbit's radius. */
export const KEEPER = {
  orbitRadius: 118,
  turnSpeed: 3.4, // radians per second on the keys
  gustCooldown: 0.42,
  gustRange: 330, // how far from the hearth a gust still pushes
  gustHalfAngle: 0.62, // the gust cone's half-angle, radians
  gustPower: 540, // outward impulse a gust gives a fiend
  gustPowerOnEmber: 130, // embers are lighter work: a gust only nudges them
};

/** One night: five waves of thirty seconds. Survive to the end and dawn breaks. */
export const NIGHT = { waves: 5, waveSeconds: 30 };

export const EMBER = {
  radius: 11,
  speed: 62,
  speedPerWave: 9,
  wander: 26, // sideways drift amplitude, px/s
  points: 10,
  fuel: 3.2, // flame health an ember returns when it reaches the fire
  gildedChance: 0.09,
  gildedPoints: 50,
  gildedFuel: 7,
};

export const FIEND = {
  radius: 15,
  speed: 48,
  speedPerWave: 8,
  wander: 18,
  damage: 9, // flame health an ash fiend takes when it reaches the fire
  gustPoints: 5, // score for blowing one clean off the field
  splitterFromWave: 3, // from this wave, some fiends split in two when gusted
  splitterChance: 0.34,
  sootFromWave: 4, // from this wave, slow soot clouds drift in
  sootChance: 0.16,
  sootRadius: 26,
  sootDamage: 14,
};

/** Combo: feeds within the window raise the multiplier, to a cap; a fiend hit resets it. */
export const COMBO = { window: 3.0, max: 8 };

/**
 * Blaze: fill the combo to its cap and the flame catches — for a few seconds
 * the gusts blow wider and harder and every ember is worth double. A fiend
 * reaching the fire douses it early, so a blaze is something to defend.
 */
export const BLAZE = {
  duration: 6, // seconds a blaze burns once lit
  gustRangeMult: 1.45, // how much wider the gust cone reaches while blazing
  gustPowerMult: 1.5, // how much harder a gust pushes while blazing
  pointsMult: 2, // embers fed while blazing score double
  flameScale: 1.35, // the flame drawn this much larger while blazing
};

/** Spawning: one shared timer; the mix shifts toward fiends as the night deepens. */
export const SPAWN = {
  firstDelay: 0.8,
  interval: 1.15,
  intervalPerWave: -0.13,
  minInterval: 0.42,
  fiendShare: 0.30,
  fiendSharePerWave: 0.05,
  maxAlive: 26,
  maxFiends: 13, // fiends never swamp the field: past this, spawns are embers
};

export const PALETTE = {
  night: '#141126',
  nightLow: '#1d1838',
  ground: '#241d47',
  groundRing: '#322a5e',
  hearthStone: '#4a3f78',
  hearthStoneDark: '#372e5c',
  flameCore: '#fff3b0',
  flameMid: '#ffb340',
  flameEdge: '#f2662d',
  ember: '#ffc95e',
  gilded: '#ffe98a',
  fiend: '#3a3550',
  fiendSpike: '#57517a',
  fiendEye: '#ff5d47',
  soot: '#55506e',
  keeper: '#7fe3c8',
  keeperDark: '#2b8f78',
  gust: '#bfe9ff',
  text: '#f4efe4',
  muted: '#a79fd0',
  accent: '#ffb340',
  danger: '#ff5d47',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberkeep.best';
