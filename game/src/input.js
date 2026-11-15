// Keyboard and mouse state, read by the world once per step. The keeper turns
// with Left/Right or A/D, gusts with Space or a mouse click, and follows the
// mouse's angle from the hearth whenever the mouse has moved more recently
// than a key turned. Enter starts and restarts; P pauses; M mutes.

export function makeInput(canvas, hearth) {
  const input = {
    turn: 0, // -1, 0 or 1 from the keys, this frame
    mouseAngle: null, // the pointer's angle around the hearth, or null if never moved
    mouseFresh: false, // the pointer moved since the last step
    gustPressed: false, // an edge: true only on the step after the press
    startPressed: false,
    pausePressed: false,
    mutePressed: false,
  };
  const held = new Set();
  let gustQueued = false;
  let startQueued = false;
  let pauseQueued = false;
  let muteQueued = false;

  function refreshTurn() {
    const left = held.has('ArrowLeft') || held.has('KeyA');
    const right = held.has('ArrowRight') || held.has('KeyD');
    input.turn = (right ? 1 : 0) - (left ? 1 : 0);
    if (input.turn !== 0) input.mouseFresh = false;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      return;
    }
    held.add(event.code);
    if (event.code === 'Space') { gustQueued = true; event.preventDefault(); }
    if (event.code === 'Enter') startQueued = true;
    if (event.code === 'KeyP') pauseQueued = true;
    if (event.code === 'KeyM') muteQueued = true;
    refreshTurn();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
    refreshTurn();
  });
  window.addEventListener('blur', () => {
    held.clear();
    refreshTurn();
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    input.mouseAngle = Math.atan2(y - hearth.y, x - hearth.x);
    input.mouseFresh = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    gustQueued = true;
    startQueued = true;
    event.preventDefault();
  });

  /** Called once per simulation step: turns queued presses into one-step edges. */
  input.consume = () => {
    input.gustPressed = gustQueued;
    input.startPressed = startQueued;
    input.pausePressed = pauseQueued;
    input.mutePressed = muteQueued;
    gustQueued = false;
    startQueued = false;
    pauseQueued = false;
    muteQueued = false;
  };

  return input;
}
