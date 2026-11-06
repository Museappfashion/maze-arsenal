const BUTTONS = Object.freeze({
  confirm: 0,
  sidebar: 1,
  power1: 2,
  power2: 3,
  previous: 4,
  next: 5,
  exit: 6,
  attack: 7,
  menu: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
});
const ACTIONS = Object.keys(BUTTONS);
const DIRECTIONS = ["up", "down", "left", "right"];
const TRIGGER_THRESHOLD = 0.55;
const REPEAT_DELAY = 350;
const REPEAT_INTERVAL = 130;

const emptyDown = () => Object.fromEntries(ACTIONS.map((name) => [name, false]));
const emptyStick = () => ({ x: 0, y: 0 });
const finiteAxis = (value) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;

function stick(axes, offset, deadzone) {
  const x = finiteAxis(axes?.[offset]);
  const y = finiteAxis(axes?.[offset + 1]);
  const length = Math.hypot(x, y);
  if (length <= deadzone) return emptyStick();
  const strength = Math.min(1, (length - deadzone) / (1 - deadzone));
  return { x: x / length * strength, y: y / length * strength };
}

function buttonDown(button, isTrigger = false) {
  if (typeof button === "number") return Number.isFinite(button) && button >= TRIGGER_THRESHOLD;
  if (!button) return false;
  // Analog triggers must cross the threshold even if a browser marks them
  // pressed earlier. Digital buttons also accept the standard pressed flag.
  if (isTrigger && Number.isFinite(button.value)) return button.value >= TRIGGER_THRESHOLD;
  return button.pressed === true || Number.isFinite(button.value) && button.value >= TRIGGER_THRESHOLD;
}

function padsFrom(gamepads) {
  const length = Number.isSafeInteger(gamepads?.length) && gamepads.length >= 0 ? gamepads.length : 0;
  const pads = [];
  for (let slot = 0; slot < length; slot++) {
    const pad = gamepads[slot];
    if (!pad || pad.connected === false || pad.mapping !== "standard") continue;
    pads.push({
      pad,
      index: Number.isInteger(pad.index) && pad.index >= 0 ? pad.index : slot,
      id: typeof pad.id === "string" ? pad.id : "",
    });
  }
  return pads;
}

/**
 * Read standard-mapped browser gamepads without DOM events or game state.
 * Axes use the browser convention: +x right, +y down. `now` is milliseconds.
 * A newly selected pad must return to neutral before it can control a game.
 */
export function createGamepadReader({ deadzone = 0.18 } = {}) {
  const zone = Number.isFinite(deadzone) && deadzone >= 0 && deadzone < 1 ? deadzone : 0.18;
  let active = null;
  let neutralRequired = true;
  let previous = emptyDown();
  let repeatAt = {};
  let previousTime = null;

  function reset() {
    active = null;
    neutralRequired = true;
    previous = emptyDown();
    repeatAt = {};
    previousTime = null;
  }

  function poll(gamepads, now) {
    const candidates = padsFrom(gamepads);
    const selected = candidates.find(({ index, id }) => active?.index === index && active?.id === id) || candidates[0];
    if (!selected) {
      reset();
      return { connected: false, index: null, id: "", move: emptyStick(), look: emptyStick(), down: emptyDown(), pressed: [], repeat: [] };
    }
    if (!active || active.index !== selected.index || active.id !== selected.id) {
      reset();
      active = { index: selected.index, id: selected.id };
    }

    const time = Number.isFinite(now) ? Math.max(0, now) : previousTime ?? 0;
    const backwards = previousTime !== null && time < previousTime;
    previousTime = time;
    const move = stick(selected.pad.axes, 0, zone);
    const look = stick(selected.pad.axes, 2, zone);
    const down = Object.fromEntries(ACTIONS.map((name) => [
      name,
      buttonDown(selected.pad.buttons?.[BUTTONS[name]], name === "exit" || name === "attack"),
    ]));
    const result = { connected: true, index: selected.index, id: selected.id, move, look, down, pressed: [], repeat: [] };

    if (neutralRequired) {
      if (!ACTIONS.some((name) => down[name]) && !move.x && !move.y && !look.x && !look.y) neutralRequired = false;
      return { ...result, move: emptyStick(), look: emptyStick(), down: emptyDown() };
    }

    result.pressed = ACTIONS.filter((name) => down[name] && !previous[name]);
    for (const name of DIRECTIONS) {
      if (!down[name]) {
        delete repeatAt[name];
      } else if (!previous[name] || backwards) {
        repeatAt[name] = time + REPEAT_DELAY;
      } else if (time >= repeatAt[name]) {
        result.repeat.push(name);
        // Emit at most once per poll after a slow frame, never a burst.
        repeatAt[name] += (Math.floor((time - repeatAt[name]) / REPEAT_INTERVAL) + 1) * REPEAT_INTERVAL;
      }
    }
    previous = { ...down };
    return result;
  }

  return { poll, reset };
}
