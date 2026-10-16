// Canvas geometry from the approved full-turkey preview. Headwear is the only clothing.
const TAU = Math.PI * 2;
  function ellipse(c,x,y,rx,ry,fill,stroke='#020617',width=.12,rotation=0) {
    c.beginPath(); c.ellipse(x,y,rx,ry,rotation,0,TAU); c.fillStyle=fill; c.fill();
    if(stroke) {c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
  }
  function path(c,points,fill,stroke='#020617',width=.12) {
    c.beginPath(); c.moveTo(points[0][0],points[0][1]);
    for(const p of points.slice(1)) c.lineTo(p[0],p[1]);
    c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
  }

export function drawTurkeyCosmeticBody(c, theme, radius) {
  c.save();
  c.shadowBlur = 0;
  c.scale(radius, radius);
    ellipse(c,0,.08,1.2,.8,'#00000050',null);
    for(let i=0;i<7;i++) {
      const a=(i-3)*.29;
      const fx=-.52-Math.cos(a)*.45,fy=Math.sin(a)*.74;
      ellipse(c,fx,fy,.66,.19,i%2?'#783f24':'#a06532','#020617',.085,-a);
      ellipse(c,fx-Math.cos(a)*.43,fy+Math.sin(a)*.14,.16,.15,i%2?'#e5bb78':'#d28b43','#301d15',.045,-a);
      c.strokeStyle='#2d201a';c.lineWidth=.07;c.beginPath();c.moveTo(fx-.22*Math.cos(a),fy+.1*Math.sin(a));c.lineTo(fx+.38*Math.cos(a),fy-.17*Math.sin(a));c.stroke();
    }
    c.strokeStyle='#e4a445';c.lineWidth=.105;c.lineCap='round';c.beginPath();
    c.moveTo(-.12,-.43);c.lineTo(.22,-.67);c.lineTo(.4,-.66);
    c.moveTo(-.12,.43);c.lineTo(.22,.67);c.lineTo(.4,.66);c.stroke();
    const body=c.createLinearGradient(-.7,-.6,.6,.5);body.addColorStop(0,'#a06f43');body.addColorStop(.45,'#734b31');body.addColorStop(1,'#3c2c22');
    ellipse(c,-.18,0,.79,.61,body,'#020617',.14);
    ellipse(c,-.27,-.34,.49,.2,'#9d6337','#3b281e',.065,.12);
    ellipse(c,-.27,.34,.49,.2,'#b17b43','#3b281e',.065,-.12);
    c.strokeStyle='#d1a15f';c.lineWidth=.04;c.beginPath();c.moveTo(-.65,.3);c.quadraticCurveTo(-.3,.57,.11,.33);c.stroke();
    // Full body stays uncovered: each theme adds only the requested headwear.
    drawCharacterHeadwear(c, theme, "back");
    const head=c.createRadialGradient(.62,-.19,.02,.7,0,.51);head.addColorStop(0,'#d0e0d7');head.addColorStop(.5,'#96b4b5');head.addColorStop(1,'#557381');
    ellipse(c,.61,0,.39,.43,head,'#020617',.085);
    path(c,[[.9,-.12],[1.27,.02],[.91,.19]],'#f4c15f','#4b351d',.06);
    c.fillStyle='#cf514b';c.strokeStyle='#6e2527';c.lineWidth=.045;c.beginPath();
    c.moveTo(.86,.15);c.bezierCurveTo(1.13,.48,.88,.7,.75,.43);c.bezierCurveTo(.71,.31,.81,.29,.86,.15);c.fill();c.stroke();
    ellipse(c,.79,-.17,.068,.077,'#101a21',null);
    ellipse(c,.811,-.196,.018,.02,'#ffffff',null);
    drawCharacterHeadwear(c, theme);
  c.restore();
}

export function drawCharacterHeadwear(c, theme, layer = "front") {
  if (layer === "back") {
    if(theme==='space') {
      const shell=c.createLinearGradient(.23,-.65,1.5,.6);shell.addColorStop(0,'#e2e8f0');shell.addColorStop(.55,'#94a3b8');shell.addColorStop(1,'#475569');
      ellipse(c,.7,0,.71,.68,shell,'#020617',.12);
      ellipse(c,.79,0,.59,.56,'#164e63','#cffafe',.055);
    }
    return;
  }
    if(theme==='space') {
      // Glass and white helmet rim enclose the head, leaving feathers exposed.
      ellipse(c,.79,0,.59,.56,'#67e8f90c','#cffafe',.045);
      c.strokeStyle='#ecfeff9c';c.lineWidth=.055;c.beginPath();c.ellipse(.78,-.02,.49,.48,0,3.4,4.7);c.stroke();
      ellipse(c,.18,-.01,.15,.21,'#475569','#e2e8f0',.045);
      ellipse(c,.18,-.01,.065,.09,'#22d3ee',null);
      c.strokeStyle='#cbd5e1';c.lineWidth=.07;c.beginPath();c.moveTo(.3,.45);c.quadraticCurveTo(.62,.69,.98,.51);c.stroke();
    } else if(theme==='jungle') {
      // The main game's khaki explorer hat palette and dark outlines.
      ellipse(c,.52,-.3,.58,.33,'#d6b06f','#020617',.085,-.14);
      const hat=c.createLinearGradient(.2,-.69,.8,-.1);hat.addColorStop(0,'#bec579');hat.addColorStop(.5,'#76893d');hat.addColorStop(1,'#365314');
      ellipse(c,.48,-.42,.39,.27,hat,'#263719',.065,-.14);
      c.strokeStyle='#713f12';c.lineWidth=.085;c.beginPath();c.ellipse(.49,-.37,.35,.17,-.14,.05,3.1);c.stroke();
      path(c,[[.2,-.55],[.02,-.83],[.27,-.72],[.39,-.53]],'#65a30d','#365314',.045);
      c.strokeStyle='#d6b06f';c.lineWidth=.03;c.beginPath();c.moveTo(.14,-.77);c.lineTo(.34,-.51);c.stroke();
    } else if(theme==='medieval') {
      const steel=c.createLinearGradient(.1,-.62,.92,.32);steel.addColorStop(0,'#f5f5f4');steel.addColorStop(.4,'#c3c3bc');steel.addColorStop(.68,'#787b7e');steel.addColorStop(1,'#44403c');
      c.fillStyle=steel;c.strokeStyle='#020617';c.lineWidth=.095;c.beginPath();
      c.moveTo(.21,.13);c.bezierCurveTo(.04,-.68,.79,-.82,1.02,-.35);c.lineTo(1.01,-.11);c.lineTo(.77,-.13);c.lineTo(.73,.18);c.lineTo(.5,.31);c.lineTo(.21,.13);c.fill();c.stroke();
      c.strokeStyle='#e7e5e4';c.lineWidth=.045;c.beginPath();c.moveTo(.35,-.43);c.quadraticCurveTo(.58,-.64,.82,-.37);c.stroke();
      path(c,[[.73,-.29],[1.02,-.24],[1.04,-.08],[.76,-.12]],'#44403c','#c3c3bc',.045);
      c.strokeStyle='#e7e5e4';c.lineWidth=.025;c.beginPath();c.moveTo(.81,-.24);c.lineTo(.82,-.12);c.moveTo(.9,-.22);c.lineTo(.91,-.1);c.stroke();
      ellipse(c,.47,.15,.045,.045,'#e7e5e4',null);
    }
}
