// A small seeded random generator (mulberry32). The world never calls
// Math.random: a seed fully determines a night, which is what lets the
// screenshot scenes replay the same game every time they are taken.

export function makeRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random float in [min, max). */
export function range(next, min, max) {
  return min + next() * (max - min);
}

/** A random whole number in [min, max]. */
export function whole(next, min, max) {
  return Math.floor(range(next, min, max + 1));
}
