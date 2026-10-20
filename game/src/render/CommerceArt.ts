import type {Simulation} from '../sim/Simulation';
import type {Camera} from './Camera';
/** Small world-space deliveries and readable, event-timed comic impacts. */
export function drawCommerceArt(g:CanvasRenderingContext2D,sim:Simulation,cam:Camera,reduceMotion:boolean):void {
 g.save();const p={x:0,y:0};
 let count=0;
 for(const c of sim.chars){const age=(sim.tick-c.lastHitTick)/60;if(!c.stats.hitsTaken||age<0||age>1.1||c.inside>=0||c.inCar>=0)continue;cam.toScreen(c.x,c.y,2.3,p);if(p.x<0||p.y<70||p.x>cam.viewW||p.y>cam.viewH-80)continue;if(count++>=5)break;const z=Math.min(1.5,cam.zoom),rise=reduceMotion?0:age*18;g.globalAlpha=Math.min(1,(1.1-age)*3);g.font=`800 ${Math.round(15*z)}px Arial`;g.lineWidth=3*z;g.strokeStyle='#1d211c';g.fillStyle='#e1c997';g.textAlign='center';const text=['OOF!','OI!','BONK!','WHAM!'][c.stats.hitsTaken%4];g.strokeText(text,p.x,p.y-rise);g.fillText(text,p.x,p.y-rise);}
 g.restore();
}

export function drawCommerceObject(g:CanvasRenderingContext2D,sim:Simulation,cam:Camera,reduceMotion:boolean,index:number):void {
 g.save();const p={x:0,y:0};
 for(const order of [sim.commerce.purchases[Math.floor(index/2)]]){if(!order)continue;const b=sim.world.buildings[order.building];if(!b)continue;
  if(index%2===0&&order.sku.startsWith('civic:')){cam.toScreen(b.door.x+1,b.door.y+.8,0,p);g.save();g.translate(p.x,p.y);g.scale(cam.zoom,cam.zoom);if(order.sku==='civic:cone'){g.fillStyle='#c68445';g.beginPath();g.moveTo(0,-13);g.lineTo(6,0);g.lineTo(-6,0);g.closePath();g.fill();g.strokeStyle='#ded1ad';g.lineWidth=2;g.beginPath();g.moveTo(-2,-7);g.lineTo(2,-7);g.stroke();}else{g.fillStyle='#69654e';g.fillRect(-9,-6,18,7);g.strokeStyle='#a68d65';g.lineWidth=3;g.beginPath();g.moveTo(0,-23);g.lineTo(0,-12);g.lineTo(-4,-6);g.moveTo(0,-12);g.lineTo(4,-6);g.moveTo(-6,-17);g.lineTo(0,-20);g.lineTo(6,-17);g.stroke();g.fillStyle='#a68d65';g.beginPath();g.arc(0,-28,5,0,Math.PI*2);g.fill();}g.restore();}
  if(index%2===0&&order.sku==='defense:launcher'){cam.toScreen(b.door.x,b.door.y,0,p);g.save();g.translate(p.x,p.y);g.scale(cam.zoom,cam.zoom);g.fillStyle='#4f5c4d';g.strokeStyle='#171d19';g.lineWidth=2;g.fillRect(-8,-5,16,7);g.strokeRect(-8,-5,16,7);g.lineWidth=4;g.beginPath();g.moveTo(0,-4);g.lineTo(8,-14);g.stroke();g.restore();}
  const f=index%2?order.flight:undefined;if(f){const t=Math.max(0,Math.min(1,(sim.tick-f.at)/(f.until-f.at))),x=b.door.x+(f.x-b.door.x)*t,y=b.door.y+(f.y-b.door.y)*t;cam.toScreen(x,y,Math.sin(t*Math.PI)*8+.5,p);g.fillStyle='#d0c5a4';g.strokeStyle='#504f45';g.lineWidth=2;g.beginPath();g.ellipse(p.x,p.y,7*cam.zoom,2.4*cam.zoom,-.6,0,Math.PI*2);g.fill();g.stroke();if(!reduceMotion){g.fillStyle='#d89b5c88';g.beginPath();g.arc(p.x-6*cam.zoom,p.y+3*cam.zoom,3*cam.zoom,0,Math.PI*2);g.fill();}}
 }
 g.restore();
}
