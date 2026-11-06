import test from "node:test";
import assert from "node:assert/strict";
import { POWER_UPS } from "../../src/config/powerUps.js";
import { DEFENSE_TYPES, DEFENSE_LEVELS, DEFENSE_WAVES, DEFENSE_MAX_LEVEL, DEFENSE_PATH, createDefenseGame, getDefenseLevel, getDefensePath, isDefensePath, isDefenseObstacle, canPlaceDefense, placeDefense, upgradeDefense, defenseUpgradeCost, defenseTowerStats, defenseStatSummary, startDefenseWave, stepDefense, defensePosition } from "../../src/game/towerDefense.js";

function running(type,level=1) {
  const game=createDefenseGame();game.energy=10000;startDefenseWave(game);game.queue=[];game.spawnIn=100;
  if(type){assert.equal(placeDefense(game,type,2,1),true);game.towers[0].level=level;}
  return game;
}
function enemy(game,{x=2.5,y=2.5,distance=2,hp=1000,armor=0,speed=0,...extra}={}) {
  const e={id:game.nextId++,kind:"scout",x,y,distance,hp,maxHp:hp,armor,speed,reward:7,leak:1,slow:1,...extra};game.enemies.push(e);return e;
}
const far=(game)=>enemy(game,{x:15.5,y:10.5,distance:33,hp:1e8});

test("all twenty original powerups are available, with fourteen real damaging defenses",()=>{
  assert.deepEqual(Object.keys(DEFENSE_TYPES).sort(),Object.keys(POWER_UPS).sort());
  assert.equal(Object.values(DEFENSE_TYPES).filter(type=>type.damage>0).length,14);
  for(const key of Object.keys(DEFENSE_TYPES)){
    const a=defenseTowerStats({type:key,level:1}),b=defenseTowerStats({type:key,level:6});
    assert.ok(a.cost>0&&Number.isFinite(a.range));
    assert.ok(defenseStatSummary({type:key,level:6}).length>20);
    if(a.damage)assert.ok(b.damage>a.damage&&b.cooldown<a.cooldown);
  }
});

test("four themed levels have different equal-length continuous routes and nonblocking obstacles",()=>{
  const shapes=new Set();
  for(const [key,level] of Object.entries(DEFENSE_LEVELS)){
    assert.equal(level.themeKey,key);assert.equal(level.path.length,36);
    shapes.add(JSON.stringify(level.path));
    assert.equal(new Set(level.path.map(p=>`${p.x},${p.y}`)).size,level.path.length);
    for(let i=0;i<level.path.length;i++){
      const p=level.path[i];assert.ok(p.x>0&&p.x<18&&p.y>0&&p.y<12);
      assert.equal(isDefensePath(Math.floor(p.x),Math.floor(p.y),key),true);
      assert.equal(isDefenseObstacle(Math.floor(p.x),Math.floor(p.y),key),false);
      if(i)assert.equal(Math.abs(p.x-level.path[i-1].x)+Math.abs(p.y-level.path[i-1].y),1);
    }
  }
  assert.equal(shapes.size,4);assert.equal(getDefensePath(),DEFENSE_PATH);
  assert.equal(getDefenseLevel("level2").key,"jungle");
});

test("spawns, movement, core endpoints and building legality follow the selected map",()=>{
  for(const key of Object.keys(DEFENSE_LEVELS)){
    const game=createDefenseGame(key),path=getDefensePath(game);game.energy=10000;
    const cell=path[4];assert.equal(placeDefense(game,"rapidFire",Math.floor(cell.x),Math.floor(cell.y)),false);
    for(const cell of getDefenseLevel(game).blocked)assert.equal(placeDefense(game,"rapidFire",cell.x,cell.y),false);
    startDefenseWave(game);game.queue=["scout"];game.spawnIn=0;stepDefense(game,.01);
    assert.equal(game.enemies.length,1);const unit=game.enemies[0];
    assert.deepEqual({x:unit.x,y:unit.y},defensePosition(unit.distance,game));
    assert.deepEqual(defensePosition(1e5,game),path.at(-1));
    unit.distance=path.length-1.001;unit.speed=2;stepDefense(game,.01);assert.equal(game.lives,19);
  }
});

