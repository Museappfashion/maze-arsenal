// src/features/minimapEnhancement.js

import {
  STEEL_WALL,
  WALL,
} from "../config/constants.js";
import {
  getTheme,
} from "../config/presentations.js";
import {
  hasPowerUp,
} from "../game/gameplay.js";

const INSTALLED_KEY =
  "__mistMazeMinimapEnhancementInstalled";

const OVERLAY_CLASS =
  "mist-stable-minimap-overlay";

const STYLE_ID =
  "mist-stable-minimap-style";

const DIRECTION_COUNT = 16;

const DIRECTION_STEP =
  Math.PI *
  2 /
  DIRECTION_COUNT;

function quantizeFacing(
  facing,
) {
  const angle =
    Number.isFinite(
      facing,
    )
      ? facing
      : 0;

  return (
    Math.round(
      angle /
      DIRECTION_STEP,
    ) *
    DIRECTION_STEP
  );
}

function normalizedText(
  element,
) {
  return (
    element?.textContent
      ?.trim()
      .toLowerCase() ??
    ""
  );
}

function isMinimapCanvas(
  canvas,
) {
  if (
    canvas.classList.contains(
      OVERLAY_CLASS,
    ) ||
    canvas.closest(
      ".maze-frame",
    )
  ) {
    return false;
  }

  if (
    canvas.closest(
      ".labyrinth-locator",
    ) ||
    canvas.closest(
      ".mobile-minimap-wrap",
    )
  ) {
    return true;
  }

  const section =
    canvas.closest(
      "section",
    );

  return (
    normalizedText(
      section?.querySelector(
        "h1, h2, h3",
      ),
    ) ===
    "minimap"
  );
}

function getMinimapShell(
  baseCanvas,
) {
  return (
    baseCanvas.closest(
      ".labyrinth-locator",
    ) ||
    baseCanvas.closest(
      ".mobile-minimap-wrap",
    ) ||
    baseCanvas.closest(
      "section",
    ) ||
    baseCanvas.parentElement
  );
}

