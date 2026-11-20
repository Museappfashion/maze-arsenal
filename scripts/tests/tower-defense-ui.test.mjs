import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// Exercise actual component handlers and successive HUD renders. Canvas pixel
// output is verified separately by native-scenes-qa.mjs.
test("defense UI shows targeting and upgrade previews, pauses with an empty shade, and retains battle controls", async () => {
  const hooksId="virtual:defense-ui-hooks";
  const source=`let cursor=0; const slots=[];
    export function begin(){cursor=0;}
    export function slot(i){return slots[i];}
    export function useRef(value){const i=cursor++;return slots[i]??(slots[i]={current:value});}
    export function useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];}
    export function useEffect(){}
  `;
  const server=await createServer({root:fileURLToPath(new URL("../../",import.meta.url)),cacheDir:"/tmp/mist-defense-ui-vite-cache",server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:"custom",optimizeDeps:{noDiscovery:true,include:[]},plugins:[{name:"defense-ui-hooks",enforce:"pre",resolveId(id){if(id===hooksId)return "\0"+id;},load(id){if(id==="\0"+hooksId)return source;},transform(s,id){if(id.endsWith("/src/components/TowerDefenseGame.jsx"))return s.replace('from "react";',`from "${hooksId}";`);}}]});
  try {
    const hooks=await server.ssrLoadModule(hooksId);
    const {TowerDefenseGame}=await server.ssrLoadModule("/src/components/TowerDefenseGame.jsx");
    const engine=await server.ssrLoadModule("/src/game/towerDefense.js");
    const render=()=>{hooks.begin();return TowerDefenseGame({onBack(){},playerName:"UI regression"});};
    const nodes=(tree)=>!tree||typeof tree!=="object"?[]:[tree,...(Array.isArray(tree.props?.children)?tree.props.children:[tree.props?.children]).flat(Infinity).flatMap(nodes)];
    const text=(tree)=>tree==null||typeof tree==="boolean"?"":typeof tree!=="object"?String(tree):(Array.isArray(tree.props?.children)?tree.props.children:[tree.props?.children]).flat(Infinity).map(text).join("");
    const byClass=(tree,name)=>nodes(tree).find((n)=>n.props?.className?.split(" ").includes(name));
    const button=(tree,value)=>nodes(tree).find((n)=>n.type==="button"&&text(n)===value);
    let tree=render();
    // The stage owns the first column; the compact HUD owns every control.
    // A dashboard header or stats row must not shrink the game viewport again.
    assert.equal(tree.props.children[0].props.className,"td-arena-panel");
    assert.equal(tree.props.children[1].type,"aside");
    const sidebar=byClass(tree,"td-sidebar");
    assert.ok(byClass(sidebar,"td-speed-controls"));
    assert.ok(byClass(sidebar,"td-stats"));
    assert.equal(nodes(tree.props.children[0]).some(n=>n.props?.className==="td-stats"),false);
    button(tree,"3×").props.onClick();tree=render();
    assert.equal(button(tree,"3×").props["aria-pressed"],true);
    const game=hooks.slot(0).current;assert.equal(game.speed,3);
    const canvas=nodes(tree).find((n)=>n.type==="canvas");
    canvas.props.onPointerDown({button:0,clientX:175,clientY:225,currentTarget:{focus(){},getBoundingClientRect(){return{x:0,y:0,left:0,top:0,width:900,height:600};}}});
    tree=render();assert.equal(game.towers.length,1);
    const tower=game.towers[0];
    const targeting=byClass(tree,"td-targeting");
    assert.equal(targeting.type,"fieldset");assert.equal(text(nodes(targeting).find(n=>n.type==="legend")),"Targeting");
    assert.deepEqual(nodes(targeting).filter(n=>n.type==="button").map(text),["Strongest","Weakest","First","Last"]);
    assert.equal(button(targeting,"First").props["aria-pressed"],true);
    const targetEnergy=game.energy,targetCooldown=tower.cooldown;
    for(const mode of engine.DEFENSE_TARGET_MODES){
      button(tree,mode.label).props.onClick();tree=render();
      assert.equal(tower.targetMode,mode.key);
      assert.equal(button(tree,mode.label).props["aria-pressed"],true);
      assert.equal(text(byClass(tree,"td-targeting-help")),mode.description);
      assert.equal(game.energy,targetEnergy);assert.equal(tower.cooldown,targetCooldown);
    }
    button(tree,"First").props.onClick();tree=render();
    const current=byClass(tree,"td-current-stats"), next=byClass(tree,"td-next-stats");
    assert.match(text(current),/Current:.*7 damage.*0\.24s cooldown.*2\.80 tile range/);
    assert.match(text(next),/Next · Lv\. 2:.*11 damage.*0\.21s cooldown.*3\.15 tile range/);
    const upgrade=byClass(tree,"td-upgrade");
    assert.equal(byClass(byClass(tree,"td-live-hud"),"td-upgrade"),upgrade);
    assert.equal(byClass(byClass(tree,"td-shop"),"td-upgrade"),undefined);
    const paragraphs=upgrade.props.children.filter((n)=>n?.type==="p");
    assert.equal(paragraphs[0],current);assert.equal(paragraphs[1],next);
    button(tree,`Upgrade · ${engine.defenseUpgradeCost(tower)}`).props.onClick();tree=render();
    assert.equal(tower.level,2);
    assert.equal(text(byClass(tree,"td-current-stats")),"Current: "+engine.defenseStatSummary(tower));
    assert.equal(text(byClass(tree,"td-next-stats")),"Next · Lv. 3: "+engine.defenseStatSummary({...tower,level:3}));
    const cost=engine.defenseUpgradeCost(tower);assert.equal(button(tree,`Upgrade · ${cost}`).props.disabled,true);
    game.energy=cost;tree=render();button(tree,`Upgrade · ${cost}`).props.onClick();tree=render();
    assert.equal(tower.level,3);assert.match(text(byClass(tree,"td-next-stats")),/Next · Lv\. 4/);
    game.energy=10000;
    while(tower.level<engine.DEFENSE_MAX_LEVEL){tree=render();button(tree,`Upgrade · ${engine.defenseUpgradeCost(tower)}`).props.onClick();}
    tree=render();assert.equal(tower.level,6);assert.match(text(byClass(tree,"td-next-stats")),/Maximum level/);
    assert.equal(nodes(byClass(tree,"td-shop")).filter(n=>n.props?.className?.split(" ").includes("td-power")).length,20);
    button(tree,"Start wave 1").props.onClick();tree=render();button(tree,"Pause").props.onClick();tree=render();
    assert.equal(game.paused,true);assert.equal(button(tree,`Sell · ${engine.defenseSellValue(tower)}`).props.disabled,true);
    const shade=byClass(tree,"td-pause-shade");assert.ok(shade);assert.equal(shade.props["aria-hidden"],"true");assert.equal(text(shade),"");assert.equal(shade.props.children,undefined);
    assert.equal(byClass(tree,"td-overlay"),undefined);assert.equal(byClass(tree,"td-arena-message"),undefined);
    assert.equal(button(tree,"Resume battle"),undefined);assert.equal(nodes(tree).some(n=>n.type==="h2"&&text(n)==="Paused"),false);
    const pausedEnergy=game.energy,pausedTime=game.time,pausedCooldown=tower.cooldown;
    button(tree,"Weakest").props.onClick();tree=render();assert.equal(tower.targetMode,"weakest");
    assert.equal(game.energy,pausedEnergy);assert.equal(game.time,pausedTime);assert.equal(tower.cooldown,pausedCooldown);
    game.selectedId=null;tree=render();
    nodes(tree).find(n=>n.type==="canvas").props.onPointerDown({button:0,clientX:175,clientY:225,currentTarget:{focus(){},getBoundingClientRect(){return{left:0,top:0,width:900,height:600};}}});tree=render();assert.equal(game.selectedId,tower.id,"paused towers remain selectable");assert.ok(byClass(tree,"td-targeting"));
    const pausedMessage=game.message,pausedCount=game.towers.length;
    nodes(tree).find(n=>n.type==="canvas").props.onPointerDown({button:0,clientX:75,clientY:75,currentTarget:{focus(){},getBoundingClientRect(){return{left:0,top:0,width:900,height:600};}}});tree=render();assert.equal(game.towers.length,pausedCount);assert.equal(game.energy,pausedEnergy);assert.equal(game.message,pausedMessage,"paused empty tiles cannot build or replace the frozen scene message");
    button(tree,"Resume").props.onClick();tree=render();assert.equal(game.paused,false);assert.equal(byClass(tree,"td-pause-shade"),undefined);assert.ok(byClass(tree,"td-arena-message"));
    nodes(tree).find(n=>n.type==="canvas").props.onKeyDown({key:"p",preventDefault(){}});tree=render();assert.equal(game.paused,true);
    nodes(tree).find(n=>n.type==="canvas").props.onKeyDown({key:" ",preventDefault(){}});tree=render();assert.equal(game.paused,false);
    nodes(tree).find((n)=>n.type==="canvas").props.onKeyDown({key:"s",preventDefault(){}});assert.equal(game.speed,1);
    nodes(tree).find(n=>n.type==="canvas").props.onKeyDown({key:"0",preventDefault(){}});tree=render();
    assert.match(text(byClass(tree,"td-power-selected")),/Regeneration.*key 0/);
    nodes(tree).find(n=>n.type==="canvas").props.onKeyDown({key:"-",preventDefault(){}});tree=render();
    assert.match(text(byClass(tree,"td-power-selected")),/Shield.*key -/);
    nodes(tree).find(n=>n.type==="canvas").props.onPointerDown({button:0,clientX:75,clientY:75,currentTarget:{focus(){},getBoundingClientRect(){return {left:0,top:0,width:900,height:600};}}});tree=render();
    assert.match(text(byClass(tree,"td-current-stats")),/2 core shield per wave/);
    assert.match(text(byClass(tree,"td-next-stats")),/3 core shield per wave/);
    assert.equal(byClass(tree,"td-targeting"),undefined,"support fields do not expose ineffective target controls");
    const levels=byClass(tree,"td-level-select");
    assert.equal(nodes(levels).filter(n=>n.type==="button").length,4);
    assert.equal(button(tree,"Orbital Ruins").props["aria-pressed"],true);
    nodes(tree).find(n=>n.type==="canvas").props.onKeyDown({key:"f",preventDefault(){}});tree=render();
    assert.match(text(byClass(tree,"td-power-selected")),/Phase Walk.*key f/);
    button(tree,"Abandoned City").props.onClick();tree=render();
    assert.equal(game.paused,true);assert.ok(byClass(tree,"td-level-modal"));
    button(tree,"Keep this battle").props.onClick();tree=render();assert.equal(game.paused,false);assert.equal(hooks.slot(0).current,game);
    button(tree,"Abandoned City").props.onClick();tree=render();button(tree,"Start selected level").props.onClick();tree=render();
    const city=hooks.slot(0).current;assert.notEqual(city,game);assert.equal(city.levelKey,"city");assert.equal(city.wave,0);assert.equal(city.energy,270);assert.equal(city.towers.length,0);
    assert.equal(button(tree,"Abandoned City").props["aria-pressed"],true);
    button(tree,"Restart").props.onClick();tree=render();assert.equal(hooks.slot(0).current.levelKey,"city");
    button(tree,"Emerald Wilds").props.onClick();tree=render();assert.equal(hooks.slot(0).current.levelKey,"jungle");assert.equal(byClass(tree,"td-level-modal"),undefined);
    const latest=hooks.slot(0).current;
    for(const type of ["scattershot","longArms","frost","berserk","sonar","bounty","regen","shield"]){
      latest.towers=[{id:900,type,x:2.5,y:1.5,level:1,kills:0,spent:100,cooldown:0}];latest.selectedId=900;tree=render();
      assert.equal(byClass(tree,"td-targeting"),undefined,`${type} has no targeting modes`);
    }
    for(const type of Object.keys(engine.DEFENSE_TYPES).filter(key=>engine.defenseSupportsTargeting(key))){
      latest.towers=[{id:901,type,x:2.5,y:1.5,level:1,kills:0,spent:100,cooldown:0}];latest.selectedId=901;tree=render();
      assert.ok(byClass(tree,"td-targeting"),`${type} exposes its effective targeting modes`);
      assert.equal(button(tree,"First").props["aria-pressed"],true,"older defenses without an explicit mode display First");
    }
    for(const status of ["victory","defeat"]){
      latest.status=status;latest.paused=true;tree=render();
      assert.equal(byClass(tree,"td-pause-shade"),undefined);
      const overlay=byClass(tree,"td-overlay");assert.ok(overlay);assert.match(text(overlay),status==="victory"?/Core protected!/:/The core has fallen/);assert.ok(button(overlay,"Play again"));
      assert.equal(byClass(tree,"td-targeting").props.disabled,true);
    }
  } finally {await server.close();}
});
