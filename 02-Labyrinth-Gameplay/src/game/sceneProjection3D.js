import { CANVAS_WIDTH, CANVAS_HEIGHT, VIEW_3D_FOV } from "../config/constants.js";

export const SCENE_EYE_HEIGHT = .5;
export const SCENE_NEAR_PLANE = .08;
export const SCENE_HORIZON = CANVAS_HEIGHT * .46;
export const SCENE_PROJECTION_PLANE = CANVAS_WIDTH / (2 * Math.tan(VIEW_3D_FOV / 2));

export function sceneScreenY(scale, height = 0) {
  return SCENE_HORIZON + (SCENE_EYE_HEIGHT - height) * scale;
}

export function sceneCameraPoint(camera, point) {
  const dx = point[0] - camera.x, dy = point[1] - camera.y;
  const c = Math.cos(camera.facing), s = Math.sin(camera.facing);
  return [-dx * s + dy * c, point[2] - SCENE_EYE_HEIGHT, dx * c + dy * s];
}

export function projectScenePoint(camera, point, plane = SCENE_PROJECTION_PLANE) {
  const [side, height, depth] = sceneCameraPoint(camera, point);
  if (depth < SCENE_NEAR_PLANE) return null;
  return { screenX: CANVAS_WIDTH / 2 + side * plane / depth, screenY: SCENE_HORIZON - height * plane / depth, depth, scale: plane / depth };
}

export function clipSceneFace(points) {
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[(i + points.length - 1) % points.length], b = points[i];
    const aInside = a[2] >= SCENE_NEAR_PLANE, bInside = b[2] >= SCENE_NEAR_PLANE;
    if (aInside !== bInside) {
      const t = (SCENE_NEAR_PLANE - a[2]) / (b[2] - a[2]);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, SCENE_NEAR_PLANE]);
    }
    if (bInside) result.push(b);
  }
  return result;
}

const BOX_FACES = [
  { indices: [0, 1, 5, 4], shade: .8, normal: [0, -1, 0] },
  { indices: [1, 2, 6, 5], shade: .62, normal: [1, 0, 0] },
  { indices: [2, 3, 7, 6], shade: .9, normal: [0, 1, 0] },
  { indices: [3, 0, 4, 7], shade: .72, normal: [-1, 0, 0] },
  { indices: [4, 5, 6, 7], shade: 1.12, normal: [0, 0, 1] },
  { indices: [3, 2, 1, 0], shade: .45, normal: [0, 0, -1] },
];

// Real box vertices retain perspective, face changes, and natural close-up
// cropping. Screen-size clamps and screen-space rotations cause sliding icons.
export function projectSceneBox(camera, center, options = {}) {
  const { width = .32, height = .32, depth = width, rotation = 0, plane = SCENE_PROJECTION_PLANE } = options;
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const corners = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const vertices = corners.map(([x,y,z]) => [center[0] + x * width / 2 * c - y * depth / 2 * s, center[1] + x * width / 2 * s + y * depth / 2 * c, center[2] + z * height / 2]);
  const faces = [];
  for (const face of BOX_FACES) {
    const n = face.normal;
    const normal = [n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]];
    const faceCenter = face.indices.reduce((a,i) => a.map((v,axis) => v + vertices[i][axis] / 4), [0,0,0]);
    if (normal[0] * (camera.x - faceCenter[0]) + normal[1] * (camera.y - faceCenter[1]) + normal[2] * (SCENE_EYE_HEIGHT - faceCenter[2]) <= 0) continue;
    const polygon = clipSceneFace(face.indices.map((i) => sceneCameraPoint(camera, vertices[i])));
    if (polygon.length < 3) continue;
    const points = polygon.map(([x,y,z]) => [CANVAS_WIDTH / 2 + x * plane / z, SCENE_HORIZON - y * plane / z, z]);
    if (points.every(([x]) => x < 0) || points.every(([x]) => x > CANVAS_WIDTH) || points.every(([,y]) => y < 0) || points.every(([,y]) => y > CANVAS_HEIGHT)) continue;
    faces.push({ points, shade: face.shade, indices: face.indices, depth: points.reduce((sum,p) => sum + p[2],0) / points.length });
  }
  return faces.sort((a,b) => b.depth - a.depth);
}

export function scenePickupShape(world, pickup) {
  const power = pickup.type === "powerup" || pickup.type === "labyrinthBreaker";
  const bob = power ? Math.sin(world.time * 2.4 + pickup.x * 1.7 + pickup.y) * .025 : 0;
  return {
    width: power ? .3 : pickup.type === "weapon" ? .4 : pickup.type === "medkit" ? .34 : .28,
    height: power ? .3 : pickup.type === "medkit" ? .25 : .2,
    depth: power ? .3 : .24,
    heightAboveGround: power ? .23 + bob : pickup.type === "medkit" ? .145 : .13,
    rotation: power ? world.time * .55 + pickup.x : pickup.type === "weapon" ? .3 : 0,
  };
}

export function sceneFaceDepthAt(face, x, y) {
  const a = face.points[0];
  for (let i = 1; i < face.points.length - 1; i++) {
    const b = face.points[i], c = face.points[i + 1];
    const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(denominator) < 1e-9) continue;
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / denominator;
    const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / denominator;
    const w = 1 - u - v;
    if (Math.min(u,v,w) >= -.0001) return 1 / (u / a[2] + v / b[2] + w / c[2]);
  }
  return Infinity;
}
