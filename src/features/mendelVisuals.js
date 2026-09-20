// src/features/mendelVisuals.js

import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DRAW_TILE,
  VIEW_3D_FOV,
} from "../config/constants.js";
import {
  applyCharacterWorldProfile,
  isMendelWorld,
} from "../config/characterProfiles.js";

import {
  getCamera,
  getWorldRenderZoom,
  visibleStrengthAt,
} from "../game/gameplay.js";
import {
  hasLineOfSight,
} from "../game/maze.js";

const CANVAS_ID =
  "mist-mendel-visual-canvas";

const INSTALLED_KEY =
  "__mistMazeMendelVisualsInstalled";

function clamp(
  value,
  min,
  max,
) {
  return Math.max(
    min,
    Math.min(
      max,
      value,
    ),
  );
}

function hash(
  x,
  y,
  salt = 0,
) {
  let value =
    Math.imul(
      x +
        37 +
        salt * 19,
      374761393,
    ) ^
    Math.imul(
      y +
        71 +
        salt * 31,
      668265263,
    );

  value =
    Math.imul(
      value ^
        (value >>> 13),
      1274126177,
    );

  value ^=
    value >>> 16;

  return (
    (value >>> 0) /
    4294967295
  );
}

function distance(
  left,
  right,
) {
  return (
    Math.abs(
      left.x -
      right.x,
    ) +
    Math.abs(
      left.y -
      right.y,
    )
  );
}

function buildTrailCache(
  world,
) {
  const candidates =
    (
      world.floorTiles ??
      []
    )
      .filter(
        (tile) => {
          if (
            tile.x <= 1 ||
            tile.y <= 1 ||
            tile.x >=
              world.width -
                2 ||
            tile.y >=
              world.height -
                2
          ) {
            return false;
          }

          if (
            world.start &&
            distance(
              tile,
              world.start,
            ) < 8
          ) {
            return false;
          }

          if (
            world.exit &&
            distance(
              tile,
              world.exit,
            ) < 5
          ) {
            return false;
          }

          return true;
        },
      )
      .sort(
        (left, right) =>
          hash(
            right.x,
            right.y,
            770,
          ) -
          hash(
            left.x,
            left.y,
            770,
          ),
      );

  const shrubs = [];

  for (
    const tile of
    candidates
  ) {
    if (
      shrubs.length >= 28
    ) {
      break;
    }

    if (
      shrubs.some(
        (other) =>
          distance(
            tile,
            other,
          ) < 5,
      )
    ) {
      continue;
    }

    shrubs.push({
      ...tile,
      xCenter:
        tile.x + 0.5,
      yCenter:
        tile.y + 0.5,
      seed:
        Math.floor(
          hash(
            tile.x,
            tile.y,
            771,
          ) *
          100000,
        ),
    });
  }

  world
    .__mendelVisualCache = {
    key:
      `${world.width}x${world.height}`,
    shrubs,
  };

  return world
    .__mendelVisualCache;
}

function getTrailCache(
  world,
) {
  const key =
    `${world.width}x${world.height}`;

  if (
    world
      .__mendelVisualCache
      ?.key === key
  ) {
    return (
      world
        .__mendelVisualCache
    );
  }

  return buildTrailCache(
    world,
  );
}

function ensureCanvas(
  frame,
  base,
) {
  let overlay =
    frame.querySelector(
      `#${CANVAS_ID}`,
    );

  if (!overlay) {
    overlay =
      document
        .createElement(
          "canvas",
        );

    overlay.id =
      CANVAS_ID;

    overlay.setAttribute(
      "aria-hidden",
      "true",
    );

    Object.assign(
      overlay.style,
      {
        position:
          "absolute",
        inset: "0",
        zIndex: "5",
        width: "100%",
        height: "100%",
        pointerEvents:
          "none",
      },
    );

    frame.append(
      overlay,
    );
  }

  if (
    overlay.width !==
      base.width ||
    overlay.height !==
      base.height
  ) {
    overlay.width =
      base.width;

    overlay.height =
      base.height;
  }

  return overlay;
}