test("Juggernaut slam damages a group and briefly stuns it with shared recovery",()=>{
  const g=running("juggernaut");const a=enemy(g,{speed:1}),b=enemy(g,{x:3,distance:2.5,speed:1}),c=enemy(g,{x:8.5,distance:8});
  stepDefense(g,.01);assert.equal(a.hp,940);assert.equal(b.hp,940);assert.equal(c.hp,1000);assert.ok(a.stunned>0&&b.stunned>0);assert.equal(a.distance,2);
  const ready=a.stunReadyAt;g.towers[0].cooldown=0;stepDefense(g,.01);assert.equal(a.stunReadyAt,ready);
});

test("Breaker strips armor before damage and duplicate strips do not stack",()=>{
  const g=running("breaker");assert.equal(placeDefense(g,"breaker",3,1),true);const a=enemy(g,{armor:.4});
  stepDefense(g,.01);assert.equal(a.armorBreak,.18);assert.ok(Math.abs(a.hp-(1000-24*.78*2))<1e-8);
  g.towers[0].level=6;g.towers[0].cooldown=0;stepDefense(g,.01);assert.equal(a.armorBreak,.43);
});

test("Haste bolts build capped sustained-fire damage and reset when no target remains",()=>{
  const g=running("haste");const a=enemy(g,{hp:1e6});far(g);
  stepDefense(g,.01);assert.equal(a.hp,1e6-4);
  for(let i=0;i<12;i++){g.towers[0].cooldown=0;stepDefense(g,.01);}
  const before=a.hp;g.towers[0].cooldown=0;stepDefense(g,.01);assert.equal(before-a.hp,6);
  g.enemies=g.enemies.filter(e=>e!==a);g.towers[0].cooldown=0;stepDefense(g,.01);assert.equal(g.towers[0].momentum,0);
});

test("Magnet shocks and pulls along the route, with shared recovery and boss resistance",()=>{
  const g=running("magnet");placeDefense(g,"magnet",3,1);const a=enemy(g,{x:3.5,distance:3});
  stepDefense(g,.01);assert.equal(a.hp,976);assert.ok(Math.abs(a.distance-2.72)<1e-8);assert.deepEqual({x:a.x,y:a.y},defensePosition(a.distance,g));
  const boss=running("magnet");const b=enemy(boss,{x:3.5,distance:3,boss:true});stepDefense(boss,.01);assert.ok(Math.abs(b.distance-2.93)<1e-8);
});

test("Piercing rounds hit five targets and ignore half the armor",()=>{
  const g=running("pierce");const targets=Array.from({length:6},(_,i)=>enemy(g,{x:2.5+i*.1,distance:2+i*.1,armor:.4}));
  stepDefense(g,.01);assert.equal(targets.filter(e=>e.hp<1000).length,5);
  for(const e of targets.filter(e=>e.hp<1000))assert.ok(Math.abs(e.hp-(1000-18*.8))<1e-8);
});

test("Vampirism repairs on real killing blows and cannot overfill the core",()=>{
  const g=running("vampirism");far(g);g.lives=15;
  for(let i=0;i<4;i++){enemy(g,{hp:1});g.towers[0].cooldown=0;stepDefense(g,.01);}
  assert.equal(g.kills,4);assert.equal(g.lives,16);assert.equal(g.coreRepairs,1);
  g.lives=20;for(let i=0;i<4;i++){enemy(g,{hp:1});g.towers[0].cooldown=0;stepDefense(g,.01);}assert.equal(g.lives,20);
});

test("Long Arms sweeps every nearby enemy, while Ammo Surge retargets each barrage shot",()=>{
  const sweep=running("longArms");const targets=Array.from({length:5},(_,i)=>enemy(sweep,{x:2.5+i*.1,distance:2+i*.1}));const outside=enemy(sweep,{x:6.5,distance:6});
  stepDefense(sweep,.01);assert.equal(targets.filter(e=>e.hp===982).length,5);assert.equal(outside.hp,1000);
  const barrage=running("ammoSurge");const ahead=enemy(barrage,{hp:1,distance:3,x:3.5}),behind=enemy(barrage,{distance:2,hp:100});far(barrage);
  stepDefense(barrage,.01);assert.ok(ahead.hp<=0);assert.equal(behind.hp,90);assert.equal(barrage.kills,1);
});

