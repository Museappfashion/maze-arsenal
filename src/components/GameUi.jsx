// src/components/GameUi.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_AMMO } from "../config/ammo.js";
import { STEEL_WALL, WALL } from "../config/constants.js";
import { getAmmoLabel, getTheme, getWeaponLabel } from "../config/presentations.js";
import { SUPPORT_LINKS } from "../config/support.js";
import { WEAPON_ORDER } from "../config/weapons.js";
import { hasPowerUp, selectWeapon } from "../game/gameplay.js";
import { getLabyrinthTimeRemaining, labyrinthBreakerActive } from "../game/labyrinth.js";
import { getDiscoveredPercent } from "../game/maze.js";
import { formatTime, indexOfTile } from "../utils/math.js";
import { getPlayerDisplayName } from "../utils/player.js";
import { recordDonationAttempt } from "../services/developerAnalytics.js";

export function MinimapPanel({ world, compact = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shouldShowMinimap =
      world.labyrinthMode || world.viewMode === "3d" || world.minimapOn;

    if (!canvas || !shouldShowMinimap) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (world.labyrinthMode) {
      const size = compact ? 136 : world.mobileView ? 176 : 160;
      const padding = 12;
      const usable = size - padding * 2;

      canvas.width = size;
      canvas.height = size;

      ctx.fillStyle = "#010204";
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

      const pointFor = (x, y) => ({
        x: padding + (x / Math.max(1, world.width - 1)) * usable,
        y: padding + (y / Math.max(1, world.height - 1)) * usable,
      });

      const exitPoint = pointFor(
        world.exit.x + 0.5,
        world.exit.y + 0.5,
      );
      const playerPoint = pointFor(world.player.x, world.player.y);

      ctx.shadowBlur = 12;
      ctx.shadowColor = "#22c55e";
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(exitPoint.x, exitPoint.y, compact ? 4 : 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = "#38bdf8";
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(
        playerPoint.x,
        playerPoint.y,
        compact ? 4 : 5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.shadowBlur = 0;
      return;
    }

    const maxSize = compact ? 220 : world.mobileView ? 440 : 320;
    const scale = Math.max(
      1,
      Math.floor(maxSize / Math.max(world.width, world.height)),
    );
    const mapWidth = world.width * scale;
    const mapHeight = world.height * scale;

    canvas.width = mapWidth;
    canvas.height = mapHeight;
    ctx.clearRect(0, 0, mapWidth, mapHeight);

    for (let y = 0; y < world.height; y += 1) {
      for (let x = 0; x < world.width; x += 1) {
        const discovered =
          world.discovered[indexOfTile(world.width, x, y)] === 1;
        const theme = getTheme(world);

        if (!discovered) {
          ctx.fillStyle = theme.backdrop;
        } else if (world.grid[y][x] === STEEL_WALL) {
          ctx.fillStyle = theme.steelA ?? "#7c8794";
        } else if (world.grid[y][x] === WALL) {
          ctx.fillStyle = theme.wallB;
        } else {
          ctx.fillStyle = theme.floorB;
        }

        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(
      world.exit.x * scale,
      world.exit.y * scale,
      Math.max(3, scale + 1),
      Math.max(3, scale + 1),
    );

    if (hasPowerUp(world, "sonar")) {
      for (const enemy of world.enemies) {
        ctx.fillStyle =
          enemy.kind === "warden"
            ? "#f472b6"
            : enemy.kind === "turret"
              ? "#facc15"
              : "#ef4444";
        ctx.fillRect(
          Math.floor(enemy.x) * scale,
          Math.floor(enemy.y) * scale,
          Math.max(2, scale),
          Math.max(2, scale),
        );
      }
    }

    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(
      Math.floor(world.player.x) * scale,
      Math.floor(world.player.y) * scale,
      Math.max(2, scale + 1),
      Math.max(2, scale + 1),
    );
  });

  const shouldShowMinimap =
    world.labyrinthMode || world.viewMode === "3d" || world.minimapOn;

  if (!shouldShowMinimap) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 16,
          background: "rgba(15, 23, 42, 0.9)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
          color: "#94a3b8",
          fontSize: 13,
        }}
      >
        Minimap hidden. Press M to show it.
      </div>
    );
  }

  if (world.labyrinthMode) {
    return (
      <section className="labyrinth-locator" aria-label="Labyrinth locator">
        <div className="labyrinth-locator-heading">
          <h2>Locator</h2>
          <span>No maze revealed</span>
        </div>
        <div className="labyrinth-locator-canvas">
          <canvas ref={canvasRef} />
        </div>
        <div className="labyrinth-locator-key">
          <span><i className="locator-dot player" />Blue = You</span>
          <span><i className="locator-dot exit" />Green = Exit</span>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        padding: 14,
        borderRadius: 16,
        background: "rgba(15, 23, 42, 0.92)",
        border: "1px solid rgba(148, 163, 184, 0.14)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>Minimap</h2>
        <span style={{ color: "#94a3b8", fontSize: 12 }}>
          {getDiscoveredPercent(world)}% discovered
        </span>
      </div>
      <div
        style={{
          display: "grid",
          placeItems: "center",
          width: "100%",
          overflow: "hidden",
          borderRadius: 12,
          background: "#020617",
          border: "1px solid rgba(148, 163, 184, 0.12)",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            maxHeight: compact ? 190 : world.mobileView ? 420 : 320,
            objectFit: "contain",
            imageRendering: "pixelated",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 12px",
          marginTop: 10,
          color: "#cbd5e1",
          fontSize: 12,
        }}
      >
        <span>Blue = {getPlayerDisplayName(world)}</span>
        <span>Green = Exit</span>
      </div>
    </section>
  );
}

