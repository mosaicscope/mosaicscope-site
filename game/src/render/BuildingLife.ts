import type { Building } from '../world/World';

type Point = [number, number];
type Project = (x:number,y:number,h:number)=>Point;

/** Deterministic, bounded rooftop animation: no entities, timers or saved state. */
export function paintRoofLife(g:CanvasRenderingContext2D,P:Project,b:Building,tx:number,ty:number,time:number,z:number,alpha:number):void {
  const seed=(Math.imul(tx+1,73856093)^Math.imul(ty+1,19349663)^Math.imul(b.id+1,83492791))>>>0;
  const speed=.7+(seed%997)/997,offset=(seed%991)/991;
  g.save();g.globalAlpha=alpha;
  if(b.kind==='house'){
    if(tx===b.x0&&ty===b.y0)for(let i=0;i<4;i++){
      const phase=(time*.09*speed+i/4+offset)%1,p=P(tx+.4+phase*.17,ty+.4,b.height+1.5+phase*1.2);
      g.globalAlpha=alpha*Math.sin(phase*Math.PI)*.25;g.fillStyle='#d5d9df';g.beginPath();g.ellipse(...p,(1+phase*4)*z,(1+phase*2)*z,0,0,Math.PI*2);g.fill();
    }
    g.restore();return;
  }
  if(seed%7===0||(tx===b.x1&&ty===b.y1)){
    const hub=P(tx+.48,ty+.48,b.height+.28);
    g.fillStyle='#555e60';g.beginPath();g.ellipse(...hub,6*z,3*z,0,0,Math.PI*2);g.fill();
    g.strokeStyle='#b6c1bc';g.lineWidth=Math.max(.7,z);g.beginPath();
    for(let i=0;i<4;i++){const a=time*2.3*speed+offset*6.283+i*Math.PI/2;g.moveTo(...hub);g.lineTo(hub[0]+Math.cos(a)*4.5*z,hub[1]+Math.sin(a)*2.2*z);}
    g.stroke();
    for(let i=0;i<3;i++){
      const phase=(time*.14*speed+i/3+offset)%1,p=P(tx+.48+phase*.22,ty+.48,b.height+.4+phase*.9);
      g.globalAlpha=alpha*(1-phase)*.19;g.fillStyle='#d5e1df';g.beginPath();g.ellipse(...p,(1.5+phase*4)*z,(1+phase*2)*z,0,0,Math.PI*2);g.fill();
    }
  }
  // One mast per building: fluttering pennant and slow obstruction beacon.
  if(tx===b.x1&&ty===b.y0){
    g.globalAlpha=alpha;
    const foot=P(tx+.65,ty+.45,b.height),tip=P(tx+.65,ty+.45,b.height+1);
    g.strokeStyle='#929c9d';g.lineWidth=Math.max(.7,z);g.beginPath();g.moveTo(...foot);g.lineTo(...tip);g.stroke();
    const wind=(Math.sin(time*1.7*speed+offset*6.283)+Math.sin(time*3.1*speed)*.3)*2*z;
    g.fillStyle=b.sign;g.beginPath();g.moveTo(tip[0],tip[1]+z);g.lineTo(tip[0]+7*z,tip[1]+2*z+wind);g.lineTo(tip[0]+6*z,tip[1]+6*z+wind*.5);g.lineTo(tip[0],tip[1]+5*z);g.closePath();g.fill();
    if(b.floors>=4){g.fillStyle=`rgba(255,91,67,${.35+.65*Math.pow((1+Math.sin(time*2+b.id))*.5,4)})`;g.beginPath();g.arc(...tip,1.4*z,0,Math.PI*2);g.fill();}
  }
  g.restore();
}
