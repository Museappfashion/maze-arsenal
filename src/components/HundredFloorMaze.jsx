import { useCallback, useEffect, useRef, useState } from "react";
import { CUBE_DIMENSIONS, activateCubeLift, createCubeMaze, cubeMazeSaveKey, getCubeLiftInteraction, loadCubeMaze, saveCubeMaze, updateCubeMaze } from "../game/cubeMaze.js";
import { drawCubeMaze } from "../game/cubeMazeRendering3D.js";
import { CubeMazeMinimap } from "./CubeMazeMinimap.jsx";
import { GAME_STYLES } from "../styles/gameStyles.js";
import { VIEW_3D_MOUSE_SENSITIVITY } from "../config/constants.js";
import { recordActivePlay, flushPlayerProgress } from "../services/playerProgress.js";
import { recordGameStarted, recordPlaySeconds } from "../services/developerAnalytics.js";
import "../styles/hundredFloorMaze.css";

const finePointer = () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
const snapshotOf = (world) => ({ completed:world.completed, haste:world.haste, sonar:world.sonar, lift:getCubeLiftInteraction(world), message:world.messageTime>0||world.completed ? world.message : "Walk onto ramps to climb. Use E / Shift+E for lifts. M opens the 3D map." });

function CubeJoystick({ onMove, look = false }) {
  const pointer = useRef(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });
  const release = () => { pointer.current = null; onMove({ x: 0, y: 0 }); setThumb({ x: 0, y: 0 }); };
  const move = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / (rect.width * .3);
    const y = (event.clientY - rect.top - rect.height / 2) / (rect.height * .3);
    const length = Math.max(1, Math.hypot(x, y));
    const next = { x: x / length, y: y / length };
    onMove(next); setThumb(next);
  };
  return <div className={`hundred-joystick ${look ? "cube-look-joystick" : ""}`} role="group" aria-label={look ? "Look joystick" : "Movement joystick"} onPointerDown={(event) => { event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={(event) => { if (pointer.current === event.pointerId) move(event); }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><span style={{ transform: `translate(${thumb.x * 25}px, ${thumb.y * 25}px)` }} /><small>{look ? "LOOK" : "MOVE"}</small></div>;
}


function CubeMazeRun({ onBack, playerName }) {
  const [world,setWorld]=useState(()=>loadCubeMaze(playerName));
  const [snapshot,setSnapshot]=useState(()=>snapshotOf(world));
  const [mapOpen,setMapOpen]=useState(false), [mouseLocked,setMouseLocked]=useState(false);
  const [released,setReleased]=useState(finePointer), [saveFailed,setSaveFailed]=useState(false);
  const [mouseNote,setMouseNote]=useState("Click once to look · Esc releases mouse · Esc again exits");
  const canvasRef=useRef(null), keys=useRef({}), drag=useRef(null);
  const joystick=useRef({x:0,y:0}),lookStick=useRef({x:0,y:0});
  const mapRef=useRef(false),releasedRef=useRef(finePointer()),escapeArmed=useRef(false);
  const unlockIntent=useRef(null),ownsMouse=useRef(false),lockWanted=useRef(false),leaving=useRef(false);
  const analyticsSeconds=useRef(0);
  const clearInput=useCallback(()=>{keys.current={};joystick.current={x:0,y:0};lookStick.current={x:0,y:0};drag.current=null;},[]);
  const stopForCursor=useCallback((value)=>{releasedRef.current=value;setReleased(value);},[]);
  const persist=useCallback(()=>{const saved=saveCubeMaze(playerName,world);setSaveFailed(!saved);return saved;},[playerName,world]);
  const flushAnalytics=useCallback(()=>{const seconds=Math.floor(analyticsSeconds.current);if(seconds>0){analyticsSeconds.current-=seconds;void recordPlaySeconds({playerName},seconds);}},[playerName]);
  const releaseMouse=useCallback((reason)=>{
    unlockIntent.current=reason;lockWanted.current=false;clearInput();
    if(document.pointerLockElement===canvasRef.current)document.exitPointerLock?.();
  },[clearInput]);
  const requestMouse=useCallback((force=false)=>{
    if(mapRef.current||world.completed||leaving.current)return;
    const canvas=canvasRef.current;if(!canvas)return;
    if(!force&&!finePointer()){stopForCursor(false);return;}
    if(document.pointerLockElement===canvas){stopForCursor(false);return;}
    canvas.focus({preventScroll:true});
    if(!canvas.requestPointerLock){stopForCursor(false);setMouseNote("Use arrow keys to turn · Esc twice exits");return;}
    lockWanted.current=true;unlockIntent.current=null;
    const failed=()=>{if(lockWanted.current)setMouseNote("Click once to look · Esc releases mouse · Esc again exits");};
    try{canvas.requestPointerLock()?.catch(failed);}catch{failed();}
  },[stopForCursor,world]);
  const leave=useCallback(()=>{if(leaving.current)return;leaving.current=true;releaseMouse("leave");persist();flushAnalytics();flushPlayerProgress();onBack();},[releaseMouse,persist,flushAnalytics,onBack]);
  const showMap=useCallback((value)=>{
    mapRef.current=value;setMapOpen(value);escapeArmed.current=false;clearInput();
    if(value){releaseMouse("map");persist();flushAnalytics();flushPlayerProgress();}
  },[clearInput,releaseMouse,persist,flushAnalytics]);
  const releaseForEscape=useCallback(()=>{
    escapeArmed.current=true;stopForCursor(true);releaseMouse("escape");persist();flushAnalytics();flushPlayerProgress();
    setMouseNote("Mouse free · click to look · press Esc again to leave");
  },[stopForCursor,releaseMouse,persist,flushAnalytics]);
  const useLift=useCallback((direction)=>{
    if(mapRef.current||world.completed)return;
    if(releasedRef.current)requestMouse();
    if(activateCubeLift(world,direction))setSnapshot(snapshotOf(world));
  },[requestMouse,world]);
  const restart=()=>{
    flushAnalytics();releaseMouse("restart");const next=createCubeMaze();saveCubeMaze(playerName,next);
    clearInput();leaving.current=false;escapeArmed.current=false;mapRef.current=false;setMapOpen(false);
    stopForCursor(finePointer());setWorld(next);setSnapshot(snapshotOf(next));
  };

  useEffect(()=>{
    const down=(event)=>{
      if(event.altKey||event.ctrlKey||event.metaKey)return;
      if(event.target instanceof Element&&event.target.closest("input,textarea,select"))return;
      const key=event.key.toLowerCase();
      if(key==="escape"&&!event.repeat){
        event.preventDefault();
        if(mapRef.current){showMap(false);return;}
        if(document.pointerLockElement===canvasRef.current){releaseForEscape();return;}
        if(escapeArmed.current)leave();else releaseForEscape();
        return;
      }
      if(key==="m"&&!event.repeat&&!world.completed){event.preventDefault();showMap(!mapRef.current);return;}
      if(mapRef.current||releasedRef.current||world.completed)return;
      if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","pageup","pagedown","e"].includes(key))event.preventDefault();
      keys.current[key]=true;
      if(key==="e"&&!event.repeat)useLift(event.shiftKey?-1:1);
    };
    const up=(event)=>{keys.current[event.key.toLowerCase()]=false;};
    const suspend=()=>{if(leaving.current)return;stopForCursor(true);escapeArmed.current=false;releaseMouse("blur");persist();flushAnalytics();flushPlayerProgress();};
    const visibility=()=>{if(document.hidden)suspend();};
    window.addEventListener("keydown",down);window.addEventListener("keyup",up,true);window.addEventListener("blur",suspend);window.addEventListener("pagehide",suspend);document.addEventListener("visibilitychange",visibility);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up,true);window.removeEventListener("blur",suspend);window.removeEventListener("pagehide",suspend);document.removeEventListener("visibilitychange",visibility);clearInput();};
  },[clearInput,flushAnalytics,leave,persist,releaseForEscape,releaseMouse,showMap,stopForCursor,useLift,world]);

  useEffect(()=>{
    const canvas=canvasRef.current;
    const lockChange=()=>{
      const locked=document.pointerLockElement===canvas,wasOwned=ownsMouse.current;
      ownsMouse.current=locked;setMouseLocked(locked);
      if(locked){
        if(!lockWanted.current||mapRef.current||world.completed||leaving.current){releaseMouse("inactive");return;}
        unlockIntent.current=null;escapeArmed.current=false;stopForCursor(false);clearInput();
      }else if(wasOwned){
        const intended=unlockIntent.current;unlockIntent.current=null;lockWanted.current=false;stopForCursor(true);clearInput();
        if(!intended||intended==="escape"){escapeArmed.current=true;persist();flushAnalytics();flushPlayerProgress();setMouseNote("Mouse free · click to look · press Esc again to leave");}
      }
    };
    const mouseMove=(event)=>{
      if(document.pointerLockElement!==canvas||mapRef.current||releasedRef.current||world.completed)return;
      world.player.facing+=event.movementX*VIEW_3D_MOUSE_SENSITIVITY;
      world.player.pitch=Math.max(-.8,Math.min(.8,world.player.pitch-event.movementY*VIEW_3D_MOUSE_SENSITIVITY));
    };
    const lockError=()=>{if(lockWanted.current)setMouseNote("Click once to look · Esc releases mouse · Esc again exits");};
    document.addEventListener("pointerlockchange",lockChange);document.addEventListener("pointerlockerror",lockError);document.addEventListener("mousemove",mouseMove);
    return()=>{releaseMouse("unmount");ownsMouse.current=false;document.removeEventListener("pointerlockchange",lockChange);document.removeEventListener("pointerlockerror",lockError);document.removeEventListener("mousemove",mouseMove);};
  },[clearInput,flushAnalytics,persist,releaseMouse,stopForCursor,world]);

  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas.getContext("2d");let viewport;
    const resize=()=>{const b=canvas.getBoundingClientRect();const ratio=Math.min(1.5,window.devicePixelRatio||1);viewport={width:Math.max(1,b.width),height:Math.max(1,b.height),ratio};canvas.width=Math.round(viewport.width*ratio);canvas.height=Math.round(viewport.height*ratio);};
    resize();const observer=new ResizeObserver(resize);observer.observe(canvas);globalThis.__mistCubeMazeWorld=world;
    void recordGameStarted({playerName});analyticsSeconds.current=0;
    let previous=0,refresh=0,saveTime=0,frame;
    const loop=(now)=>{
      const dt=previous?Math.max(0,Math.min(.05,(now-previous)/1000)):0;previous=now;
      if(!mapRef.current&&!releasedRef.current&&!world.completed&&!document.hidden){
        const held=keys.current;
        updateCubeMaze(world,dt,{forward:Number(Boolean(held.w||held.arrowup))-Number(Boolean(held.s||held.arrowdown))-joystick.current.y,strafe:Number(Boolean(held.d))-Number(Boolean(held.a))+joystick.current.x,turn:Number(Boolean(held.arrowright))-Number(Boolean(held.arrowleft))+lookStick.current.x,look:Number(Boolean(held.pageup))-Number(Boolean(held.pagedown))-lookStick.current.y});
        recordActivePlay(playerName,dt);analyticsSeconds.current+=dt;if(analyticsSeconds.current>=30)flushAnalytics();saveTime+=dt;if(saveTime>5){persist();saveTime=0;}
      }
      refresh+=dt;if(refresh>.1){setSnapshot(snapshotOf(world));refresh=0;}
      if(!mapRef.current){ctx.setTransform(viewport.ratio,0,0,viewport.ratio,0,0);drawCubeMaze(ctx,world,viewport.width,viewport.height,{playerName,showStatus:false});}
      frame=requestAnimationFrame(loop);
    };
    frame=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();flushAnalytics();flushPlayerProgress();if(globalThis.__mistCubeMazeWorld===world)delete globalThis.__mistCubeMazeWorld;};
  },[flushAnalytics,persist,playerName,world]);
  useEffect(()=>{if(snapshot.completed){stopForCursor(true);releaseMouse("complete");persist();flushAnalytics();}},[snapshot.completed,stopForCursor,releaseMouse,persist,flushAnalytics]);
  useEffect(()=>{if(mapOpen)document.querySelector(".cube-minimap-expanded canvas")?.focus({preventScroll:true});else canvasRef.current?.focus({preventScroll:true});},[mapOpen,world]);
  const latest=useRef({world,playerName});latest.current={world,playerName};
  useEffect(()=>()=>saveCubeMaze(latest.current.playerName,latest.current.world),[]);
  const pointerDown=(event)=>{
    if(mapRef.current||world.completed||event.button!==0)return;
    if(event.pointerType!=="touch"){requestMouse(true);return;}
    stopForCursor(false);event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,x:event.clientX,y:event.clientY};
  };
  const pointerMove=(event)=>{
    const last=drag.current;if(event.pointerType!=="touch"||!last||last.id!==event.pointerId||mapRef.current||world.completed)return;
    world.player.facing+=(event.clientX-last.x)*.006;world.player.pitch=Math.max(-.8,Math.min(.8,world.player.pitch-(event.clientY-last.y)*.004));drag.current={id:last.id,x:event.clientX,y:event.clientY};
  };
  const lift=snapshot.lift,busy=mapOpen||snapshot.completed;
  return <main className="hundred-page cube-page cube-fullview mode-3d" data-mouse-locked={mouseLocked?"true":"false"} data-cursor-free={released?"true":"false"}>
    <style>{GAME_STYLES}</style>
    <section className="cube-stage" aria-label="The Cube 100 by 100 by 100 maze">
      <div className="cube-frame">
        <canvas ref={canvasRef} className="hundred-canvas cube-canvas" tabIndex={0} role="application" aria-label="The Cube. Click once for mouse look. WASD walks, M opens the 3D map, E uses a lift upward and Shift E downward. First Escape releases the mouse, second Escape returns to the first page." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} onContextMenu={(event)=>event.preventDefault()} />
        <button type="button" className="cube-back-button" aria-label="Back to first page" onClick={leave}>← Back</button>
        {!busy&&!mouseLocked&&<button type="button" className="cube-mouse-status" aria-label="Capture mouse" onClick={()=>requestMouse(true)}>{mouseNote}</button>}
        <div className="cube-map-float"><CubeMazeMinimap compact world={world} expanded={mapOpen} onToggle={()=>showMap(!mapRef.current)} /></div>
        <div className="hundred-message" role="status">{saveFailed?"Saving unavailable. Keep this run open to retain your position.":snapshot.message}</div>
        {!busy&&lift&&<div className="cube-lift-prompt" aria-label="Lift controls"><span>{lift.label}</span><div><button type="button" disabled={lift.moving||!lift.canUp} onClick={()=>useLift(1)}>↑ {lift.span} stories <kbd>E</kbd></button><button type="button" disabled={lift.moving||!lift.canDown} onClick={()=>useLift(-1)}>↓ {lift.span} stories <kbd>Shift E</kbd></button></div></div>}
        {!busy&&<div className="hundred-touch cube-touch"><CubeJoystick onMove={(next)=>{if(!releasedRef.current)joystick.current=next;}} /><CubeJoystick look onMove={(next)=>{if(!releasedRef.current)lookStick.current=next;}} /></div>}
        {released&&!busy&&<div className="cube-touch-resume"><button type="button" onClick={()=>requestMouse()}>Continue maze</button></div>}
        {!busy&&(snapshot.haste>0||snapshot.sonar>0)&&<div className="cube-active-powers">{snapshot.haste>0&&<span>Haste · {Math.ceil(snapshot.haste)}s</span>}{snapshot.sonar>0&&<span>Sonar · {Math.ceil(snapshot.sonar)}s</span>}</div>}
        {snapshot.completed&&<div className="hundred-overlay"><section className="hundred-dialog" role="dialog" aria-modal="true" aria-labelledby="cube-complete-title"><h2 id="cube-complete-title">You escaped The Cube.</h2><p>The connected 100 × 100 × 100 maze is complete.</p><div className="hundred-dialog-actions"><button type="button" onClick={leave}>Back to first page</button><button type="button" className="hundred-primary" onClick={restart}>New Cube</button></div></section></div>}
      </div>
    </section>
  </main>;
}

export function HundredFloorMaze({onBack,playerName}) {
  return <CubeMazeRun key={cubeMazeSaveKey(playerName)} onBack={onBack} playerName={playerName} />;
}
