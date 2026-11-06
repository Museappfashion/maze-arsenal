import { drawTurkeyCosmeticBody, drawCharacterHeadwear } from "./turkeyCosmetic.js";

function shape(c, points, fill, stroke = "#020617", width = .12) {
  c.beginPath();
  points.forEach(([x, y], index) => index ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath(); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}

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

function drawThemeAdornment(c, theme, accent) {
  if (theme === "space") {
    c.save(); c.rotate(-.35); c.strokeStyle = accent; c.lineWidth = .06;
    c.beginPath(); c.ellipse(0, 0, 1.27, .58, 0, 0, Math.PI * 2); c.stroke();
    ellipse(c, -.89, -.4, .09, .09, "#e0f2fe");
    ellipse(c, .91, .4, .065, .065, accent); c.restore();
  } else if (theme === "jungle") {
    shape(c, [[-.26, -.83], [-.66, -1.12], [-.62, -.72]], "#4d7c0f");
    shape(c, [[-.26, -.83], [.02, -1.14], [.08, -.77]], "#86b741");
    c.strokeStyle = "#d9f99d"; c.lineWidth = .035;
    c.beginPath(); c.moveTo(-.28, -.8); c.lineTo(-.55, -1); c.moveTo(-.25, -.81); c.lineTo(-.02, -1.03); c.stroke();
  } else if (theme === "medieval") {
    shape(c, [[-.53, -.72], [-.34, -.98], [-.15, -.76], [.08, -.98], [.3, -.69]], "#94a3b8");
    c.strokeStyle = "#e2e8f0"; c.lineWidth = .05;
    c.beginPath(); c.moveTo(-.53, -.68); c.quadraticCurveTo(-.1, -.52, .36, -.67); c.stroke();
  }
}

export function drawShadowWispBody(c, theme, radius) {
  c.save(); c.shadowBlur = 0; c.scale(radius, radius);
  ellipse(c, -.08, .25, .97, .58, "#00000045");
  const body = c.createRadialGradient(.38, -.28, .03, 0, 0, 1.4);
  body.addColorStop(0, "#b6a6ee"); body.addColorStop(.5, "#67518d"); body.addColorStop(1, "#211d38");
  c.beginPath(); c.moveTo(1, 0); c.bezierCurveTo(.9, -.82, .04, -1.02, -.5, -.54);
  c.bezierCurveTo(-.93, -.28, -1.3, -.72, -1.48, -.56); c.quadraticCurveTo(-1.18, -.06, -.82, -.07);
  c.quadraticCurveTo(-1.3, .2, -1.28, .58); c.quadraticCurveTo(-.67, .2, -.55, .49);
  c.bezierCurveTo(-.1, 1, .94, .75, 1, 0); c.closePath();
  c.fillStyle = body; c.fill(); c.strokeStyle = "#020617"; c.lineWidth = .14; c.stroke();
  ellipse(c, .53, -.28, .15, .22, "#e2e8f0", -.25);
  ellipse(c, .6, .23, .13, .2, "#e2e8f0", .18);
  ellipse(c, -.58, -.72, .065, .065, "#a78bfa");
  ellipse(c, -.88, .75, .045, .045, "#c4b5fd");
  drawThemeAdornment(c, theme, "#a5b4fc"); c.restore();
}

export function drawEmberSpiritBody(c, theme, radius) {
  c.save(); c.shadowBlur = 0; c.scale(radius, radius);
  const stellar = theme === "space";
  const outer = stellar ? "#1e7fb5" : "#b94324", middle = stellar ? "#55c8ef" : "#f98b35", core = stellar ? "#d4f9ff" : "#ffe6a1";
  ellipse(c, -.06, .22, 1.04, .65, "#00000045");
  c.beginPath(); c.moveTo(1.02, -.02); c.bezierCurveTo(.92, -.62, .48, -.8, -.01, -.72);
  c.quadraticCurveTo(-.5, -.78, -.83, -1.13); c.quadraticCurveTo(-.99, -.74, -.61, -.47);
  c.quadraticCurveTo(-1.16, -.49, -1.42, -.13); c.quadraticCurveTo(-.9, -.2, -.7, .02);
  c.quadraticCurveTo(-1.23, .33, -1.32, .82); c.quadraticCurveTo(-.72, .5, -.34, .63);
  c.bezierCurveTo(.22, .97, .92, .66, 1.02, -.02); c.closePath();
  c.fillStyle = outer; c.fill(); c.strokeStyle = "#020617"; c.lineWidth = .14; c.stroke();
  c.beginPath(); c.moveTo(.86, -.04); c.bezierCurveTo(.69, -.61, .1, -.64, -.29, -.4);
  c.lineTo(-.86, -.6); c.lineTo(-.53, -.07); c.lineTo(-.9, .44);
  c.bezierCurveTo(-.28, .25, -.2, .65, .34, .58); c.quadraticCurveTo(.86, .41, .86, -.04);
  c.fillStyle = middle; c.fill();
  ellipse(c, .4, 0, .42, .51, "#302a32");
  ellipse(c, .58, -.24, .12, .18, core, -.25); ellipse(c, .62, .22, .1, .16, core, .2);
  shape(c, [[-.56, -.21], [-.86, -.37], [-.7, -.04]], core, null);
  ellipse(c, -.91, .72, .055, .055, middle); ellipse(c, -1.24, -.71, .04, .04, core);
  drawThemeAdornment(c, theme, "#bae6fd"); c.restore();
}

export function drawCrystalGuardianBody(c, theme, radius) {
  c.save(); c.shadowBlur = 0; c.scale(radius, radius);
  const palette = theme === "jungle" ? ["#a7f3d0", "#34ad81", "#18584f", "#e2fff1"]
    : theme === "medieval" ? ["#ddd6fe", "#8b6ac2", "#493563", "#f5f3ff"]
      : theme === "space" ? ["#bae6fd", "#549acb", "#264e7a", "#e0faff"]
        : ["#cffafe", "#64b8c6", "#306977", "#ecfeff"];
  ellipse(c, -.05, .23, 1.04, .71, "#00000050");
  shape(c, [[-.2, -.43], [-.76, -1.02], [-1.08, -.5], [-.65, -.12]], palette[1]);
  shape(c, [[-.2, .4], [-.68, 1.04], [-1.09, .56], [-.68, .1]], palette[2]);
  shape(c, [[1.08, 0], [.58, -.7], [-.28, -.8], [-.78, -.18], [-.51, .64], [.4, .78]], palette[1]);
  shape(c, [[1.08, 0], [.58, -.7], [.12, -.3], [.2, .26]], palette[0], "#020617", .06);
  shape(c, [[1.08, 0], [.2, .26], [.4, .78]], palette[2], "#020617", .06);
  shape(c, [[.12, -.3], [-.28, -.8], [-.78, -.18], [-.33, .05]], palette[0], "#020617", .06);
  shape(c, [[.2, .26], [-.33, .05], [-.51, .64], [.4, .78]], palette[1], "#020617", .06);
  shape(c, [[.61, -.34], [.85, -.16], [.58, -.12]], "#102c3a", null);
  shape(c, [[.65, .18], [.88, .3], [.58, .39]], "#102c3a", null);
  c.strokeStyle = palette[3]; c.lineWidth = .04;
  c.beginPath(); c.moveTo(-.18, -.63); c.lineTo(-.51, -.2); c.moveTo(.4, -.59); c.lineTo(.62, -.43); c.stroke();
  drawThemeAdornment(c, theme, palette[0]); c.restore();
}

export function drawCharacterCosmeticBody(ctx, theme, radius, cosmetic) {
  if (cosmetic === "alien") drawAlienCosmeticBody(ctx, theme, radius);
  else if (cosmetic === "turkey") drawTurkeyCosmeticBody(ctx, theme, radius);
  else if (cosmetic === "shadowWisp") drawShadowWispBody(ctx, theme, radius);
  else if (cosmetic === "emberSpirit") drawEmberSpiritBody(ctx, theme, radius);
  else if (cosmetic === "crystalGuardian") drawCrystalGuardianBody(ctx, theme, radius);
}
