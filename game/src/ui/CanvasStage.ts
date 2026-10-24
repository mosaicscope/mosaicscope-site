import { h } from "./dom";

export interface StagePointer { x: number; y: number; down: boolean; type: string }
export interface StageSize {width:number;height:number}
export interface StageCamera {scale:number;x:number;y:number}
export function stagePoint(x:number,y:number,W:number,H:number,camera?:StageCamera):{x:number;y:number}{return camera?{x:(x-W/2)/camera.scale+camera.x,y:(y-H/2)/camera.scale+camera.y}:{x,y};}
export interface StageOptions { camera?:()=>StageCamera;wheel?:(delta:number)=>void;layout?:()=>StageSize;label: string; overlay?:HTMLElement; fps?:number; width?: number; height?: number; pointer?: (p: StagePointer) => void; key?: (key: string) => void }
/** Each scene owns its RAF and stops as soon as its modal is removed. Coordinates stay device-independent. */
export function canvasStage(draw: (g: CanvasRenderingContext2D, time: number, reduced: boolean,size:StageSize) => void, options: StageOptions): HTMLElement {
  let W = options.layout?.().width??options.width??960, H = options.layout?.().height??options.height??480;let dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = h("canvas.play-scene", { width: W * dpr, height: H * dpr, role: "img", "aria-label": options.label, tabindex: options.key ? 0 : undefined, style: `aspect-ratio:${W}/${H}` }) as HTMLCanvasElement;
  const g = cv.getContext("2d")!, reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  let down = false;
  const point = (e: PointerEvent, type: string) => {
    if (!options.pointer) return;
    const r=cv.getBoundingClientRect(),fit=Math.min(r.width/W,r.height/H),p=stagePoint((e.clientX-r.left-(r.width-W*fit)/2)/fit,(e.clientY-r.top-(r.height-H*fit)/2)/fit,W,H,options.camera?.());options.pointer({...p,down,type});
  };
  cv.addEventListener("pointerdown", e => { down = true; if (options.pointer) { e.preventDefault(); cv.setPointerCapture(e.pointerId); } point(e, "down"); });
  cv.addEventListener("pointermove", e => point(e, "move"));
  cv.addEventListener("pointerup", e => { point(e, "up"); down = false; });
  cv.addEventListener("pointercancel", () => { down = false; });
  if(options.wheel)for(const target of [cv,options.overlay].filter((e):e is HTMLElement=>!!e))target.addEventListener('wheel',e=>{e.preventDefault();options.wheel!((e as WheelEvent).deltaY);},{passive:false});
  cv.addEventListener("keydown", e => { if (options.key && [" ", "Enter"].includes(e.key)) { e.preventDefault(); options.key(e.key); } });
  let elapsed=0,previous=performance.now();
  let visible=true,lastDraw=0;
  const observer=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;}):null;
  observer?.observe(cv);
  const frame = (now: number) => {
    if (!cv.isConnected || cv.closest(".hidden")){observer?.disconnect();return;}
    if(!visible||document.hidden){previous=now;requestAnimationFrame(frame);return;}if(now-lastDraw<1000/(options.fps??30)-1){requestAnimationFrame(frame);return;}lastDraw=now;elapsed+=Math.min(.1,Math.max(0,(now-previous)/1000));previous=now;
    const layout=options.layout?.();if(layout){W=layout.width;H=layout.height;}const bounds=cv.getBoundingClientRect();dpr=Math.min(2,window.devicePixelRatio||1);if(cv.width!==Math.round(bounds.width*dpr)||cv.height!==Math.round(bounds.height*dpr)){cv.width=Math.round(bounds.width*dpr);cv.height=Math.round(bounds.height*dpr);}const fit=Math.min(bounds.width/W,bounds.height/H);
    const camera=options.camera?.(),cx=camera?W/2-camera.x*camera.scale:0,cy=camera?H/2-camera.y*camera.scale:0,zoom=camera?.scale??1;
    if(options.overlay){options.overlay.style.transform=`translate(${(bounds.width-W*fit)/2+cx*fit}px,${(bounds.height-H*fit)/2+cy*fit}px) scale(${fit*zoom})`;}
    g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle='#202925';g.fillRect(0,0,bounds.width,bounds.height);g.save();g.beginPath();g.rect((bounds.width-W*fit)/2,(bounds.height-H*fit)/2,W*fit,H*fit);g.clip();g.translate((bounds.width-W*fit)/2+cx*fit,(bounds.height-H*fit)/2+cy*fit);g.scale(fit*zoom,fit*zoom);draw(g,elapsed,reduce,{width:W,height:H});g.restore();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return h("figure.play-stage", {style:options.overlay?"position:relative":undefined}, [cv,options.overlay??null]);
}