function drawYellowShrub(
  ctx,
  size,
  seed,
  time,
) {
  ctx.save();

  const sway =
    Math.sin(
      time * 0.75 +
      seed * 0.01,
    ) *
    size *
    0.025;

  ctx.fillStyle =
    "rgba(43, 35, 10, .24)";

  ctx.beginPath();

  ctx.ellipse(
    0,
    size * 0.2,
    size * 0.55,
    size * 0.16,
    0,
    0,
    Math.PI * 2,
  );

  ctx.fill();

  ctx.strokeStyle =
    "#713f12";

  ctx.lineWidth =
    Math.max(
      1,
      size * 0.035,
    );

  ctx.lineCap =
    "round";

  for (
    let branch = 0;
    branch < 7;
    branch += 1
  ) {
    const angle =
      -Math.PI *
        0.82 +
      branch *
        0.28;

    const length =
      size *
      (
        0.42 +
        hash(
          seed,
          branch,
          91,
        ) *
        0.23
      );

    ctx.beginPath();

    ctx.moveTo(
      sway *
        (branch / 7),
      size * 0.18,
    );

    ctx.lineTo(
      Math.cos(
        angle,
      ) *
        length +
        sway,
      Math.sin(
        angle,
      ) *
        length +
        size * 0.08,
    );

    ctx.stroke();
  }

  const colors = [
    "#facc15",
    "#eab308",
    "#d4a20a",
    "#ca8a04",
    "#fde047",
  ];

  for (
    let leaf = 0;
    leaf < 12;
    leaf += 1
  ) {
    const angle =
      leaf /
        12 *
        Math.PI *
        2;

    const radius =
      size *
      (
        0.25 +
        hash(
          seed,
          leaf,
          92,
        ) *
        0.24
      );

    const x =
      Math.cos(
        angle,
      ) *
        radius +
      sway;

    const y =
      Math.sin(
        angle,
      ) *
        radius *
        0.5;

    ctx.fillStyle =
      colors[
        (
          leaf +
          seed
        ) %
        colors.length
      ];

    ctx.beginPath();

    ctx.ellipse(
      x,
      y,
      size * 0.11,
      size * 0.055,
      angle,
      0,
      Math.PI * 2,
    );

    ctx.fill();
  }

  ctx.restore();
}

function screen2D(
  world,
  x,
  y,
) {
  const camera =
    getCamera(world);

  const scale =
    DRAW_TILE *
    getWorldRenderZoom(
      world,
    );

  return {
    x:
      (
        x -
        camera.x
      ) *
      scale,
    y:
      (
        y -
        camera.y
      ) *
      scale,
    scale,
  };
}

function drawTrail2D(
  ctx,
  world,
) {
  const cache =
    getTrailCache(
      world,
    );

  const time =
    world.time ?? 0;

  ctx.save();

  ctx.fillStyle =
    "rgba(161, 98, 7, .045)";

  ctx.fillRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  );

  ctx.restore();

  for (
    const shrub of
    cache.shrubs
  ) {
    if (
      visibleStrengthAt(
        world,
        shrub.x,
        shrub.y,
      ) < 0.1
    ) {
      continue;
    }

    const screen =
      screen2D(
        world,
        shrub.xCenter,
        shrub.yCenter,
      );

    if (
      screen.x <
        -screen.scale ||
      screen.y <
        -screen.scale ||
      screen.x >
        CANVAS_WIDTH +
          screen.scale ||
      screen.y >
        CANVAS_HEIGHT +
          screen.scale
    ) {
      continue;
    }

    ctx.save();

    ctx.translate(
      screen.x,
      screen.y,
    );

    drawYellowShrub(
      ctx,
      screen.scale *
        0.48,
      shrub.seed,
      time,
    );

    ctx.restore();
  }
}

function normalizeAngle(
  angle,
) {
  let result = angle;

  while (
    result > Math.PI
  ) {
    result -=
      Math.PI * 2;
  }

  while (
    result < -Math.PI
  ) {
    result +=
      Math.PI * 2;
  }

  return result;
}

function project3D(
  world,
  prop,
) {
  const dx =
    prop.xCenter -
    world.player.x;

  const dy =
    prop.yCenter -
    world.player.y;

  const distanceTo =
    Math.hypot(
      dx,
      dy,
    );

  if (
    distanceTo < 0.7 ||
    distanceTo > 12
  ) {
    return null;
  }

  const relative =
    normalizeAngle(
      Math.atan2(
        dy,
        dx,
      ) -
      (
        world.player
          .facing ??
        0
      ),
    );

  if (
    Math.abs(
      relative,
    ) >
    VIEW_3D_FOV *
      0.58
  ) {
    return null;
  }

  if (
    !hasLineOfSight(
      world,
      world.player.x,
      world.player.y,
      prop.xCenter,
      prop.yCenter,
    )
  ) {
    return null;
  }

  const depth =
    distanceTo *
    Math.cos(
      relative,
    );

  if (
    depth <= 0.08
  ) {
    return null;
  }

  const plane =
    CANVAS_WIDTH /
    2 /
    Math.tan(
      VIEW_3D_FOV /
      2,
    );

  return {
    distance:
      distanceTo,
    screenX:
      CANVAS_WIDTH /
        2 +
      Math.tan(
        relative,
      ) *
        plane,
    scale:
      plane /
      depth,
  };
}

