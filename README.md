[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Dimzy14/emberkeep/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Dimzy14/emberkeep/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# EMBERKEEP

Keep the flame alive until dawn. A 2D canvas arcade-defence game, original in
idea, art, sound and name, that runs in a desktop browser from static files
with no network request and no build step.

Embers drift in from the dark — let them reach the fire and they feed it,
growing the flame and your combo. Ash fiends drift in too, and they want the
flame dead: orbit the hearth and puff them away with your bellows. A gusted
fiend tumbles, a second gust may split it into mites, and a third tears it
apart — but your gusts nudge embers too, so aim matters. From the later waves,
soot clouds roll in and smother more health than any fiend. Survive five
waves — 150 seconds of night — and dawn breaks with a bonus for whatever
flame is left. If the flame dies first, the dark gets in.

Chain feeds quickly and the combo climbs to x8 — and then the flame **blazes**:
for six seconds your gusts blow wider and harder and every ember is worth
double. A blaze is worth defending, because one fiend through the guard
douses it along with your combo. Every feed, gust-kill and hit answers with a
floating score note, so the field itself keeps the score where you can see it.

**Controls** — turn the keeper with ← → or A / D, or steer with the mouse;
gust with SPACE or a click; Enter starts and restarts; P pauses; M mutes.

**Feel** — fixed-step simulation (60 steps/s at any refresh rate), seeded
worlds, particles on every feed and hit, floating score notes on every score,
a screen-shake and flash on a fiend's hit, a living title screen where the
night drifts past the hearth while you read, and a fully synthesised WebAudio
soundscape (gusts, chimes that rise with your combo, the blaze igniting, the
dawn arpeggio) — no audio files at all.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output and writes the dossier with the vendored library.
- `game/index.html` — the page; everything it loads lives under `game/`.
- `game/src/config.js` — every tuning number and colour.
- `game/src/world.js` — the simulation: night, hearth, keeper, spawning,
  gusts, scoring. No drawing, no DOM.
- `game/src/render.js` — all drawing: field, flame, keeper, entities, HUD,
  title and end screens.
- `game/src/input.js` — keyboard and mouse state.
- `game/src/audio.js` — the WebAudio synth and every sound effect.
- `game/src/random.js` — the seeded generator every night replays from.
- `game/src/shots.js` — the deterministic screenshot scenes (`?shot=title|play|dawn|over`):
  each plays the real rules forward under an autopilot keeper, so the entry's
  screenshots are the game itself, taken in a browser.
- `game/src/main.js` — boot, the fixed-step loop, and the shot mode.
- `serve.ts` — a tiny local static server: `node serve.ts`, then open
  http://localhost:8080 and play.
- `screenshots/` — the four frames the judge sees first: title, mid-game with
  its HUD, the dawn win screen, and the flame-out screen.
