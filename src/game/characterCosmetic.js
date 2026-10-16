import { drawTurkeyCosmeticBody, drawCharacterHeadwear } from "./turkeyCosmetic.js";

function ellipse(c, x, y, rx, ry, fill, rotation = 0) {
  c.beginPath(); c.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  c.fillStyle = fill; c.fill();
}

export function drawAlienCosmeticBody(c, theme, radius) {
  c.save(); c.shadowBlur = 0; c.scale(radius, radius);
  ellipse(c, 0, .17, 1.1, .77, "#00000050");
  const body = c.createRadialGradient(.3, -.38, .05, 0, 0, 1.5);
  body.addColorStop(0, "#c4f87c"); body.addColorStop(.4, "#79ca4b"); body.addColorStop(.75, "#389345"); body.addColorStop(1, "#19513b");
  c.beginPath(); c.moveTo(1.03, -.02);
  c.bezierCurveTo(1.1, -.5, .49, -1, -.04, -.83);
  c.bezierCurveTo(-.36, -1.06, -.84, -.8, -.75, -.47);
  c.bezierCurveTo(-1.3, -.38, -1.13, .14, -.85, .24);
  c.bezierCurveTo(-1.16, .72, -.55, 1.02, -.22, .72);
  c.bezierCurveTo(.09, 1.13, .54, .88, .49, .57);
  c.bezierCurveTo(.9, .62, 1.16, .26, 1.03, -.02);
  c.closePath(); c.fillStyle = body; c.fill(); c.strokeStyle = "#020617"; c.lineWidth = .14; c.stroke();
  ellipse(c, -.5, -.32, .16, .09, "#e2ffb365", -.4);
  ellipse(c, -.67, .19, .08, .065, "#2a784975");
  drawCharacterHeadwear(c, theme, "back");
  ellipse(c, .58, -.28, .21, .32, "#0b2425", -.3);
  ellipse(c, .66, .24, .18, .28, "#0b2425", .25);
  ellipse(c, .62, -.37, .055, .075, "#ddfff1", -.3);
  ellipse(c, .7, .17, .04, .06, "#ddfff1");
  c.strokeStyle = "#17432e"; c.lineWidth = .055; c.lineCap = "round";
  c.beginPath(); c.moveTo(.83, -.04); c.quadraticCurveTo(1, .06, .84, .13); c.stroke();
  drawCharacterHeadwear(c, theme);
  c.restore();
}

export function drawCharacterCosmeticBody(ctx, theme, radius, cosmetic) {
  if (cosmetic === "alien") drawAlienCosmeticBody(ctx, theme, radius);
  else drawTurkeyCosmeticBody(ctx, theme, radius);
}