export function roundBox(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string): void {
  g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); }
}
export function sceneText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size = 18, color = "#f1edda", align: CanvasTextAlign = "center"): void {
  g.font = `500 ${size}px system-ui, sans-serif`; g.textAlign = align; g.fillStyle = color; g.fillText(text, x, y);
}
export function felt(g: CanvasRenderingContext2D, W = 960, H = 480): void {
  const gradient = g.createRadialGradient(W / 2, H / 3, 20, W / 2, H / 2, W * 0.7);
  gradient.addColorStop(0, "#245b49"); gradient.addColorStop(1, "#0b2924"); g.fillStyle = gradient; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#b8aa6b22"; g.lineWidth = 1;
  for (let x = -H; x < W; x += 35) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.stroke(); }
  roundBox(g, 17, 17, W - 34, H - 34, 28, "#00000000", "#ceb87955");
}
export function playingCard(g: CanvasRenderingContext2D, x: number, y: number, rank: number, suit = "♠", flip = 1, scale = 1): void {
  g.save(); g.translate(x, y); g.scale(Math.max(0.025, Math.abs(Math.cos((1 - flip) * Math.PI))), 1); g.scale(scale, scale);
  g.shadowColor = "#0006"; g.shadowBlur = 14; g.shadowOffsetY = 6;
  roundBox(g, -39, -54, 78, 108, 7, flip < 0.5 ? "#183a50" : "#fcf7e9", "#f1dec299"); g.shadowBlur = 0; g.shadowOffsetY = 0;
  if (flip < 0.5) { roundBox(g, -31, -46, 62, 92, 4, "#173645", "#d5c483"); sceneText(g, "◆", 0, 12, 40, "#d5c483"); }
  else {
    const red = suit === "♥" || suit === "♦", color = red ? "#bd4a48" : "#18362e", label = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][rank] ?? "A";
    sceneText(g, label, -25, -30, 19, color); sceneText(g, suit, -25, -10, 15, color);
    sceneText(g, suit, 0, 21, 43, color); sceneText(g, label, 25, 43, 17, color);
  }
  g.restore();
}
export function die(g: CanvasRenderingContext2D, x: number, y: number, value: number, rotation = 0, scale = 1): void {
  g.save(); g.translate(x, y); g.rotate(rotation); g.scale(scale, scale);
  g.shadowColor = "#0006"; g.shadowBlur = 15; g.shadowOffsetY = 8;
  roundBox(g, -32, -32, 64, 64, 12, "#f6ecd4", "#c4b18c"); g.shadowBlur = 0; g.shadowOffsetY = 0;
  const points: Record<number, [number, number][]> = { 1: [[0, 0]], 2: [[-15, -15], [15, 15]], 3: [[-15, -15], [0, 0], [15, 15]], 4: [[-15, -15], [15, -15], [-15, 15], [15, 15]], 5: [[-15, -15], [15, -15], [0, 0], [-15, 15], [15, 15]], 6: [[-15, -17], [15, -17], [-15, 0], [15, 0], [-15, 17], [15, 17]] };
  for (const [px, py] of points[value] ?? points[1]) { g.fillStyle = "#17352e"; g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
