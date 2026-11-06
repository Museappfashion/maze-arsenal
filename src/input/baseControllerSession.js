import { createGamepadReader } from "./baseGamepad.js";

export const BASE_CONTROLLER_LEVELS = Object.freeze(["level0", "level1", "level2", "level3", "labyrinth"]);
export const emptyControllerInput = () => ({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, attack: false });

/** Route physical presses by screen, without synthesizing keyboard events. */
export function createBaseControllerSession(handlers) {
  let reader = createGamepadReader(), deadzone = .18;
  let context = null, connected = false, padId = "", lastTime = null;

  function reset() {
    reader.reset();
    lastTime = null;
  }

  function tick(gamepads, now) {
    const next = handlers.getContext();
    const requestedZone = Number.isFinite(next.deadzone) ? Math.max(.05, Math.min(.4, next.deadzone)) : .18;
    if (requestedZone !== deadzone) {
      deadzone = requestedZone;
      reader = createGamepadReader({ deadzone });
    }
    const allowed = next.enabled && (!next.playing || BASE_CONTROLLER_LEVELS.includes(next.world?.levelKey));
    if (!allowed) {
      reset();
      context = null;
      if (connected) handlers.onConnection?.(false, "");
      connected = false;
      return emptyControllerInput();
    }
    if (!context || context.world !== next.world || context.playing !== next.playing || context.paused !== next.paused) reset();
    context = next;
    const dt = lastTime === null ? 0 : Math.max(0, Math.min(.05, (now - lastTime) / 1000));
    lastTime = now;
    const snapshot = reader.poll(gamepads, now);
    const disconnected = connected && !snapshot.connected;
    if (connected !== snapshot.connected || padId !== snapshot.id) {
      connected = snapshot.connected;
      padId = snapshot.id;
      handlers.onConnection?.(connected, padId);
    }
    if (disconnected && next.playing && !next.paused) handlers.onPause?.(true);
    if (!snapshot.connected) return emptyControllerInput();

    const pressed = new Set(snapshot.pressed);
    // Exit and pause take priority over powers, fire, and navigation.
    if (next.playing && pressed.has("exit")) {
      handlers.onExit?.(); reset(); return emptyControllerInput();
    }
    if (next.playing && pressed.has("menu")) {
      handlers.onPause?.(!next.paused); reset(); return emptyControllerInput();
    }
    if (!next.playing || next.paused || next.world?.gameOver || next.world?.victory) {
      for (const direction of ["up", "down", "left", "right"]) {
        if (pressed.has(direction) || snapshot.repeat.includes(direction)) handlers.onNavigate?.(direction);
      }
      if (pressed.has("confirm")) handlers.onConfirm?.();
      if (pressed.has("sidebar")) handlers.onBack?.();
      if (!next.playing && pressed.has("menu")) handlers.onSettings?.();
      return emptyControllerInput();
    }

    if (!next.world.labyrinthMode) {
      for (const [action, slot] of [["power1", 0], ["power2", 1], ["confirm", 2]]) {
        if (pressed.has(action)) handlers.onPower?.(slot);
      }
    } else if (pressed.has("attack")) handlers.onBreaker?.();
    if (pressed.has("previous")) handlers.onCycle?.(-1);
    if (pressed.has("next")) handlers.onCycle?.(1);
    if (snapshot.down.sidebar) handlers.onSidebar?.(pressed.has("sidebar") ? 180 : dt * 420);
    if (pressed.has("up")) handlers.onMap?.();
    return { move: snapshot.move, look: snapshot.look, attack: snapshot.down.attack && !next.world.labyrinthMode };
  }

  return { tick, reset, isConnected: () => connected };
}