test("Phase Walk bypasses armor/protection and its burn continues after the shot",()=>{
  const g=running("phaseWalk");const a=enemy(g,{armor:.5});enemy(g,{kind:"warden",x:1.5,distance:1,hp:1e6});
  stepDefense(g,.01);assert.equal(a.protected,true);assert.ok(Math.abs(a.hp-975.95)<1e-8);assert.ok(a.phaseTime>1.9);
  const owner=g.towers[0];g.towers=[];const hp=a.hp;stepDefense(g,.1);assert.ok(Math.abs((hp-a.hp)-.5)<1e-8);
  a.hp=.1;stepDefense(g,.1);assert.equal(g.kills,1);assert.equal(owner.kills,1);
});

function earnedStrategy(levelKey){
  const g=createDefenseGame(levelKey),path=getDefensePath(g);
  function buildBest(type){
    const stats=DEFENSE_TYPES[type],candidates=[];
    for(let y=0;y<12;y++)for(let x=0;x<18;x++){
      if(canPlaceDefense(g,type,x,y))continue;
      let score=path.filter(p=>Math.hypot(p.x-x-.5,p.y-y-.5)<=stats.range).length;
      if(type==="berserk")score=g.towers.filter(t=>!DEFENSE_TYPES[t.type].support&&t.type!=="frost"&&Math.hypot(t.x-x-.5,t.y-y-.5)<=stats.range).length*10;
      candidates.push({x,y,score});
    }
    candidates.sort((a,b)=>b.score-a.score);return candidates.length&&placeDefense(g,type,candidates[0].x,candidates[0].y);
  }
  for(let i=0;i<3;i++)assert.ok(buildBest("rapidFire"));
  for(let wave=1;wave<=60;wave++){
    if(wave>1)for(let n=0;n<120;n++){
      const cap=wave<10?3:6;
      const wanted=[["frost",3],["demolition",4],["precision",5],["regen",10],["shield",10],["berserk",11],["sonar",11],["bounty",12]].find(([type,start])=>wave>=start&&!g.towers.some(t=>t.type===type));
      if(wanted&&g.energy>=DEFENSE_TYPES[wanted[0]].cost&&buildBest(wanted[0]))continue;
      const up=g.towers.find(t=>!DEFENSE_TYPES[t.type].support&&t.type!=="frost"&&t.level<cap&&defenseUpgradeCost(t)<=g.energy);
      if(up){upgradeDefense(g,up.id);continue;}
      const support=wave>=15&&g.towers.find(t=>DEFENSE_TYPES[t.type].support&&t.type!=="bounty"&&t.level<cap&&defenseUpgradeCost(t)<=g.energy);
      if(support){upgradeDefense(g,support.id);continue;}
      const count=type=>g.towers.filter(t=>t.type===type).length;
      const type=count("demolition")<5?"demolition":count("precision")<8?"precision":wave>20&&count("pierce")<4?"pierce":wave>20&&count("phaseWalk")<3?"phaseWalk":count("scattershot")<4?"scattershot":"rapidFire";
      if(!buildBest(type))break;
    }
    assert.ok(g.energy>=0);assert.equal(startDefenseWave(g),true);
    let n=0;while(g.status==="running"&&n++<10000)stepDefense(g,.25);
    assert.equal(g.status,wave===60?"victory":"building",`${levelKey} wave${wave} must be beatable with earned energy (core${g.lives})`);
  }
  return g;
}
test("every themed level can clear all sixty waves using only earned battlefield energy",()=>{
  for(const key of Object.keys(DEFENSE_LEVELS)){const g=earnedStrategy(key);assert.equal(g.wave,DEFENSE_WAVES);assert.equal(g.status,"victory");assert.ok(g.lives>0);assert.ok(g.towers.some(t=>t.level===DEFENSE_MAX_LEVEL));}
});
