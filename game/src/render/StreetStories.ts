import {activeNearbyScenes} from '../sim/NearbyScenes';
import {reserveSign} from './ScreenBounds';
import type { Simulation } from "../sim/Simulation";
import type { Camera } from "./Camera";
import { ENCOUNTERS } from "../content/encounters";
/** Only mark an actual nearby story location. No synthetic witnesses or fallback crates. */
export function drawStreetStories(g:CanvasRenderingContext2D,sim:Simulation,cam:Camera,_time:number,_reduceMotion:boolean):void {
 for(const e of activeNearbyScenes(sim).slice(0,2)){const c=sim.chars[e.actors[0]];if(!c||Math.hypot(c.x-sim.player.x,c.y-sim.player.y)>22)continue;const p=cam.toScreen(c.x,c.y,1.9,{x:0,y:0});g.save();g.font='600 11px system-ui';const text=e.title+' · Nearby',w=g.measureText(text).width+16,x=p.x-w/2,y=p.y-24;if(reserveSign('nearby:'+e.id,{x,y,w,h:23})){g.fillStyle='#24342dee';g.fillRect(x,y,w,23);g.fillStyle='#ead8ae';g.textAlign='center';g.fillText(text,p.x,y+16);}g.restore();}
 const scene=sim.life.scene;if(!scene||scene.resolved||scene.id!==sim.expansion.pending)return;
 if(Math.hypot(scene.x-sim.player.x,scene.y-sim.player.y)>8)return;
 const p=cam.toScreen(scene.x,scene.y,0,{x:0,y:0}),title=ENCOUNTERS.find(e=>e.id===scene.id)?.title;
 if(!title)return;
 g.save();g.font="600 12px system-ui, sans-serif";const w=Math.min(210,g.measureText(title).width+24);
 const x=Math.max(8,Math.min(cam.viewW-w-8,p.x-w/2)),y=Math.max(90,Math.min(cam.viewH-100,p.y-38));
 g.fillStyle="#10282fee";g.strokeStyle="#bba46b";g.lineWidth=1;g.beginPath();g.roundRect(x,y,w,27,7);g.fill();g.stroke();g.fillStyle="#ead8ae";g.textAlign="center";g.fillText(title,x+w/2,y+18,w-16);g.restore();
}
