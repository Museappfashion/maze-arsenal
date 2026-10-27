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
    const paragraphs=upgrade.props.children.filter((n)=>n?.type==="p");
    assert.equal(paragraphs[0],current);assert.equal(paragraphs[1],next);
    button(tree,`Upgrade · ${engine.defenseUpgradeCost(tower)}`).props.onClick();tree=render();
    assert.equal(tower.level,2);
    assert.equal(text(byClass(tree,"td-current-stats")),"Current: "+engine.defenseStatSummary(tower));
    assert.equal(text(byClass(tree,"td-next-stats")),"Next · Lv. 3: "+engine.defenseStatSummary({...tower,level:3}));
    const cost=engine.defenseUpgradeCost(tower);assert.equal(button(tree,`Upgrade · ${cost}`).props.disabled,true);
    game.energy=cost;tree=render();button(tree,`Upgrade · ${cost}`).props.onClick();tree=render();
    assert.equal(tower.level,3);assert.match(text(byClass(tree,"td-next-stats")),/Maximum level/);
    button(tree,"Start wave 1").props.onClick();tree=render();button(tree,"Pause").props.onClick();tree=render();
    assert.equal(game.paused,true);assert.equal(button(tree,`Sell · ${engine.defenseSellValue(tower)}`).props.disabled,true);
    button(tree,"Resume battle").props.onClick();tree=render();assert.equal(game.paused,false);
    nodes(tree).find((n)=>n.type==="canvas").props.onKeyDown({key:"s",preventDefault(){}});assert.equal(game.speed,1);
  } finally {await server.close();}
});