function ensureStyle() {
  if (
    document.getElementById(
      STYLE_ID,
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style",
    );

  style.id = STYLE_ID;

  style.textContent = `
    .${OVERLAY_CLASS} {
      position: absolute;
      inset: 0;
      z-index: 2;
      width: 100%;
      height: 100%;
      pointer-events: none;
      image-rendering: pixelated;
    }

    [data-mist-stable-minimap-host="1"] {
      position: relative !important;
    }

    [data-mist-minimap-base-hidden="1"] {
      visibility: hidden !important;
    }

    html[data-mist-minimap-enabled="false"]
      [data-mist-minimap-shell="1"] {
      display: none !important;
    }
  `;

  document.head.append(
    style,
  );
}

function markShell(
  baseCanvas,
) {
  const shell =
    getMinimapShell(
      baseCanvas,
    );

  if (shell) {
    shell.dataset
      .mistMinimapShell =
      "1";
  }

  return shell;
}

function ensureOverlay(
  baseCanvas,
) {
  const parent =
    baseCanvas.parentElement;

  if (!parent) {
    return null;
  }

  markShell(
    baseCanvas,
  );

  parent.dataset
    .mistStableMinimapHost =
    "1";

  baseCanvas.dataset
    .mistMinimapBaseHidden =
    "1";

  let overlay =
    parent.querySelector(
      `:scope > .${OVERLAY_CLASS}`,
    );

  if (!overlay) {
    overlay =
      document.createElement(
        "canvas",
      );

    overlay.className =
      OVERLAY_CLASS;

    overlay.setAttribute(
      "aria-hidden",
      "true",
    );

    parent.append(
      overlay,
    );
  }

  const width =
    Math.max(
      1,
      baseCanvas.width,
    );

  const height =
    Math.max(
      1,
      baseCanvas.height,
    );

  if (
    overlay.width !== width ||
    overlay.height !== height
  ) {
    overlay.width = width;
    overlay.height = height;
  }

  return overlay;
}

function drawDirectionArrow(
  ctx,
  x,
  y,
  facing,
  size,
) {
  ctx.save();

  ctx.translate(
    x,
    y,
  );

  ctx.rotate(
    quantizeFacing(
      facing,
    ),
  );

  ctx.shadowColor =
    "#38bdf8";

  ctx.shadowBlur =
    Math.max(
      3,
      size * 0.8,
    );

  ctx.fillStyle =
    "#38bdf8";

  ctx.strokeStyle =
    "#e0f2fe";

  ctx.lineWidth =
    Math.max(
      1,
      size * 0.13,
    );

  ctx.lineJoin =
    "round";

  ctx.beginPath();

  ctx.moveTo(
    size,
    0,
  );

  ctx.lineTo(
    -size * 0.62,
    -size * 0.58,
  );

  ctx.lineTo(
    -size * 0.32,
    0,
  );

  ctx.lineTo(
    -size * 0.62,
    size * 0.58,
  );

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawExit(
  ctx,
  x,
  y,
  size,
) {
  ctx.save();

  ctx.shadowColor =
    "#22c55e";

  ctx.shadowBlur =
    Math.max(
      3,
      size,
    );

  ctx.fillStyle =
    "#22c55e";

  ctx.fillRect(
    x - size / 2,
    y - size / 2,
    size,
    size,
  );

  ctx.restore();
}

function drawLabyrinthLocator(
  ctx,
  canvas,
  world,
) {
  const width =
    canvas.width;

  const height =
    canvas.height;

  ctx.fillStyle =
    "#010204";

  ctx.fillRect(
    0,
    0,
    width,
    height,
  );

  const padding =
    Math.min(
      width,
      height,
    ) *
    0.075;

  const usableWidth =
    width -
    padding * 2;

  const usableHeight =
    height -
    padding * 2;

  const pointFor = (
    x,
    y,
  ) => ({
    x:
      padding +
      x /
        Math.max(
          1,
          world.width,
        ) *
        usableWidth,
    y:
      padding +
      y /
        Math.max(
          1,
          world.height,
        ) *
        usableHeight,
  });

  const exit =
    pointFor(
      world.exit.x + 0.5,
      world.exit.y + 0.5,
    );

  const player =
    pointFor(
      world.player.x,
      world.player.y,
    );

  const markerSize =
    Math.max(
      4,
      Math.min(
        width,
        height,
      ) *
      0.035,
    );

  drawExit(
    ctx,
    exit.x,
    exit.y,
    markerSize,
  );

  drawDirectionArrow(
    ctx,
    player.x,
    player.y,
    world.player.facing,
    markerSize * 1.4,
  );
}

function drawNormalMinimap(
  ctx,
  canvas,
  world,
) {
  const width =
    canvas.width;

  const height =
    canvas.height;

  const cellWidth =
    width /
    Math.max(
      1,
      world.width,
    );

  const cellHeight =
    height /
    Math.max(
      1,
      world.height,
    );

  const theme =
    getTheme(world);

  ctx.fillStyle =
    theme.backdrop ??
    "#020617";

  ctx.fillRect(
    0,
    0,
    width,
    height,
  );

  for (
    let y = 0;
    y < world.height;
    y += 1
  ) {
    for (
      let x = 0;
      x < world.width;
      x += 1
    ) {
      const discovered =
        world.discovered?.[
          y *
            world.width +
          x
        ] === 1;

      if (!discovered) {
        ctx.fillStyle =
          theme.backdrop ??
          "#020617";
      } else if (
        world.grid?.[y]?.[x] ===
        STEEL_WALL
      ) {
        ctx.fillStyle =
          theme.steelA ??
          "#7c8794";
      } else if (
        world.grid?.[y]?.[x] ===
        WALL
      ) {
        ctx.fillStyle =
          theme.wallB ??
          "#475569";
      } else {
        ctx.fillStyle =
          theme.floorB ??
          "#1e293b";
      }

      ctx.fillRect(
        x * cellWidth,
        y * cellHeight,
        Math.ceil(
          cellWidth,
        ),
        Math.ceil(
          cellHeight,
        ),
      );
    }
  }

  drawExit(
    ctx,
    (
      world.exit.x +
      0.5
    ) *
      cellWidth,
    (
      world.exit.y +
      0.5
    ) *
      cellHeight,
    Math.max(
      3,
      Math.min(
        cellWidth,
        cellHeight,
      ) *
      1.35,
    ),
  );

  if (
    hasPowerUp(
      world,
      "sonar",
    )
  ) {
    for (
      const enemy of
      world.enemies ?? []
    ) {
      ctx.fillStyle =
        enemy.kind ===
        "warden"
          ? "#f472b6"
          : enemy.kind ===
              "turret"
            ? "#facc15"
            : "#ef4444";

      ctx.fillRect(
        (
          enemy.x -
          0.25
        ) *
          cellWidth,
        (
          enemy.y -
          0.25
        ) *
          cellHeight,
        Math.max(
          2,
          cellWidth * 0.5,
        ),
        Math.max(
          2,
          cellHeight * 0.5,
        ),
      );
    }
  }

  drawDirectionArrow(
    ctx,
    world.player.x *
      cellWidth,
    world.player.y *
      cellHeight,
    world.player.facing,
    Math.max(
      4.5,
      Math.min(
        9,
        Math.min(
          cellWidth,
          cellHeight,
        ) *
        2.2,
      ),
    ),
  );
}

function renderCanvas(
  baseCanvas,
  world,
) {
  const overlay =
    ensureOverlay(
      baseCanvas,
    );

  if (!overlay) {
    return;
  }

  const ctx =
    overlay.getContext(
      "2d",
    );

  if (!ctx) {
    return;
  }

  ctx.clearRect(
    0,
    0,
    overlay.width,
    overlay.height,
  );

  if (
    world.labyrinthMode
  ) {
    drawLabyrinthLocator(
      ctx,
      overlay,
      world,
    );

    return;
  }

  drawNormalMinimap(
    ctx,
    overlay,
    world,
  );
}

function markExistingMinimaps() {
  for (
    const canvas of
    document.querySelectorAll(
      "canvas",
    )
  ) {
    if (
      isMinimapCanvas(
        canvas,
      )
    ) {
      markShell(
        canvas,
      );
    }
  }
}

function restoreBaseCanvases() {
  for (
    const canvas of
    document.querySelectorAll(
      '[data-mist-minimap-base-hidden="1"]',
    )
  ) {
    delete canvas.dataset
      .mistMinimapBaseHidden;
  }

  for (
    const host of
    document.querySelectorAll(
      '[data-mist-stable-minimap-host="1"]',
    )
  ) {
    delete host.dataset
      .mistStableMinimapHost;
  }

  for (
    const shell of
    document.querySelectorAll(
      '[data-mist-minimap-shell="1"]',
    )
  ) {
    delete shell.dataset
      .mistMinimapShell;
  }

  for (
    const overlay of
    document.querySelectorAll(
      `.${OVERLAY_CLASS}`,
    )
  ) {
    overlay.remove();
  }
}

export function installMinimapEnhancement() {
  if (
    typeof document ===
      "undefined" ||
    globalThis[
      INSTALLED_KEY
    ]
  ) {
    return () => {};
  }

  globalThis[
    INSTALLED_KEY
  ] = true;

  ensureStyle();

  let active = true;
  let frameId = 0;

  const loop = () => {
    if (!active) {
      return;
    }

    const world =
      globalThis
        .__mistMazeWorld;

    markExistingMinimaps();

    const minimapEnabled =
      globalThis
        .__mistMazeMinimapEnabled !==
      false;

    if (
      world &&
      minimapEnabled
    ) {
      for (
        const canvas of
        document.querySelectorAll(
          "canvas",
        )
      ) {
        if (
          isMinimapCanvas(
            canvas,
          )
        ) {
          renderCanvas(
            canvas,
            world,
          );
        }
      }
    }

    frameId =
      window
        .requestAnimationFrame(
          loop,
        );
  };

  frameId =
    window
      .requestAnimationFrame(
        loop,
      );

  return () => {
    active = false;

    if (frameId) {
      window
        .cancelAnimationFrame(
          frameId,
        );
    }

    restoreBaseCanvases();

    document
      .getElementById(
        STYLE_ID,
      )
      ?.remove();

    globalThis[
      INSTALLED_KEY
    ] = false;
  };
}
