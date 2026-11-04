import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// Exercise actual component handlers and successive HUD renders. Canvas pixel
// output is verified separately by native-scenes-qa.mjs.
test("defense UI switches speed, shows exact next stats under current stats, and updates them after purchase", async () => {
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
    button(tree,"Resume battle").props.onClick();tree=render();assert.equal(game.paused,false);
    nodes(tree).find((n)=>n.type==="canvas").props.onKeyDown({key:"s",preventDefault(){}});assert.equal(game.speed,1);
    nodes(tree).find(n=>n.type==="canvas").props.onKeyDown({key:"0",preventDefault(){}});tree=render();
    assert.match(text(byClass(tree,"td-power-selected")),/Regeneration.*key 0/);
    nodes(tree).find(n=>n.type==="canvas").props.onKeyDown({key:"-",preventDefault(){}});tree=render();
    assert.match(text(byClass(tree,"td-power-selected")),/Shield.*key -/);
    nodes(tree).find(n=>n.type==="canvas").props.onPointerDown({button:0,clientX:75,clientY:75,currentTarget:{focus(){},getBoundingClientRect(){return {left:0,top:0,width:900,height:600};}}});tree=render();
    assert.match(text(byClass(tree,"td-current-stats")),/2 core shield per wave/);
    assert.match(text(byClass(tree,"td-next-stats")),/3 core shield per wave/);
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


  } finally {await server.close();}
});
