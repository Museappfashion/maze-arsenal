import assert from "node:assert/strict";
import test from "node:test";
import { draw3DSky, drawPerspectiveFloor } from "../../src/game/materials3D.js";

const noop = () => {};
function context() {
  return {
    save: noop, restore: noop, fillRect: noop, stroke: noop, beginPath: noop,
    ellipse: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop,
    bezierCurveTo: noop, drawImage: noop,
    createRadialGradient: () => ({ addColorStop: noop }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(40) }),
    putImageData(image) { this.image = image; },
  };
}

test("Orbital's whole walkable route stays translucent over deep space", () => {
  const previous = globalThis.OffscreenCanvas;
  const surfaces = [];
  globalThis.OffscreenCanvas = class {
    constructor(w, h) { this.width = w; this.height = h; this.context = context(); surfaces.push(this); }
    getContext() { return this.context; }
  };
  try {
    const world = { width: 30, height: 30, grid: Array.from({ length: 30 }, () => Array(30).fill(0)), level: { themeKey: "space" }, player: { x: 10.5, y: 10.5, facing: 0 } };
    const collision = JSON.stringify(world.grid);
    drawPerspectiveFloor(context(), world, 80, 120, 100, 45, 24);
    const floor = surfaces.find((s) => s.width === 60 && s.height === 28).context.image.data;
    const alphas = [...floor].filter((_, i) => i % 4 === 3);
    assert.ok(alphas.some((alpha) => alpha === 58), "stars remain visible beneath every interior route pixel");
    assert.ok(alphas.every((alpha) => alpha <= 135), "the surface cannot become an opaque moon-like ground");
    assert.equal(JSON.stringify(world.grid), collision);
  } finally { if (previous === undefined) delete globalThis.OffscreenCanvas; else globalThis.OffscreenCanvas = previous; }
});

test("the deep Orbital nebula changes parallax while walking and returns after a full turn", () => {
  const previous = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = class { constructor() { this.context = context(); } getContext() { return this.context; } };
  try {
    const world = { width: 30, height: 30, grid: [], level: { themeKey: "space" }, player: { x: 10.5, y: 10.5, facing: 0 } };
    const draw = () => {
      const gradients = [], ctx = context();
      ctx.createRadialGradient = (...args) => { gradients.push(args); return { addColorStop: noop }; };
      draw3DSky(ctx, world, 120, 45, 100); return gradients;
    };
    const original = draw(); assert.ok(original.length > 0, "deep clouds are visible from the initial camera");
    world.player.x += 1;
    assert.notDeepEqual(draw(), original, "clouds have world positions rather than screen positions");
    world.player.x -= 1; world.player.facing = Math.PI * 2;
    const fullTurn = draw(); assert.equal(fullTurn.length, original.length);
    for (let i = 0; i < original.length; i++) for (let j = 0; j < original[i].length; j++) assert.ok(Math.abs(fullTurn[i][j] - original[i][j]) < 1e-8);
  } finally { if (previous === undefined) delete globalThis.OffscreenCanvas; else globalThis.OffscreenCanvas = previous; }
});