function drawTrail3D(
  ctx,
  world,
) {
  const time =
    world.time ?? 0;

  const props =
    getTrailCache(
      world,
    )
      .shrubs
      .map(
        (shrub) => ({
          shrub,
          projection:
            project3D(
              world,
              shrub,
            ),
        }),
      )
      .filter(
        (entry) =>
          entry.projection,
      )
      .sort(
        (left, right) =>
          right.projection
            .distance -
          left.projection
            .distance,
      )
      .slice(
        0,
        14,
      );

  for (
    const {
      shrub,
      projection,
    } of props
  ) {
    ctx.save();

    ctx.translate(
      projection.screenX,
      CANVAS_HEIGHT *
        0.66,
    );

    ctx.globalAlpha =
      clamp(
        1 -
          projection
            .distance /
            15,
        0.3,
        0.9,
      );

    drawYellowShrub(
      ctx,
      clamp(
        projection.scale *
          0.17,
        16,
        92,
      ),
      shrub.seed,
      time,
    );

    ctx.restore();
  }
}

function drawUnder770(
  ctx,
  world,
) {
  const time =
    world.time ?? 0;

  ctx.save();

  ctx.globalCompositeOperation =
    "screen";

  const wash =
    ctx.createLinearGradient(
      0,
      0,
      0,
      CANVAS_HEIGHT,
    );

  wash.addColorStop(
    0,
    "rgba(224,242,254,.12)",
  );

  wash.addColorStop(
    0.55,
    "rgba(186,230,253,.075)",
  );

  wash.addColorStop(
    1,
    "rgba(125,211,252,.035)",
  );

  ctx.fillStyle =
    wash;

  ctx.fillRect(
    0,
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  );

  ctx.strokeStyle =
    "rgba(224,242,254,.13)";

  ctx.lineWidth = 1;

  for (
    let line = 0;
    line < 8;
    line += 1
  ) {
    const y =
      (
        line +
        0.5
      ) /
      8 *
      CANVAS_HEIGHT;

    ctx.beginPath();

    ctx.moveTo(
      0,
      y,
    );

    ctx.lineTo(
      CANVAS_WIDTH,
      y,
    );

    ctx.stroke();
  }

  for (
    let glyph = 0;
    glyph < 11;
    glyph += 1
  ) {
    const x =
      hash(
        glyph,
        4,
        770,
      ) *
      CANVAS_WIDTH;

    const y =
      hash(
        glyph,
        5,
        771,
      ) *
      CANVAS_HEIGHT;

    const pulse =
      0.08 +
      Math.max(
        0,
        Math.sin(
          time * 1.3 +
          glyph,
        ),
      ) *
      0.06;

    ctx.strokeStyle =
      `rgba(240,249,255,${pulse})`;

    ctx.beginPath();

    ctx.moveTo(
      x - 6,
      y,
    );

    ctx.lineTo(
      x,
      y - 6,
    );

    ctx.lineTo(
      x + 6,
      y,
    );

    ctx.lineTo(
      x,
      y + 6,
    );

    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}

function paint() {
  const world =
    globalThis
      .__mistMazeWorld;

  if (!world) {
    return;
  }

  if (
    isMendelWorld(
      world,
    )
  ) {
    applyCharacterWorldProfile(
      world,
    );
  }

  if (
    !world
      .__mendelVisualTheme
  ) {
    return;
  }

  const frame =
    document.querySelector(
      ".maze-frame",
    );

  const base =
    frame?.querySelector(
      `:scope > canvas:not(#${CANVAS_ID})`,
    );

  if (
    !(
      frame instanceof
      HTMLElement
    ) ||
    !(
      base instanceof
      HTMLCanvasElement
    )
  ) {
    return;
  }

  const overlay =
    ensureCanvas(
      frame,
      base,
    );

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

  ctx.save();

  ctx.scale(
    overlay.width /
      CANVAS_WIDTH,
    overlay.height /
      CANVAS_HEIGHT,
  );

  if (
    world
      .__mendelVisualTheme ===
    "under770"
  ) {
    drawUnder770(
      ctx,
      world,
    );
  } else if (
    world
      .__mendelVisualTheme ===
    "trail"
  ) {
    if (
      world.viewMode ===
      "3d"
    ) {
      drawTrail3D(
        ctx,
        world,
      );
    } else {
      drawTrail2D(
        ctx,
        world,
      );
    }
  }

  ctx.restore();
}

export function installMendelVisuals() {
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

  let active = true;
  let frameId = 0;

  const loop = () => {
    if (!active) {
      return;
    }

    paint();

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

    document
      .getElementById(
        CANVAS_ID,
      )
      ?.remove();

    globalThis[
      INSTALLED_KEY
    ] = false;
  };
}
