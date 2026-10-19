import type {Angles} from './StickFigure';

/** Same bone lengths as solve(), in unscaled figure space. */
export function handAt(a:Angles,side:0|1,x:number,y:number):void{
 const sx=a.hipX+Math.sin(a.lean)*37*.93,sy=-61+a.bob-Math.cos(a.lean)*37*.93;
 const sideOffset=(side===0?-1:1)*4.42;
 const dx=x-sx-sideOffset*Math.cos(a.lean),dy=y-sy-sideOffset*Math.sin(a.lean),d=Math.max(.001,Math.min(39.49,Math.hypot(dx,dy))),base=Math.atan2(dx,dy);
 const upper=base-Math.acos(Math.max(-1,Math.min(1,(22*22+d*d-17.5*17.5)/(44*d))));
 const fore=Math.atan2(dx-Math.sin(upper)*22,dy-Math.cos(upper)*22)-upper;
 if(side===0){a.armL=upper-a.lean;a.foreL=fore;}else{a.armR=upper-a.lean;a.foreR=fore;}
}
export function headFrame(a:Angles){const angle=a.lean+a.tilt;return{x:a.hipX+Math.sin(a.lean)*37+Math.sin(angle)*17,y:-61+a.bob-Math.cos(a.lean)*37-Math.cos(angle)*17,angle};}
const contacts:Record<string,[number,number,number][]>= {
 tl:[[0,-10,-2]],tr:[[1,10,-2]],tt:[[0,-10,-2],[1,10,-2]],fh:[[0,0,-9]],el:[[0,-7,0]],er:[[1,7,0]],fc:[[0,-6,3],[1,6,3]],br:[[1,0,0]],
 ml:[[0,-9,7]],mr:[[1,9,7]],slv:[[0,-6,5]],mb:[[1,0,9]],ch:[[0,0,14]],he:[[0,-15,0],[1,15,0]],rb:[[0,-6,0],[1,6,0]],yh:[[1,0,10]],ws:[[1,0,-9]],
};
export function contactPose(key:string,a:Angles):Angles{
 const targets=contacts[key];if(!targets)return a;const h=headFrame(a),co=Math.cos(h.angle),si=Math.sin(h.angle);
 for(const [side,x,y]of targets)handAt(a,side as 0|1,h.x+x*co-y*si,h.y+x*si+y*co);return a;
}
function foot(a:Angles,side:0|1,x:number,y:number){
 const dx=x-a.hipX,dy=y-(-61+a.bob),d=Math.max(.1,Math.min(60.999,Math.hypot(dx,dy)));
 const bend=Math.acos(Math.max(-1,Math.min(1,(d*d-30*30-31*31)/(2*30*31))));
 const thigh=Math.atan2(dx,dy)+Math.atan2(31*Math.sin(bend),30+31*Math.cos(bend));
 if(side===0){a.thighL=thigh;a.bendL=bend;}else{a.thighR=thigh;a.bendR=bend;}
}
const ease=(v:number)=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
/** Weight transfer -> lift -> fast strike -> compression -> settle. The support foot never slides. */
export function stampPose(a:Angles,side:0|1,u:number):void{
 const shift=ease(u/.2)*(1-ease((u-.8)/.2));
 const lift=30*ease((u-.16)/.28)*(1-ease((u-.47)/.16));
 const impact=ease((u-.6)/.04)*(1-ease((u-.72)/.16));
 a.hipX=(side===0?3:-3)*shift;a.bob=2*shift+7*impact;
 a.lean=.08+.06*impact;a.tilt=-a.lean*.6;
 foot(a,side===0?1:0,0,0);foot(a,side,(side===0?-7:7)*shift,-lift);
}
/** Keep the lowest foot on the floor instead of moving both feet through it. */
export function groundReaction(a:Angles):void{
 const fy=(thigh:number,bend:number)=>-61+a.bob+30*Math.cos(thigh)+31*Math.cos(thigh-bend);
 a.bob-=Math.max(fy(a.thighL,a.bendL),fy(a.thighR,a.bendR));
}