export function openSupportLink(url) {
  if (!url || typeof window === "undefined") {
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export function SupportButtons({ compact = false }) {
  const configuredCount = SUPPORT_LINKS.filter((item) => item.url).length;

  return (
    <section
      className={`support-panel${compact ? " compact" : ""}`}
      aria-label="Support Mist Maze"
    >
      <div className="support-panel-heading">
        <strong>♥ SUPPORT MIST MAZE</strong>
        {!compact && (
          <span>
            Help keep the game online and improving.
          </span>
        )}
      </div>

      <div className="support-button-grid">
        {SUPPORT_LINKS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="support-amount-button"
            disabled={!item.url}
            title={
              item.url
                ? `Support Mist Maze with ${item.label}`
                : "Payment link not configured yet"
            }
            onClick={() => {
              void recordDonationAttempt(item.key);
              openSupportLink(item.url);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!compact && configuredCount === 0 && (
        <div className="support-setup-note">
          Add the support payment URLs in Vercel Environment Variables.
        </div>
      )}
    </section>
  );
}

export function AudioVolumeControls({
  enabled,
  musicVolume,
  sfxVolume,
  onToggle,
  onTestSound,
  onMusicVolumeChange,
  onSfxVolumeChange,
}) {
  const musicPercent = Math.round(musicVolume * 100);
  const sfxPercent = Math.round(sfxVolume * 100);

  return (
    <div
      className="audio-volume-controls"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="audio-top-actions">
        <button
          type="button"
          className="audio-master-toggle"
          onClick={onToggle}
          aria-pressed={enabled}
        >
          {enabled ? "🔊 SOUND ON" : "🔇 MUTED"}
        </button>
        <button
          type="button"
          className="audio-test-button"
          onClick={onTestSound}
        >
          TEST SOUND
        </button>
      </div>

      <label className="audio-volume-row">
        <span>
          <strong>MUSIC</strong>
          <em>{musicPercent}%</em>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={musicPercent}
          aria-label="Music volume"
          onChange={(event) =>
            onMusicVolumeChange(Number(event.target.value) / 100)
          }
        />
      </label>

      <label className="audio-volume-row">
        <span>
          <strong>SFX</strong>
          <em>{sfxPercent}%</em>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={sfxPercent}
          aria-label="Sound effects volume"
          onChange={(event) =>
            onSfxVolumeChange(Number(event.target.value) / 100)
          }
        />
      </label>
    </div>
  );
}

export function SettingsControls({
  viewMode,
  onToggleViewMode,
  audioEnabled,
  musicVolume,
  sfxVolume,
  onToggleAudio,
  onTestSound,
  onMusicVolumeChange,
  onSfxVolumeChange,
  audioStatus,
}) {
  return (
    <div className="settings-controls">
      <div className="settings-section-title">VIEW</div>
      <button
        type="button"
        className="settings-view-toggle"
        onClick={onToggleViewMode}
      >
        {viewMode === "3d"
          ? "✓ 3D · SWITCH TO 2D"
          : "2D CLASSIC · SWITCH TO 3D"}
      </button>

      <div className="settings-section-title">SOUND</div>
      <AudioVolumeControls
        enabled={audioEnabled}
        musicVolume={musicVolume}
        sfxVolume={sfxVolume}
        onToggle={onToggleAudio}
        onTestSound={onTestSound}
        onMusicVolumeChange={onMusicVolumeChange}
        onSfxVolumeChange={onSfxVolumeChange}
      />
      <div className="audio-status-text" role="status">
        {audioStatus}
      </div>
    </div>
  );
}

export function SidebarSettings({
  open,
  onToggle,
  viewMode,
  onToggleViewMode,
  audioEnabled,
  musicVolume,
  sfxVolume,
  onToggleAudio,
  onTestSound,
  onMusicVolumeChange,
  onSfxVolumeChange,
  audioStatus,
  onStart,
  compact = false,
}) {
  return (
    <section
      className={`sidebar-tools-card${compact ? " compact" : ""}`}
      aria-label="Game tools"
    >
      <div className="sidebar-tools-actions">
        <button
          type="button"
          className="sidebar-new-maze-button"
          onClick={onStart}
        >
          START NEW MAZE
        </button>
        <button
          type="button"
          className="sidebar-settings-gear"
          aria-label="Settings"
          title="Settings"
          aria-expanded={open}
          onClick={onToggle}
        >
          ⚙
        </button>
      </div>

      {open && (
        <SettingsControls
          viewMode={viewMode}
          onToggleViewMode={onToggleViewMode}
          audioEnabled={audioEnabled}
          musicVolume={musicVolume}
          sfxVolume={sfxVolume}
          onToggleAudio={onToggleAudio}
          onTestSound={onTestSound}
          onMusicVolumeChange={onMusicVolumeChange}
          onSfxVolumeChange={onSfxVolumeChange}
          audioStatus={audioStatus}
        />
      )}
    </section>
  );
}

export function LabyrinthStatusPanel({
  world,
  onActivateBreaker,
  compact = false,
}) {
  const remaining = getLabyrinthTimeRemaining(world);
  const active = labyrinthBreakerActive(world);
  const activeRemaining = active
    ? Math.max(0, world.labyrinth.breakerEndsAt - world.time)
    : 0;

  return (
    <section
      className={`labyrinth-status-panel${compact ? " compact" : ""}`}
      aria-label="Labyrinth status"
    >
      <div className="labyrinth-status-title">LABYRINTH</div>
      <div className="labyrinth-status-grid">
        <div>
          <strong>TIME LEFT</strong>
          <span>{formatTime(remaining)}</span>
        </div>
        <div>
          <strong>DIFFICULTY</strong>
          <span>{world.labyrinth.difficultyLabel}</span>
        </div>
        <div>
          <strong>WALL BREAKERS</strong>
          <span>{world.labyrinth.breakerCharges}/10</span>
        </div>
        <div>
          <strong>MAZE</strong>
          <span>
            {world.logicalCols}×{world.logicalRows}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="labyrinth-breaker-button"
        disabled={world.labyrinth.breakerCharges <= 0}
        onClick={onActivateBreaker}
      >
        {active
          ? `BREAKER ACTIVE ${activeRemaining.toFixed(1)}s`
          : `USE WALL BREAKER (${world.labyrinth.breakerCharges})`}
      </button>

      <div className="labyrinth-status-note">
        Purple pickups give one 10-second Wall Breaker. Carry up to 10.
        Silver steel walls cannot be smashed.
      </div>
    </section>
  );
}

export function MobileHudOverlay({
  world,
  mapExpanded,
  onMapToggle,
  onSettings,
  onExitLevel,
  onFullscreen,
  onActivateBreaker,
}) {
  if (world.labyrinthMode) {
    return (
      <div className="mobile-hud-overlay labyrinth-mobile-hud">
        <div className="mobile-hud-status">
          <div className="mobile-hud-chip">
            <strong>TIME LEFT</strong>
            <span>{formatTime(getLabyrinthTimeRemaining(world))}</span>
          </div>
          <div className="mobile-hud-chip">
            <strong>BREAKERS</strong>
            <span>{world.labyrinth.breakerCharges}/10</span>
          </div>
          <div className="mobile-hud-chip mobile-hud-weapon">
            <strong>DIFFICULTY</strong>
            <span>{world.labyrinth.difficultyLabel}</span>
          </div>
        </div>

        <div className="mobile-hud-actions">
          {world.viewMode !== "3d" && (
            <button
              type="button"
              className="mobile-settings-gear"
              aria-label="Settings"
              title="Settings"
              onClick={onSettings}
            >
              ⚙
            </button>
          )}
          <button type="button" onClick={onFullscreen}>
            FULL
          </button>
          <button type="button" onClick={onExitLevel}>
            MENU
          </button>
        </div>

        <div className="mobile-labyrinth-locator">
          <MinimapPanel world={world} compact />
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-hud-overlay">
      <div className="mobile-hud-status">
        <div className="mobile-hud-chip">
          <strong>HP</strong>
          <span>
            {Math.round(world.player.hp)}/{Math.round(world.player.maxHp)}
          </span>
        </div>
        <div className="mobile-hud-chip">
          <strong>{getAmmoLabel(world)}</strong>
          <span>{Math.floor(world.player.ammo)}</span>
        </div>
        <div className="mobile-hud-chip mobile-hud-weapon">
          <strong>WEAPON</strong>
          <span>{getWeaponLabel(world, world.player.weapon)}</span>
        </div>
        <div className="mobile-hud-chip">
          <strong>TIME</strong>
          <span>{formatTime(world.time)}</span>
        </div>
      </div>

      <div className="mobile-hud-actions">
        {world.viewMode !== "3d" && (
          <button
            type="button"
            className="mobile-settings-gear"
            aria-label="Settings"
            title="Settings"
            onClick={onSettings}
          >
            ⚙
          </button>
        )}
        <button type="button" onClick={onFullscreen}>
          FULL
        </button>
        <button type="button" onClick={onExitLevel}>
          MENU
        </button>
      </div>

      <div
        className={`mobile-minimap-wrap${mapExpanded ? " expanded" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={mapExpanded ? "Shrink minimap" : "Expand minimap"}
        onClick={onMapToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onMapToggle();
          }
        }}
      >
        <MinimapPanel world={world} />
        <div className="mobile-minimap-hint">
          {world.minimapOn
            ? mapExpanded
              ? "Tap map to shrink"
              : "Tap map to enlarge"
            : "Tap to turn map on"}
        </div>
      </div>
    </div>
  );
}

export function ThreeDStatusSidebar({
  world,
  storedPowerUps,
  activePowerUps,
  onPowerUp,
  onBreaker,
  onStart,
  onSwitchMode,
  onFullscreen,
  onExitLevel,
  settingsOpen,
  onToggleSettings,
  audioEnabled,
  musicVolume,
  sfxVolume,
  onToggleAudio,
  onTestSound,
  onMusicVolumeChange,
  onSfxVolumeChange,
  audioStatus,
}) {
  if (world.labyrinthMode) {
    return (
      <div className="three-d-status-sidebar-content">
        <MinimapPanel world={world} compact />
        <LabyrinthStatusPanel
          world={world}
          onActivateBreaker={onBreaker}
          compact
        />

        <SidebarSettings
          open={settingsOpen}
          onToggle={onToggleSettings}
          viewMode={world.viewMode}
          onToggleViewMode={onSwitchMode}
          audioEnabled={audioEnabled}
          musicVolume={musicVolume}
          sfxVolume={sfxVolume}
          onToggleAudio={onToggleAudio}
          onTestSound={onTestSound}
          onMusicVolumeChange={onMusicVolumeChange}
          onSfxVolumeChange={onSfxVolumeChange}
          audioStatus={audioStatus}
          onStart={onStart}
          compact
        />

        <div className="three-d-sidebar-actions">
          <button type="button" onClick={onFullscreen}>
            FULLSCREEN
          </button>
          <button type="button" onClick={onExitLevel}>
            LEVEL MENU
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="three-d-status-sidebar-content">
      <MinimapPanel world={world} compact />

      <section className="three-d-sidebar-card">
        <div className="three-d-sidebar-title">3D STATUS</div>
        <div className="three-d-vitals-grid">
          <div className="three-d-vital">
            <strong>HEALTH</strong>
            <span>
              {Math.round(world.player.hp)}/{Math.round(world.player.maxHp)}
            </span>
          </div>
          <div className="three-d-vital">
            <strong>{getAmmoLabel(world)}</strong>
            <span>
              {Math.floor(world.player.ammo)}/{MAX_AMMO}
            </span>
          </div>
          <div className="three-d-vital three-d-vital-wide">
            <strong>WEAPON</strong>
            <span>{getWeaponLabel(world, world.player.weapon)}</span>
          </div>
        </div>
      </section>

      <section className="three-d-sidebar-card">
        <div className="three-d-sidebar-title">POWER-UPS</div>

        <div className="three-d-power-slots">
          {storedPowerUps.map((powerUp, index) => (
            <button
              key={index}
              type="button"
              disabled={!powerUp}
              onClick={() => onPowerUp(index)}
              style={{
                borderColor: powerUp
                  ? `${powerUp.color}88`
                  : "rgba(148, 163, 184, 0.18)",
              }}
            >
              <strong>P{index + 1}</strong>
              <span>{powerUp?.label ?? "Empty"}</span>
            </button>
          ))}
        </div>

        <div className="three-d-active-powers">
          {activePowerUps.length > 0 ? (
            activePowerUps.map((powerUp) => (
              <div key={powerUp.key}>
                <span
                  className="three-d-power-dot"
                  style={{ background: powerUp.color }}
                />
                <span>{powerUp.label}</span>
                <strong>{powerUp.remaining.toFixed(1)}s</strong>
              </div>
            ))
          ) : (
            <div className="three-d-no-power">No active power-up</div>
          )}
        </div>
      </section>

      <SidebarSettings
        open={settingsOpen}
        onToggle={onToggleSettings}
        viewMode={world.viewMode}
        onToggleViewMode={onSwitchMode}
        audioEnabled={audioEnabled}
        musicVolume={musicVolume}
        sfxVolume={sfxVolume}
        onToggleAudio={onToggleAudio}
        onTestSound={onTestSound}
        onMusicVolumeChange={onMusicVolumeChange}
        onSfxVolumeChange={onSfxVolumeChange}
        audioStatus={audioStatus}
        onStart={onStart}
        compact
      />

      <div className="three-d-sidebar-actions">
        <button type="button" onClick={onFullscreen}>
          FULLSCREEN
        </button>
        <button type="button" onClick={onExitLevel}>
          LEVEL MENU
        </button>
      </div>
    </div>
  );
}

export function TouchJoystick({
  label,
  mode = "vector",
  onVector,
  onLookDelta,
  onPointerStart,
  onPointerEnd,
}) {
  const padRef = useRef(null);
  const pointerIdRef = useRef(null);
  const lastPointRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const updateJoystick = useCallback(
    (event) => {
      const pad = padRef.current;
      if (!pad) {
        return;
      }

      const rect = pad.getBoundingClientRect();
      const radius = Math.max(
        1,
        Math.min(rect.width, rect.height) / 2 - 20,
      );
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let offsetX = event.clientX - centerX;
      let offsetY = event.clientY - centerY;
      const distance = Math.hypot(offsetX, offsetY);

      if (distance > radius) {
        const scale = radius / distance;
        offsetX *= scale;
        offsetY *= scale;
      }

      setKnob({ x: offsetX, y: offsetY });

      if (mode === "look") {
        const previousPoint = lastPointRef.current;
        if (previousPoint) {
          onLookDelta?.(
            event.clientX - previousPoint.x,
            event.clientY - previousPoint.y,
          );
        }
        lastPointRef.current = {
          x: event.clientX,
          y: event.clientY,
        };
        return;
      }

      onVector?.(offsetX / radius, offsetY / radius);
    },
    [mode, onLookDelta, onVector],
  );

  const handlePointerDown = useCallback(
    (event) => {
      event.preventDefault();

      if (pointerIdRef.current !== null) {
        return;
      }

      pointerIdRef.current = event.pointerId;
      lastPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      updateJoystick(event);
      onPointerStart?.();
    },
    [onPointerStart, updateJoystick],
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (pointerIdRef.current !== event.pointerId) {
        return;
      }

      event.preventDefault();
      updateJoystick(event);
    },
    [updateJoystick],
  );

  const releasePointer = useCallback(
    (event) => {
      if (
        pointerIdRef.current !== null &&
        event.pointerId !== pointerIdRef.current
      ) {
        return;
      }

      event.preventDefault();
      pointerIdRef.current = null;
      lastPointRef.current = null;
      setKnob({ x: 0, y: 0 });

      if (mode !== "look") {
        onVector?.(0, 0);
      }

      onPointerEnd?.();
    },
    [mode, onPointerEnd, onVector],
  );

  return (
    <div
      ref={padRef}
      className="touch-joystick"
      role="application"
      aria-label={`${label} joystick`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="touch-joystick-label">{label}</span>
      <span
        className="touch-joystick-knob"
        style={{
          transform: `translate(${knob.x}px, ${knob.y}px)`,
        }}
      />
    </div>
  );
}

export function TouchControls({
  gameMode,
  storedPowerUps,
  onMove,
  onAim,
  onLookDelta,
  onAttackStart,
  onAttackEnd,
  onNextWeapon,
  onPowerUp,
  labyrinthMode = false,
  labyrinthBreakers = 0,
  onBreaker,
}) {
  return (
    <div
      className={`touch-controls${labyrinthMode ? " labyrinth-touch-controls" : ""}`}
      aria-label="Touch game controls"
    >
      <div className="touch-move-control">
        <TouchJoystick label="MOVE" onVector={onMove} />
      </div>

      {(!labyrinthMode || gameMode === "3d") && (
        <div className="touch-aim-control">
          <TouchJoystick
            label={gameMode === "3d" ? "LOOK" : "AIM"}
            mode={gameMode === "3d" ? "look" : "vector"}
            onVector={onAim}
            onLookDelta={onLookDelta}
            onPointerStart={labyrinthMode ? undefined : onAttackStart}
            onPointerEnd={labyrinthMode ? undefined : onAttackEnd}
          />
        </div>
      )}

      <div className="touch-action-controls">
        {labyrinthMode ? (
          <button
            type="button"
            className="touch-action-button labyrinth-touch-breaker"
            disabled={labyrinthBreakers <= 0}
            onClick={onBreaker}
          >
            BREAKER {labyrinthBreakers}/10
          </button>
        ) : (
          <>
            <button
              type="button"
              className="touch-action-button"
              aria-label="Switch to next weapon"
              onClick={onNextWeapon}
            >
              WEAPON
            </button>

            <div className="touch-power-buttons">
              {[0, 1].map((slotIndex) => (
                <button
                  key={slotIndex}
                  type="button"
                  className="touch-action-button touch-power-button"
                  aria-label={`Use power-up slot ${slotIndex + 1}`}
                  disabled={!storedPowerUps[slotIndex]}
                  onClick={() => onPowerUp(slotIndex)}
                >
                  P{slotIndex + 1}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function selectNextOwnedWeapon(world) {
  const currentIndex = Math.max(
    0,
    WEAPON_ORDER.indexOf(world.player.weapon),
  );

  for (let offset = 1; offset <= WEAPON_ORDER.length; offset += 1) {
    const nextIndex = (currentIndex + offset) % WEAPON_ORDER.length;
    const nextWeaponKey = WEAPON_ORDER[nextIndex];

    if (
      world.player.ownedWeapons[nextWeaponKey] &&
      nextWeaponKey !== world.player.weapon
    ) {
      return selectWeapon(world, nextWeaponKey);
    }
  }

  return false;
}

export function mergeInputKeys(keyboardKeys, touchKeys) {
  return {
    ...keyboardKeys,
    w: Boolean(keyboardKeys.w || touchKeys.w),
    a: Boolean(keyboardKeys.a || touchKeys.a),
    s: Boolean(keyboardKeys.s || touchKeys.s),
    d: Boolean(keyboardKeys.d || touchKeys.d),
    " ": Boolean(keyboardKeys[" "] || touchKeys[" "]),
  };
}
