// Browser-installed artwork joins the main scene's depth-sorted entity pass.
// Keeping registration separate avoids a renderer -> DOM feature dependency.
let collect = null;
export function registerSceneDecorations3D(collector) {
  collect = typeof collector === "function" ? collector : null;
}
export function getSceneDecorations3D(world) {
  return collect?.(world) || [];
}
