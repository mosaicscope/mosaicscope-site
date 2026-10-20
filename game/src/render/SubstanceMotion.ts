import type { Angles } from './StickFigure';
import { reachArm } from './StickFigure';
import type { Character } from '../entities/types';
import { Phys } from '../entities/types';
import { impairment } from '../sim/Substances';

/** Contextual overlays on the existing skeleton. Feet still follow the real walk cycle. */
export function applySubstanceMotion(a: Angles, c: Character, tick: number, time: number, reduced: boolean): void {
  const state=c.substances;if(!state||c.phys!==Phys.OK||a.lying)return;
  const level=impairment(c), t=time+c.seedPhase, move=Math.hypot(c.vx,c.vy)>.1;
  const action=tick<state.actionUntil;
  if(action){
    const f=Math.max(0,Math.min(1,(tick-state.usedAt)/150)), lift=Math.sin(Math.min(1,f*2)*Math.PI/2);
    if(state.last==='alcohol'){a.armR=.4*lift;a.foreR=2.7*lift;a.tilt=-.14*lift;a.lean=-.06*lift;}
    else if(state.last==='stimulant'){a.armR=.25*lift;a.foreR=2.8*lift;a.lean=.25*lift;a.tilt=.16*lift;a.foreL=1.2*lift;}
    else if(state.last==='cannabis'){a.armR=.65*lift;a.foreR=2.2*lift;a.tilt=-.09*lift;}
    else{a.armL=.45*lift;a.foreL=2.55*lift;a.tilt=-.05*lift;}
    const shx=a.hipX+Math.sin(a.lean)*37*.93, shy=-61+a.bob-Math.cos(a.lean)*37*.93;
    const hx=a.hipX+Math.sin(a.lean)*37+Math.sin(a.lean+a.tilt)*14, hy=-61+a.bob-Math.cos(a.lean)*37-Math.cos(a.lean+a.tilt)*14;
    const targetY=hy+(state.last==='stimulant'?1:7),side=state.last==='sedative'?0:1;
    const angle=side===0?a.armL:a.armR, fore=side===0?a.foreL:a.foreR;
    const oldX=shx+Math.sin(angle+a.lean)*22+Math.sin(angle+fore+a.lean)*17.5;
    const oldY=shy+Math.cos(angle+a.lean)*22+Math.cos(angle+fore+a.lean)*17.5;
    reachArm(a,side,shx,shy,oldX+(hx+3-oldX)*lift,oldY+(targetY-oldY)*lift);
  }else if(state.crisis){a.lean=.32;a.bendL=.35;a.bendR=.28;a.armR=.6;a.foreR=1.7;a.tilt=.25;}
  else if(level>.08){
    const sway=reduced?0:Math.sin(t*1.8)*level*.14;
    a.lean+=sway;a.tilt+=sway*.7;a.hipX+=(reduced?0:Math.sin(t*1.2))*level*2;
    if(state.levels.alcohol+state.levels.sedative>1){a.bendL+=.14;a.bendR+=.08;a.armL+=.12;a.foreR+=.18;}
    if(state.levels.stimulant>.6&&!reduced){a.foreL+=Math.sin(t*9)*.06*level;a.bob+=Math.sin(t*7)*.4*level;}
    if(move){a.thighL*=1-level*.25;a.thighR*=1-level*.12;}
  }else if(tick<state.crashUntil){a.lean+=.13;a.tilt+=.12;}
}

export function drawSubstanceProps(g:CanvasRenderingContext2D,c:Character,tick:number,time:number,j:Float32Array,k:number):void{
  const s=c.substances;if(!s||tick>=s.actionUntil||c.phys!==Phys.OK)return;
  const hand=s.last==='sedative'?10:14, x=j[hand], y=j[hand+1];
  g.save();g.lineWidth=k;g.strokeStyle='#191b18';
  if(s.last==='alcohol'){g.fillStyle='#ab8a43';g.fillRect(x-2.5*k,y-5*k,5*k,10*k);g.strokeRect(x-2.5*k,y-5*k,5*k,10*k);g.fillStyle='#e0d6b9';g.fillRect(x-2*k,y-3*k,4*k,k);}
  else if(s.last==='cannabis'){g.strokeStyle='#ddd6c5';g.lineWidth=1.8*k;g.beginPath();g.moveTo(x,y);g.lineTo(x+5*k,y-2*k);g.stroke();g.fillStyle='#b95f37';g.fillRect(x+4*k,y-3*k,k,2*k);g.strokeStyle='#b4b4ad55';g.lineWidth=k;g.beginPath();g.moveTo(x+5*k,y-3*k);g.bezierCurveTo(x+Math.sin(time*2)*3*k,y-11*k,x+9*k,y-15*k,x+5*k,y-22*k);g.stroke();}
  else if(s.last==='sedative'){g.fillStyle='#d7c8e4';g.beginPath();g.ellipse(x,y,2*k,1.2*k,0,0,7);g.fill();}
  else{g.fillStyle='#d8d3c9';g.beginPath();g.arc(j[4]+2*k,j[5]+2*k,k,0,7);g.fill();}
  g.restore();
}
