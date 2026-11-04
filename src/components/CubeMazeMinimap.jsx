import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CUBE_DIMENSIONS, CUBE_STORY_HEIGHT } from "../game/cubeMaze.js";
import { drawCubeMinimap, cubeMapOverviewView } from "../game/cubeMazeRendering3D.js";
import "../styles/cubeMazeMinimap.css";

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const origin = (world) => ({ x: world.player.x, y: world.player.y, z: world.player.z });
const overviewScale=1000/Math.max(CUBE_DIMENSIONS.length,CUBE_DIMENSIONS.width,CUBE_DIMENSIONS.height);
const initialView = (world) => ({ center: origin(world), yaw: -.65, tilt: .65, zoom: 1, band: 20, follow: true });

/** The map owns its camera. Orbiting, panning and changing slices never move the player. */
export function CubeMazeMinimap({ world, expanded = false, compact = false, onToggle }) {
  const canvas = useRef(null), dialog = useRef(null), pointer = useRef(null), viewRef = useRef(initialView(world));
  const [view, setView] = useState(() => initialView(world));
  const [panMode, setPanMode] = useState(false);
  const [location, setLocation] = useState(() => origin(world));
  const change = (update) => {
    const current=viewRef.current;
    const next=typeof update === "function" ? update(current) : { ...current,...update };
    viewRef.current=next;setView(next);
  };
  const zoom = (factor) => change((current) => ({ ...current, zoom: clamp(current.zoom * factor, current.overview ? .025*overviewScale : .4, current.overview ? .12*overviewScale : 4) }));
  const recenter = () => change((current) => ({ ...current, center: origin(world), follow: true, overview:false, zoom:current.overview ? 1 : current.zoom, band:20 }));
  const pan = (x, y) => change((current) => ({ ...current, follow: false, center: { ...current.center, x: clamp(current.center.x + x, 0, CUBE_DIMENSIONS.length), y: clamp(current.center.y + y, 0, CUBE_DIMENSIONS.width) } }));
  const rotate = (yaw, tilt = 0) => change((current) => ({ ...current, yaw: current.yaw + yaw, tilt: clamp(current.tilt + tilt, .12, 1.4) }));
  const altitude = (value) => change((current) => ({ ...current, follow: false, overview:false, zoom:current.overview ? 1 : current.zoom, band:20, center: { ...current.center, z: clamp(value, 0, CUBE_DIMENSIONS.height - CUBE_STORY_HEIGHT) } }));

  useLayoutEffect(() => {
    const element = canvas.current, ctx = element.getContext("2d");
    let frame, previous = -Infinity, width = 0, height = 0, ratio = 1;
    const paint=()=>{
      const current=viewRef.current;
      const center=current.follow ? origin(world) : current.center;
      ctx.setTransform(ratio,0,0,ratio,0,0);
      drawCubeMinimap(ctx,world,width,height,{...current,center});
      if(current.follow)viewRef.current={...current,center};
      return center;
    };
    const resize = () => {
      const bounds = element.getBoundingClientRect();
      width = Math.max(1, bounds.width); height = Math.max(1, bounds.height); ratio = Math.min(2, window.devicePixelRatio || 1);
      const pixelWidth=Math.round(width*ratio),pixelHeight=Math.round(height*ratio);
      if(element.width!==pixelWidth)element.width=pixelWidth;
      if(element.height!==pixelHeight)element.height=pixelHeight;
      // Setting intrinsic canvas dimensions clears it. Paint immediately here,
      // before the browser presents the portal, rather than waiting for a RAF.
      paint();
    };
    resize();
    const wheel=(event)=>{
      event.preventDefault();event.stopPropagation();
      const current=viewRef.current;
      const next={...current,zoom:clamp(current.zoom*Math.exp(-event.deltaY*.0015),current.overview ? .025*overviewScale : .4,current.overview ? .12*overviewScale : 4)};
      viewRef.current=next;setView(next);
    };
    element.addEventListener("wheel",wheel,{passive:false});
    const observer = new ResizeObserver(resize); observer.observe(element);
    const render = (now) => {
      if (now - previous > 100 && !document.hidden) {
        previous = now;
        const center=paint();
        if(viewRef.current.follow)setLocation(center);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); element.removeEventListener("wheel",wheel); };
  }, [world,expanded]);

  useEffect(()=>{
    if(!expanded) return;
    const previous=document.activeElement, overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const frame=requestAnimationFrame(()=>canvas.current?.focus({preventScroll:true}));
    return ()=>{
      cancelAnimationFrame(frame);document.body.style.overflow=overflow;
      const destination=previous?.isConnected ? previous : document.querySelector(".cube-canvas");
      destination?.focus({preventScroll:true});
    };
  },[expanded]);
  const dialogKeys=(event)=>{
    if(event.key==="Escape") { event.preventDefault();event.stopPropagation();onToggle?.();return; }
    if(event.key!=="Tab") return;
    const focusable=[...dialog.current.querySelectorAll("button:not(:disabled),input:not(:disabled),[tabindex='0']")];
    if(!focusable.length) return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first) { event.preventDefault();last.focus(); }
    else if(!event.shiftKey&&document.activeElement===last) { event.preventDefault();first.focus(); }
  };

  const keyDown = (event) => {
    const key = event.key.toLowerCase();
    if (!["arrowleft", "arrowright", "arrowup", "arrowdown", "+", "=", "-", "_", "home", "pageup", "pagedown"].includes(key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.shiftKey && key.startsWith("arrow")) pan(key === "arrowright" ? 10 : key === "arrowleft" ? -10 : 0, key === "arrowdown" ? 10 : key === "arrowup" ? -10 : 0);
    else if (key === "arrowleft" || key === "arrowright") rotate(key === "arrowleft" ? -.15 : .15);
    else if (key === "arrowup" || key === "arrowdown") rotate(0, key === "arrowup" ? .1 : -.1);
    else if (["+", "="].includes(key)) zoom(1.2);
    else if (["-", "_"].includes(key)) zoom(1 / 1.2);
    else if (key === "home") recenter();
    else altitude(viewRef.current.center.z + (key === "pageup" ? CUBE_STORY_HEIGHT : -CUBE_STORY_HEIGHT));
  };
  const pointerDown = (event) => {
    if (![0, 2].includes(event.button)) return;
    event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, pan: panMode || event.shiftKey || event.button === 2 };
  };
  const pointerMove = (event) => {
    const active = pointer.current; if (!active || active.id !== event.pointerId) return;
    const dx = event.clientX - active.x, dy = event.clientY - active.y;
    active.x = event.clientX; active.y = event.clientY;
    if (active.pan) {
      const current = viewRef.current, bounds = event.currentTarget.getBoundingClientRect();
      const units = 100 / Math.min(bounds.width, bounds.height) / current.zoom;
      const yDelta = dy / Math.max(.25, Math.sin(current.tilt));
      pan((-dx * Math.cos(current.yaw) - yDelta * Math.sin(current.yaw)) * units, (dx * Math.sin(current.yaw) - yDelta * Math.cos(current.yaw)) * units);
    } else rotate(dx * .008, dy * .006);
  };
  const stopPointer = () => { pointer.current = null; };
  const selectedAltitude = view.follow ? location.z : view.center.z;
  const map=<section className={`cube-minimap ${expanded ? "cube-minimap-expanded" : ""} ${compact ? "cube-minimap-compact" : ""}`} aria-label="Navigable 3D minimap">
    <header className="cube-map-heading"><div><h2 id={expanded ? "cube-expanded-map-title" : "cube-minimap-title"}>3D minimap</h2>{(!compact||expanded)&&<span>{view.overview ? "Whole volume" : view.follow ? "Following you" : "Free navigation"} · {Math.round(selectedAltitude)} altitude</span>}</div>{onToggle && <button type="button" className="cube-map-expand" onClick={onToggle}>{expanded ? "Close map" : "Expand map"}<small>M</small></button>}</header>
    <canvas ref={canvas} tabIndex={0} className="cube-map-canvas" role="application" aria-label="3D maze map. Drag to orbit, Shift drag or Pan mode to pan. Arrow keys orbit; Shift arrows pan; plus and minus zoom; Page Up and Page Down change altitude; Home follows the player." onKeyDown={keyDown} onKeyUp={(event) => event.stopPropagation()} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={stopPointer} onPointerCancel={stopPointer} onLostPointerCapture={stopPointer} onContextMenu={(event) => event.preventDefault()} />
    {(!compact||expanded)&&<>
    <div className="cube-map-toolbar" role="group" aria-label="Map camera controls">
      <button type="button" aria-label="Rotate map left" onClick={() => rotate(-.25)}>↶</button><button type="button" aria-label="Rotate map right" onClick={() => rotate(.25)}>↷</button>
      <button type="button" aria-label="Zoom map out" onClick={() => zoom(1 / 1.25)}>−</button><button type="button" aria-label="Zoom map in" onClick={() => zoom(1.25)}>+</button>
      <button type="button" aria-pressed={panMode} onClick={() => setPanMode(!panMode)}>{panMode ? "Pan on" : "Pan"}</button>
      <button type="button" className="cube-map-follow" aria-pressed={view.follow} onClick={recenter}>Follow you</button>
    </div>
    <button type="button" className="cube-map-overview" aria-pressed={Boolean(view.overview)} onClick={() => change(cubeMapOverviewView())}>Whole cube · {CUBE_DIMENSIONS.length} × {CUBE_DIMENSIONS.width} × {CUBE_DIMENSIONS.height}</button>
    <div className="cube-map-slice"><label htmlFor={expanded ? "cube-expanded-altitude" : "cube-altitude"}>Altitude slice <strong>{Math.round(selectedAltitude)} / {CUBE_DIMENSIONS.height}</strong></label><input id={expanded ? "cube-expanded-altitude" : "cube-altitude"} aria-label="Map altitude slice" type="range" min="0" max={CUBE_DIMENSIONS.height - CUBE_STORY_HEIGHT} step={CUBE_STORY_HEIGHT} value={selectedAltitude} onChange={(event) => altitude(Number(event.target.value))} /></div>
    <div className="cube-map-bottom"><span><i className="cube-map-corridor-key" />Passages</span><span><i className="cube-map-ramp-key" />Ramps · 1–10 stories</span><span><i className="cube-map-lift-key" />Lifts · 1–10 stories</span><span><i className="cube-map-you-key" />You</span></div>
    <p className="cube-map-help">Drag to orbit · Shift-drag to pan · Scroll to zoom. Move the altitude slider to inspect passages above and below you.</p>
    </>}
  </section>;
  if(!expanded) return map;
  return createPortal(<div className="cube-map-modal" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="cube-expanded-map-title" onKeyDown={dialogKeys} onPointerDown={(event)=>{if(event.target===event.currentTarget)onToggle?.();}}>{map}</div>,document.body);
}
export default CubeMazeMinimap;
