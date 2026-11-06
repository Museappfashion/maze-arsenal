import { useEffect, useRef, useState } from "react";
import { createBaseControllerSession, emptyControllerInput } from "./baseControllerSession.js";
import { activateControllerSelection, navigateControllerMenu } from "./controllerNavigation.js";
import { loadControllerPreferences, saveControllerPreferences } from "./controllerPreferences.js";

export function useBaseGameController(options) {
  const latest = useRef(options);
  latest.current = options;
  const input = useRef(emptyControllerInput());
  const session = useRef(null);
  const [connection, setConnection] = useState({ connected: false, id: "" });
  const [preferences, setPreferences] = useState(loadControllerPreferences);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  if (!session.current) {
    session.current = createBaseControllerSession({
      getContext: () => ({
        enabled: latest.current.enabled,
        playing: Boolean(latest.current.playing),
        world: latest.current.worldRef.current,
        paused: Boolean(latest.current.worldRef.current?.controllerPaused),
        deadzone: preferencesRef.current.deadzone,
      }),
      onConnection: (connected, id) => {
        setConnection({ connected, id });
        if (!connected && latest.current.worldRef.current) latest.current.worldRef.current.controllerAimActive = false;
      },
      onExit: () => latest.current.onExit(),
      onPause: (paused) => latest.current.onPause(paused),
      onPower: (slot) => latest.current.onPower(slot),
      onBreaker: () => latest.current.onBreaker(),
      onCycle: (direction) => latest.current.onCycle(direction),
      onSidebar: (amount) => latest.current.onSidebar(amount),
      onMap: () => latest.current.onMap(),
      onNavigate: (direction) => navigateControllerMenu(document.body, direction),
      onConfirm: () => activateControllerSelection(document.body),
      onBack: () => latest.current.onBack(),
      onSettings: () => document.querySelector('.first-page-settings-button')?.click(),
    });
  }

  useEffect(() => {
    let frame, suspended = document.hidden;
    function clear() {
      input.current = emptyControllerInput();
      session.current.reset();
      const world = latest.current.worldRef.current;
      if (world) world.controllerAimActive = false;
    }
    function suspend() {
      suspended = true; clear();
      if (latest.current.enabled && latest.current.playing && session.current.isConnected()) latest.current.onPause(true);
    }
    function resume() { suspended = document.hidden; clear(); }
    function visibility() { if (document.hidden) suspend(); else resume(); }
    function takePointerOrKeyboard() {
      const world = latest.current.worldRef.current;
      if (world) world.controllerAimActive = false;
      for (const node of document.querySelectorAll('[data-controller-focus="true"]')) node.removeAttribute('data-controller-focus');
    }
    function poll(now) {
      let pads = [];
      try { pads = navigator.getGamepads?.() ?? []; } catch { /* Gamepad API may be unavailable in a restricted frame. */ }
      input.current = suspended ? emptyControllerInput() : session.current.tick(pads, now);
      frame = requestAnimationFrame(poll);
    }
    frame = requestAnimationFrame(poll);
    window.addEventListener("blur", suspend);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pointerdown", takePointerOrKeyboard, true);
    document.addEventListener("keydown", takePointerOrKeyboard, true);
    return () => {
      cancelAnimationFrame(frame); clear();
      window.removeEventListener("blur", suspend);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerdown", takePointerOrKeyboard, true);
      document.removeEventListener("keydown", takePointerOrKeyboard, true);
    };
  }, []);

  return {
    ...connection, input, preferences, preferencesRef,
    onPreferences: (next) => setPreferences(saveControllerPreferences(next)),
    reset: () => { input.current = emptyControllerInput(); session.current.reset(); },
  };
}
