import { get3DMaterialData } from "./materials3D.js";

// Stone, concrete and forest weathering come from the main maze materials.
// Coordinates are world positions, so surfaces remain fixed while looking,
// walking or crossing a ramp. Navigation accents are deliberately separate.
let shared;
const clampByte = (n) => Math.max(0, Math.min(255, Math.round(n)));
const pack = (r, g, b) => (clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b);
const hash = (x, y) => {
  let n = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
};

function fallback(key) {
  const floor = new Uint8ClampedArray(128 * 128 * 4), wall = new Uint8ClampedArray(128 * 192 * 4);
  const base = key === "jungle" ? [42, 60, 31] : key === "city" ? [58, 63, 67] : [83, 78, 68];
  for (let y = 0; y < 192; y++) for (let x = 0; x < 128; x++) {
    const grain = (hash(x, y) % 17) - 8, i = (y * 128 + x) * 4;
    const seam = y % 24 < 2 || (x + (Math.floor(y / 24) % 2) * 21) % 42 < 2;
    const color = seam ? [45, 43, 37] : [111 + grain, 107 + grain, 96 + grain];
    wall.set([...color, 255], i);
    if (y < 128) {
      const line = key === "medieval" && (x % 45 < 2 || y % 39 < 2) ? -25 : 0;
      floor.set([base[0] + grain + line, base[1] + grain + line, base[2] + grain + line, 255], i);
    }
  }
  return { floor, floorWidth: 128, floorHeight: 128, wall, wallWidth: 128, wallHeight: 192 };
}
function textures() {
  if (!shared) shared = Object.fromEntries(["city", "jungle", "medieval"].map((key) => [key, get3DMaterialData(key) || fallback(key)]));
  return shared;
}
function texel(data, width, height, u, v) {
  const x = ((Math.floor(u) % width) + width) % width;
  const y = ((Math.floor(v) % height) + height) % height;
  return (y * width + x) * 4;
}

/** Returns packed RGB without allocating during the pixel raster loop. */
export function cubeMaterialColor(material, x, y, z) {
  const maps = textures();
  const u = x * (material.dx ?? 1) + y * (material.dy ?? 0);
  const across = -x * (material.dy ?? 0) + y * (material.dx ?? 1);
  const floorZ = (material.baseZ || 0) + (u - (material.baseU || 0)) * (material.slope || 0);
  const localHeight = z - floorZ;
  const grain = (hash(Math.floor(u * 31), Math.floor((across + z) * 31)) % 9) - 4;
  if (material.surface === "rampMark") return pack(161 + grain, 145 + grain, 90 + grain);
  if (material.surface === "trim") return pack(91 + grain, 93 + grain, 78 + grain);
  if (material.surface === "floor" || material.surface === "ceiling") {
    const stone = maps.medieval, city = maps.city, forest = maps.jungle;
    const i = texel(stone.floor, 128, 128, x * 20, y * 20), j = texel(city.floor, 128, 128, x * 32, y * 32);
    const edge = material.surface === "floor" && Math.abs(across - (material.centerAcross || 0)) > (material.width || 3) / 2 - .28;
    const moss = edge && hash(Math.floor(u * 5), Math.floor(across * 5)) % 5 !== 0;
    if (moss) {
      const k = texel(forest.floor, 128, 128, x * 32, y * 32);
      return pack(forest.floor[k] * .9 + 8, forest.floor[k + 1] * .94 + 7, forest.floor[k + 2] * .85 + 6);
    }
    const darken = material.surface === "ceiling" ? .66 : 1;
    return pack((stone.floor[i] * .78 + city.floor[j] * .22) * darken, (stone.floor[i + 1] * .78 + city.floor[j + 1] * .22) * darken, (stone.floor[i + 2] * .78 + city.floor[j + 2] * .22) * darken);
  }
  const stone = maps.medieval;
  const i = texel(stone.wall, stone.wallWidth, stone.wallHeight, u * 48, localHeight * 64);
  // Concrete piers break up the main game's large stone courses. Their grain
  // uses the City asphalt sampler; moss at the foot uses the Wilds greens.
  const pier = Math.floor((u + .22) / 6) !== Math.floor((u - .22) / 6);
  let r = stone.wall[i], g = stone.wall[i + 1], b = stone.wall[i + 2];
  if (pier) {
    const city = maps.city, j = texel(city.floor, 128, 128, u * 48, localHeight * 64);
    r = city.floor[j] + 39; g = city.floor[j + 1] + 35; b = city.floor[j + 2] + 27;
  }
  if (localHeight < .43 && hash(Math.floor(u * 8), Math.floor(z * 8)) % 4) return pack(r * .53 + 8, g * .67 + 12, b * .43 + 3);
  return pack(r * .88 + g * .12, g * .94 + r * .06, b * .93 + g * .07);
}
