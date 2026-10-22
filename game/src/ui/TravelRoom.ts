import {activityAt} from './SceneMotion';
import {InteriorView,type ViewActor} from '../render/InteriorView';
import type {Character} from '../entities/types';
import type {InteriorDef} from '../content/interiors';
import {findPath,moveInside,type Pt} from '../content/interiorNav';
/** Lightweight travel adapter over the town's existing interior renderer and pathing. */
export class TravelRoom{
 effect:string|null=null;
 private view:InteriorView;private me:ViewActor;private actors:ViewActor[];private path:Pt[]=[];private previous=0;private actionUntil=0;
 private keys=new Set<string>();private routes=new Map<string|number,Pt[]>();
 constructor(private canvas:HTMLCanvasElement,private def:InteriorDef,people:readonly Character[],player:Character){
  this.view=new InteriorView(canvas);this.view.setDef(def);
  const actor=(c:Character,x:number,y:number):ViewActor=>({id:c.id,char:c,look:c.look,x,y,dir:1,pose:'idle',phase:0,poseT:0,speed:0,seed:c.id,style:'normal',name:c.name});
  this.me={...actor(player,def.door.x,def.door.y),isPlayer:true};
  this.actors=people.filter(c=>c.id!==player.id).slice(0,Math.min(8,def.spots.length)).map((c,i)=>actor(c,def.spots[i].x,def.spots[i].y));
  canvas.addEventListener('pointerdown',this.click);window.addEventListener('keyup',this.up,true);window.addEventListener('blur',this.blur);
 }
 key(e:KeyboardEvent):boolean{if(!/^(w|a|s|d|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/i.test(e.key))return false;this.keys.add(e.key.toLowerCase());this.path=[];e.preventDefault();return true;}
 private up=(e:KeyboardEvent)=>{this.keys.delete(e.key.toLowerCase());};private blur=()=>this.keys.clear();
 private click=(e:PointerEvent)=>{const r=this.canvas.getBoundingClientRect(),p=this.view.groundPoint(e.clientX-r.left,e.clientY-r.top);this.path=findPath(this.def,this.me,{x:p.x,y:p.y})??[];};
 dispose():void{this.canvas.removeEventListener('pointerdown',this.click);window.removeEventListener('keyup',this.up,true);window.removeEventListener('blur',this.blur);this.keys.clear();}
 use():string{this.effect=null;const q=this.def.interactables.find(i=>Math.hypot(i.x-this.me.x,i.y-this.me.y)<2);if(q){this.effect=q.effect??null;this.me.pose=q.effect==='rest'?'sit':q.effect==='eat'?'eat':/shower|wash/i.test(q.label)?'clean':/bag|luggage/i.test(q.label)?'give':/screen|display|book/i.test(q.label)?'inspect':'press';this.actionUntil=performance.now()+3500;this.me.dir=q.x-q.y>=this.me.x-this.me.y?1:-1;return q.text;}return 'Walk or tap towards a service to use it.';}
 draw(now:number):void{
  const dt=Math.min(.05,this.previous?(now-this.previous)/1000:0);this.previous=now;const t=now/1000;
  let sx=Number(this.keys.has('d')||this.keys.has('arrowright'))-Number(this.keys.has('a')||this.keys.has('arrowleft')),sy=Number(this.keys.has('s')||this.keys.has('arrowdown'))-Number(this.keys.has('w')||this.keys.has('arrowup'));
  // Convert screen directions to the same isometric axes as the street controls.
  if(sx||sy){const len=Math.hypot(sx,sy),dx=(sx+sy)/len,dy=(sy-sx)/len;const p=moveInside(this.def,this.me.x,this.me.y,dx*dt*2,dy*dt*2);this.advance(this.me,p,dt);}
  else if(now>=this.actionUntil||this.path.length)this.walk(this.me,this.path,dt);
  for(let i=0;i<this.actors.length;i++){const a=this.actors[i],s=this.def.spots[i];let route=this.routes.get(a.id)??[];
   if(s.doing==='work'||s.doing==='sit'){a.pose=activityAt(+a.seed,t,s.doing==='sit'?'lounge':'work');a.speed=0;continue;}
   if(!route.length&&Math.sin(t*.3+i)>.98){const target=this.def.spots[(i+2)%this.def.spots.length];route=findPath(this.def,a,target)??[];this.routes.set(a.id,route);}this.walk(a,route,dt);
  }
  const r=this.canvas.getBoundingClientRect();this.view.resize(r.width,r.height,Math.min(devicePixelRatio,2));this.view.render({t,hour:12,player:this.me,actors:this.actors,near:null,nearActor:null,exitNear:false},this.def);
 }
 private advance(a:ViewActor,p:Pt,dt:number):void{const dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy);a.x=p.x;a.y=p.y;a.speed=dt?d/dt:0;a.pose=d>.001?'walk':'idle';if(d>.001){a.dir=dx-dy>=0?1:-1;a.phase+=d*3.8;}}
 private walk(a:ViewActor,path:Pt[],dt:number):void{const q=path[0];if(!q){a.speed=0;if(a===this.me){if(performance.now()>=this.actionUntil)a.pose='idle';}else a.pose=activityAt(+a.seed,performance.now()/1000,'queue');return;}const d=Math.hypot(q.x-a.x,q.y-a.y);if(d<.1){path.shift();return;}const f=Math.min(1,dt*2/d);this.advance(a,moveInside(this.def,a.x,a.y,(q.x-a.x)*f,(q.y-a.y)*f),dt);}
}
