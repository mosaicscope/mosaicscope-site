import {activityAt,routeAt} from './SceneMotion';
import {roundBox,sceneText} from './CanvasStage';
import {pose,solve,drawFigure,J} from '../render/StickFigure';
import type {Character} from '../entities/types';

export interface CabinState {
 first:boolean;tablet?:boolean;headphonePairs?:number;seat:'window'|'aisle';
 meal:number;snack:string;headphones:boolean;blanket:boolean;service:string;
}
type G=CanvasRenderingContext2D;
type Point=[number,number];
type Project=(x:number,y:number,z?:number)=>Point;
const C={ink:'#303b38',floor:'#424e4c',seam:'#70796d',cream:'#d8d1bb',light:'#ebe4d0',
 teal:'#526e70',tealTop:'#7e9690',tealSide:'#3f565b',gold:'#b49a6d',wood:'#8e785b',
 leather:'#786956',leatherTop:'#ab9573',leatherSide:'#5d5146',metal:'#98a59b'};
const TAU=Math.PI*2;
const crewCast=new WeakMap<Character,Character>();
function dressedCrew(source:Character|undefined):Character|undefined{
 if(!source)return undefined;
 let actor=crewCast.get(source);if(!actor){actor={...source};crewCast.set(source,actor);}
 Object.assign(actor,source);actor.look={...source.look,main:true,color:'#789d91',top:'vest',bottom:'slacks'};return actor;
}

function path(g:G,points:Point[]):void{g.beginPath();points.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();}
function poly(g:G,points:Point[],fill:string,stroke=C.ink):void{path(g,points);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=.8;g.stroke();}}
function line(g:G,a:Point,b:Point,color:string,width=1):void{g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();}
function block(g:G,P:Project,x:number,y:number,w:number,d:number,h:number,z:number,top:string,front:string,side:string):void{
 poly(g,[P(x,y+d,z),P(x+w,y+d,z),P(x+w,y+d,z+h),P(x,y+d,z+h)],front);
 poly(g,[P(x+w,y,z),P(x+w,y+d,z),P(x+w,y+d,z+h),P(x+w,y,z+h)],side);
 poly(g,[P(x,y,z+h),P(x+w,y,z+h),P(x+w,y+d,z+h),P(x,y+d,z+h)],top);
}
function ellipse(g:G,x:number,y:number,rx:number,ry:number,fill:string):void{g.fillStyle=fill;g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);g.fill();}
function figure(g:G,c:Character|undefined,x:number,y:number,k:number,doing:string,t:number,dir=1):void{
 if(!c)return;g.save();ellipse(g,x,y+1,13*k,4*k,'#172b2b33');
 solve(pose(doing,'normal',t,doing==='walk'?t*2.8:0,doing==='walk'?.3:0,0),x,y,k,dir);drawFigure(g,c,x,y,k,dir,t,0,1);g.restore();
}

/** One scenic sky/wing model is shared by the close window and cutaway windows. */
function scenery(g:G,x:number,y:number,w:number,h:number,t:number,p:number,reduced:boolean):void{
 g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.translate(x,y);g.scale(w/420,h/280);
 const sky=g.createLinearGradient(0,0,0,280);sky.addColorStop(0,'#476e88');sky.addColorStop(.58,'#91b1bd');sky.addColorStop(1,'#e7d5b2');g.fillStyle=sky;g.fillRect(0,0,420,280);
 const time=reduced?0:t,low=p<.18||p>.86;
 // Ground follows altitude; distant land sits behind the cloud deck, never over the wing.
 if(low){const horizon=155+Math.sin(p*Math.PI)*48;
  poly(g,[[-60,horizon],[80,horizon-12],[180,horizon+6],[290,horizon-18],[480,horizon+5],[480,300],[-60,300]],'#6c8370','');
  for(let i=0;i<26;i++){const xx=((i*79-time*18)%530+530)%530-60,yy=horizon+20+(i%4)*26;
   poly(g,[[xx,yy],[xx+48,yy-10],[xx+86,yy+7],[xx+38,yy+17]],['#8c9876','#788c70','#b0aa80','#637f77'][i%4],'#cad0a21c');
   if(i%5===0){poly(g,[[xx,yy-4],[xx+11,yy-7],[xx+20,yy-2],[xx+9,yy+2]],'#c9c2a5','');poly(g,[[xx+9,yy+2],[xx+20,yy-2],[xx+20,yy+4],[xx+9,yy+7]],'#636b61','');}
  }
  g.strokeStyle='#b2c1b6';g.lineWidth=7;g.beginPath();g.moveTo(-20,horizon+62);g.bezierCurveTo(110,horizon+6,230,horizon+94,470,horizon+30);g.stroke();
 }
 for(let layer=0;layer<2;layer++)for(let i=0;i<5;i++){const xx=((i*137-time*(layer?13:5)+layer*47)%620+620)%620-110,yy=45+layer*61+i%3*16;
  ellipse(g,xx,yy,52+layer*22,10+layer*5,layer?'#f4f0dcad':'#e6e8d555');ellipse(g,xx+24,yy-9,28+layer*12,13+layer*4,layer?'#f5f2e5c4':'#edf0e466');
 }
 // Tapered wing, separate slats, flap hinges, fairings, engine and navigation light.
 const flex=reduced?0:Math.sin(t*1.1)*1.2;
 poly(g,[[-25,261],[126,239],[360,143+flex],[395,111+flex],[386,155+flex],[176,258],[44,283]],'#c6d0cd','#637b86');
 poly(g,[[126,239],[360,143+flex],[348,159+flex],[174,249]],'#e6e6d7','#92a3a1');
 poly(g,[[360,143+flex],[395,111+flex],[402,92+flex],[386,125+flex]],'#819c9f','#617d87');
 for(const f of[.25,.48,.7]){const xx=142+f*185,yy=242-f*76;line(g,[xx,yy],[xx+33,yy-9],'#7f9398',1);}
 for(const xx of[163,221])poly(g,[[xx,239-(xx-140)*.4],[xx+16,233-(xx-140)*.4],[xx+24,247-(xx-140)*.4],[xx+14,252-(xx-140)*.4]],'#97a6a6','#768c90');
 ellipse(g,118,262,39,16,'#758b91');ellipse(g,90,260,16,14,'#ccd3cc');ellipse(g,88,260,10,10,'#3b535e');ellipse(g,88,260,4,6,'#718b92');
 ellipse(g,391,116+flex,2,1.5,'#ba7b68');
 g.restore();
}
function windowPane(g:G,points:Point[],t:number,p:number,reduced:boolean):void{
 poly(g,points,'#a5aca0','#6d7c78');g.save();path(g,points);g.clip();
 const xs=points.map(a=>a[0]),ys=points.map(a=>a[1]);scenery(g,Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),t,p,reduced);g.restore();
 path(g,points);g.strokeStyle='#e9e0c9';g.lineWidth=4;g.stroke();line(g,points[0],points[2],'#f5ebd32b',1);
}

export const CABIN_SEATS={economy:{width:.68,depth:.86,pitch:1.9},first:{width:.98,depth:1.24,pitch:2.65}};
function seat(g:G,P:Project,x:number,y:number,first:boolean,c:Character|undefined,t:number):void{
 const spec=first?CABIN_SEATS.first:CABIN_SEATS.economy,width=spec.width,depth=spec.depth,top=first?C.leatherTop:C.tealTop,front=first?C.leather:C.teal,side=first?C.leatherSide:C.tealSide;
 for(const [dx,dy]of[[.15,.1],[depth-.16,width-.1]])block(g,P,x+dx,y+dy,.055,.055,.46,.025,C.metal,'#626f68','#465552');
 block(g,P,x,y,depth,width,.14,.48,top,front,side);
 block(g,P,x-.035,y,.17,width,1.05,.57,top,front,side);
 block(g,P,x+.02,y+.075,.12,width-.15,.28,1.3,C.cream,'#bdb59e','#a79f8c');
 // One separate cushion, a headrest, lumbar pad, piping, recline hinge and seat pocket.
 block(g,P,x+.18,y+.07,depth-.25,width-.14,.05,.62,top,front,side);
 block(g,P,x+.15,y+.07,.045,width-.14,.32,.71,top,front,side);
 for(const dy of[.015,width-.085])block(g,P,x+.16,y+dy,depth-.12,.07,.085,.81,'#a5a99b','#727f77','#5c6d68');
 line(g,P(x+.2,y+.1,.68),P(x+depth-.1,y+.1,.68),'#dfd9be77',.6);line(g,P(x+depth-.1,y+.1,.68),P(x+depth-.1,y+width-.1,.68),'#dfd9be77',.6);
 if(first){block(g,P,x-.1,y-.1,.19,width+.2,.08,1.63,C.cream,'#aaa58c','#7f8474');block(g,P,x+.3,y+width+.03,depth-.25,.25,.56,.05,C.wood,'#7b6b52','#655c47');}
 if(c){const k=Math.hypot(P(0,0,1)[0]-P(0,0)[0],P(0,0,1)[1]-P(0,0)[1])/26*.44,hip=P(x+.29,y+width*.5,.67),doing=activityAt(c.id,t,'lounge'),a=pose(doing==='talk'?'inspect':doing,'normal',t+c.id*.3,0,0,0);solve(a,hip[0],hip[1]+(61-a.bob)*k,k,1);
  const reach=(n:number,origin:number,end:Point,l1:number,l2:number,bend:number)=>{const ox=J[origin],oy=J[origin+1],dx=end[0]-ox,dy=end[1]-oy,d=Math.max(Math.abs(l1-l2)+.01,Math.min(l1+l2-.01,Math.hypot(dx,dy))),angle=Math.atan2(dy,dx),b=Math.acos(Math.max(-1,Math.min(1,(d*d+l1*l1-l2*l2)/(2*d*l1))));J[n]=ox+Math.cos(angle+b*bend)*l1;J[n+1]=oy+Math.sin(angle+b*bend)*l1;J[n+2]=ox+Math.cos(angle)*d;J[n+3]=oy+Math.sin(angle)*d;};
  for(const [n,sgn]of[[16,-1],[20,1]])reach(n,0,P(x+depth+.13,y+width*.5+sgn*.11,.055),30*k,31*k,-1);
  for(const [n,sgn]of[[8,-1],[12,1]]){const hand=doing==='sitdrink'&&n===12?[J[4]+9*k,J[5]+12*k] as Point:P(x+.58,y+width*.5+sgn*(width*.33),.82);reach(n,6,hand,22*k,17.5*k,1);}
  drawFigure(g,c,hip[0],hip[1],k,1,t,0,1,undefined,true);
  if(doing==='sitdrink')cup(g,J[14],J[15]+3*k,.27);else if(doing==='inspect'||doing==='talk'){const h=[(J[10]+J[14])/2,(J[11]+J[15])/2] as Point;roundBox(g,h[0]-6*k,h[1]-5*k,13*k,8*k,1,'#c5cfb9','#5f756a');line(g,[h[0],h[1]-5*k],[h[0],h[1]+3*k],'#7f9485',.5);}
 }
 block(g,P,x+.16,y+width-.07,depth-.12,.075,.085,.82,'#adb09d','#788579','#5d7068');
 line(g,P(x+.31,y+.1,.7),P(x+.48,y+width-.12,.7),'#31483e',1.5);const buckle=P(x+.43,y+width*.55,.71);roundBox(g,buckle[0]-1.5,buckle[1]-1,3,2,.5,'#c6c9b1','#6c806d');
 const hinge=P(x+.12,y+width+.01,.62);ellipse(g,...hinge,1.7,1.5,'#adb7a1');
}
function cup(g:G,x:number,y:number,k=1):void{
 g.save();g.translate(x,y);g.scale(k,k);poly(g,[[-7,-14],[7,-14],[6,1],[-6,1]],'#e5dfc9','#89988d');ellipse(g,0,-14,7,3,'#f0ebda');ellipse(g,0,-14,5,1.5,'#8b7256');
 g.strokeStyle='#c2c4b0';g.lineWidth=2;g.beginPath();g.arc(8,-7,4,-1.5,1.5);g.stroke();g.restore();
}
function serviceTray(g:G,x:number,y:number,k:number,s:CabinState,t:number,reduced:boolean):void{
 g.save();g.translate(x,y);g.scale(k,k);
 const P:Project=(a,b,z=0)=>[(a-b)*16,(a+b)*8-z*16];
 block(g,P,-3,-1.6,6,3.2,.15,0,s.first?'#b8a17b':'#acb7a7',s.first?'#816b50':'#697d75','#566b64');
 poly(g,[P(-2.8,-1.4,.17),P(2.8,-1.4,.17),P(2.8,1.4,.17),P(-2.8,1.4,.17)],'#ded7bf','#bdb398');
 if(s.meal){const q=P(0,0,.2);ellipse(g,...q,27,13,'#f7eed8');ellipse(g,q[0],q[1]-1,21,9,['#b49053','#aa785b','#b68977'][Math.min(2,s.meal-1)]);
  if(s.meal===1){for(let i=0;i<5;i++)ellipse(g,q[0]-11+i*5,q[1]-2+i%2*3,2,1.1,'#74895e');}
  if(s.meal===2){for(let i=0;i<3;i++){ellipse(g,q[0]+8+i*4,q[1]-3+i%2*3,4,2,'#748c5b');}line(g,[q[0]-14,q[1]],[q[0]-3,q[1]+3],'#d2aa79',3);}
  if(s.meal===3){poly(g,[[q[0]-9,q[1]-7],[q[0]+10,q[1]-3],[q[0]+5,q[1]+5],[q[0]-10,q[1]+1]],'#e0c2a0','#9c7f67');ellipse(g,q[0]+1,q[1]-4,4,2,'#9d5e57');}
  if(s.meal===1&&!reduced){g.strokeStyle='#f3ead47a';g.lineWidth=.7;for(let i=0;i<2;i++){const sx=q[0]-7+i*13;g.beginPath();g.moveTo(sx,q[1]-9);g.bezierCurveTo(sx+Math.sin(t*1.4)*3,q[1]-14,sx-3,q[1]-18,sx+1,q[1]-24);g.stroke();}}
 }
 if(s.snack){const q=P(-1.9,-.45,.2);poly(g,[[q[0]-11,q[1]-6],[q[0]+9,q[1]-3],[q[0]+8,q[1]+6],[q[0]-12,q[1]+3]],s.snack==='Fruit'?'#b1bc8a':'#b49469','#917c5d');for(let i=0;i<5;i++)ellipse(g,q[0]-6+i*3,q[1]-1+i%2*3,2,1.4,s.snack==='Fruit'?['#8f9d62','#c0a66d','#9b765b'][i%3]:'#d1b27c');}
 cup(g,...P(1.8,-.7,.18),.75);
 for(const a of[-2.5,2.35]){line(g,P(a,-.75,.2),P(a,.85,.2),'#98a49b',1.8);const q=P(a,-.75,.2);for(let i=0;i<3;i++)line(g,[q[0]-2+i*2,q[1]-4],[q[0]-2+i*2,q[1]+1],'#bcc7bc',.7);}
 const napkin=P(1.6,.8,.2);poly(g,[[napkin[0]-12,napkin[1]-2],[napkin[0],napkin[1]-7],[napkin[0]+9,napkin[1]-2],[napkin[0]-3,napkin[1]+4]],'#eee7d1','#d8cfb4');
 if(s.tablet){const q=P(-2.1,1.1,.3);roundBox(g,q[0]-7,q[1]-4,14,7,2,'#cbd4c8','#83958b');ellipse(g,q[0]-2,q[1]-.5,2.5,1.2,'#efe8d4');}
 g.restore();
}
function comfort(g:G,x:number,y:number,k:number,s:CabinState):void{
 g.save();g.translate(x,y);g.scale(k,k);
 if(s.blanket){poly(g,[[0,0],[48,-12],[72,0],[24,14]],s.first?'#b5a180':'#8da3a0');poly(g,[[0,0],[24,14],[24,27],[0,13]],s.first?'#8a795f':'#617d7c');poly(g,[[24,14],[72,0],[72,13],[24,27]],s.first?'#9c896a':'#748d88');for(let i=1;i<7;i++)line(g,[6+i*7,-i*1.65],[28+i*6,12-i*1.6],'#e5dbc43b',.7);roundBox(g,28,-19,35,15,5,'#e7ddc7','#a6a58e');}
 if(s.headphones){g.strokeStyle='#2b4245';g.lineWidth=3;g.beginPath();g.ellipse(90,9,15,12,-.2,Math.PI,0);g.stroke();roundBox(g,73,6,8,13,3,'#3d5456','#233b3b');roundBox(g,101,2,8,13,3,'#3d5456','#233b3b');if((s.headphonePairs??0)>1)roundBox(g,112,3,24,15,2,'#c4c5ad','#8b998c');}
 g.restore();
}

function cutaway(g:G,t:number,p:number,s:CabinState,people:readonly Character[],reduced:boolean,narrow:boolean):void{
 const length=narrow?4.5:8.5,depth=narrow?3.6:5.3,unit=narrow?44:45,zUnit=narrow?30:31;
 const P:Project=(x,y,z=0)=>[narrow?480+(x-y)*unit:440+(x-y)*unit,(narrow?145:95)+(x+y)*unit*.5-z*zUnit];
 poly(g,[P(-.25,-.2,-.12),P(length+.25,-.2,-.12),P(length+.25,depth+.3,-.12),P(-.25,depth+.3,-.12)],'#172b2c33','');
 block(g,P,0,0,length,depth,.18,-.18,'#4d5a54','#303e3b','#354743');
 // Two cutaway walls use exactly the street's 2:1 ground projection.
 poly(g,[P(0,0),P(length,0),P(length,0,3.35),P(0,0,3.35)],'#c4c5b0');
 poly(g,[P(0,0),P(0,depth),P(0,depth,3.35),P(0,0,3.35)],'#abb5a6');
 for(let x=.8;x<length;x+=2.8){windowPane(g,[P(x,0,1.5),P(Math.min(length-.2,x+1.65),0,1.5),P(Math.min(length-.2,x+1.65),0,2.75),P(x,0,2.75)],t+x,p,reduced);}
 const doorY=narrow?1.4:3.1,doorW=narrow?.9:1.15;
 poly(g,[P(.01,doorY,.12),P(.01,doorY+doorW,.12),P(.01,doorY+doorW,2.9),P(.01,doorY,2.9)],'#7f968b','#6a8072');
 poly(g,[P(.02,doorY+.18,1.6),P(.02,doorY+doorW-.18,1.6),P(.02,doorY+doorW-.18,2.4),P(.02,doorY+.18,2.4)],'#5f7f82','#c3cbb4');
 line(g,P(.05,doorY+.2,1.15),P(.05,doorY+.53,1.15),'#d6d1b3',2);
 const exit=P(.01,doorY+doorW*.5,3.11);sceneText(g,'EXIT',exit[0],exit[1],7,'#e7e1c5');
 if(!narrow){block(g,P,.05,4.6,.6, .55,1.25,.05,'#cbd0b8','#8f9f8e','#789081');for(let z=.3;z<1.2;z+=.3)line(g,P(.67,5.3,z),P(.67,5.1,z),'#c2c7ad',.6);cup(g,...P(.35,4.85,1.36),.5);}
 for(let x=0;x<=length;x+=.5)line(g,P(x,0,.01),P(x,depth,.01),'#b7bca617',.5);
 const aisle=narrow?1.8:2.65;poly(g,[P(0,aisle-.4,.02),P(length,aisle-.4,.02),P(length,aisle+.4,.02),P(0,aisle+.4,.02)],'#847f67','#a49a751f');
 for(let x=.25;x<length;x+=.42)for(const y of[aisle-.46,aisle+.46]){const q=P(x,y,.04);ellipse(g,...q,1.3,.6,'#cbb57d');}
 // Bins have visible undersides, latches, row markers and warm reading lights.
 for(let x=.2;x<length;x+=2.8){const w=Math.min(2.65,length-x);block(g,P,x,0,w,.5,.38,2.98,'#e2d9c2','#c1c1ad','#9eaa9b');const latch=P(x+w*.5,.51,3.14);line(g,[latch[0]-3,latch[1]],[latch[0]+3,latch[1]],'#62766d',1.5);const lamp=P(x+w*.5,.58,2.95);ellipse(g,...lamp,3,1.4,'#f4dca0');}
 const cast=people.slice(1).filter(c=>c.phys===0&&c.id!==people[0]?.id),rows=narrow?[.6,2.85]:s.first?[.85,3.5,6.15]:[.6,2.5,4.4,6.3];
 const objects:{depth:number;draw:()=>void}[]=[];
 for(let row=0;row<rows.length;row++){const x=rows[row];const ys=narrow?[.25,2.45]:s.first?[.55,3.55]:[.3,1.08,3.3,4.08];
  for(let i=0;i<ys.length;i++){const y=ys[i],person=row===rows.length-1&&i===(narrow?ys.length-1:0)?people[0]:cast[(row*ys.length+i)%Math.max(1,cast.length)];
   objects.push({depth:x+y,draw:()=>seat(g,P,x,y,s.first,person,t)});}
 }
 const route=routeAt([[narrow?1.1:1.2,aisle],[narrow?2.4:6.3,aisle]],t,.22,6),cx=route.x,cy=route.y,crew=cast.find(c=>c.role==='office')??cast[0];
 objects.push({depth:cx+cy,draw:()=>{const q=P(cx,cy);figure(g,dressedCrew(crew),...q,narrow?.5:.52,route.moving?'walk':activityAt(crew?.id??0,t,'crew'),t,route.facing);block(g,P,cx+.55,cy-.27,.48,.42,.78,.08,'#bdc1ab','#8d9e93','#6d837c');for(const y of[cy-.15,cy+.24]){const a=P(cx+1.1,y,.1);ellipse(g,...a,2.8,2,'#253d3a');}cup(g,...P(cx+.88,cy+.05,1.1),.5);}});
 objects.sort((a,b)=>a.depth-b.depth).forEach(a=>a.draw());
 // The selected seat's service is foregrounded rather than hidden among tiny passengers.
 const tx=rows[rows.length-1]+.9,ty=narrow?3.02:1.1;
 block(g,P,tx-.5,ty-.15,.5,.12,.39,.7,C.metal,'#738678','#506f60');
 const tray=P(tx,ty,1.15);serviceTray(g,...tray,narrow?.35:.4,s,t,reduced);
 if(s.blanket||s.headphones){const q=P(narrow?3.45:7.5,narrow?3.2:4.9,.84);comfort(g,...q,narrow?.45:.58,s);}
 if(s.first&&!narrow){const q=P(7.6,.25,1.3);block(g,P,7.3,.05,.8,.4,1.2,0,'#b8a27a','#857256','#786a52');cup(g,q[0],q[1]-.5,.8);for(let i=0;i<3;i++){line(g,[q[0]+16,q[1]-4],[q[0]+15+i*4,q[1]-27-i%2*5],'#6c8763',.8);ellipse(g,q[0]+15+i*4,q[1]-27-i%2*5,4,2,'#c9b48a');}}
 // Contact shading remains on the cabin floor; no floating glow discs.
 line(g,P(0,depth,.02),P(length,depth,.02),'#cad0b47a',1.5);line(g,P(length,0,.02),P(length,depth,.02),'#c5bea16a',1.5);
}

function scenicWindow(g:G,t:number,p:number,s:CabinState,people:readonly Character[],reduced:boolean,narrow:boolean):void{
 const wall=g.createLinearGradient(0,0,700,420);wall.addColorStop(0,'#d3d4bd');wall.addColorStop(.7,'#a8b3a6');wall.addColorStop(1,'#788c81');g.fillStyle=wall;g.fillRect(0,0,960,420);
 // Curved fuselage panels and an inset window frame with a proper dark recess.
 for(const x of[27,491,905]){g.strokeStyle='#687f743d';g.lineWidth=1;g.beginPath();g.moveTo(x+12,0);g.bezierCurveTo(x-14,130,x-8,270,x+31,420);g.stroke();}
 const wx=58,wy=42,ww=405,wh=281;
 roundBox(g,wx-12,wy-12,ww+24,wh+24,64,'#637b78','#bfc6b5');roundBox(g,wx-6,wy-6,ww+12,wh+12,59,'#e0d9c3','#a3afa0');
 g.save();g.beginPath();g.roundRect(wx,wy,ww,wh,53);g.clip();scenery(g,wx,wy,ww,wh,t,p,reduced);g.restore();
 g.beginPath();g.roundRect(wx,wy,ww,wh,53);g.strokeStyle='#566f75';g.lineWidth=3;g.stroke();
 g.strokeStyle='#f4ead033';g.lineWidth=2;g.beginPath();g.moveTo(wx+49,wy+20);g.lineTo(wx+157,wy+wh-18);g.moveTo(wx+62,wy+18);g.lineTo(wx+172,wy+wh-18);g.stroke();
 roundBox(g,224,18,58,11,4,'#a5b3a1','#798c7d');line(g,[241,24],[264,24],'#536f65',1);
 // A close isometric console connects this scenic view to the native room artwork.
 const P:Project=(x,y,z=0)=>[(narrow?443:665)+(x-y)*58,(narrow?276:230)+(x+y)*29-z*39];
 poly(g,[P(-.5,-.1),P(4.7,-.1),P(4.7,2.5),P(-.5,2.5)],'#465a53');
 block(g,P,-.2,0,4.5,.34,1.6,0,s.first?'#b19b77':'#9eafa0',s.first?'#847051':'#6b8a7b','#566e65');
 for(let x=0;x<5.5;x+=.3)line(g,P(x,0,1.73),P(x,.5,1.73),'#ddd5b51c',.6);
 seat(g,P,.5,.7,s.first,people.find((c,i)=>i>0&&c.phys===0&&c.id!==people[0]?.id),t);
 seat(g,P,2.9,.7,s.first,people.find((c,i)=>i>2&&c.phys===0&&c.id!==people[0]?.id),t);
 const q=P(2.5,.1,1.65);comfort(g,q[0]-12,q[1],.85,s);
 if(s.first){const a=P(4.8,.25,1.8);cup(g,...a,.7);for(let i=0;i<3;i++){line(g,[a[0]+18,a[1]],[a[0]+18+i*4,a[1]-23],'#6a855f',1);ellipse(g,a[0]+18+i*4,a[1]-23,4,2,'#d6bf91');}}
 // Selected food is close enough to read on a phone without scaling the people down.
 const trayX=narrow?292:368;line(g,[trayX-41,370],[trayX-41,420],'#687e70',5);line(g,[trayX+42,370],[trayX+42,420],'#687e70',5);
 serviceTray(g,trayX,367,narrow?1.18:1.5,s,t,reduced);
 if(narrow&&(s.blanket||s.headphones))comfort(g,364,334,.7,s);
 // Underside rail, seat pocket and fasteners are part of the cabin, not UI boxes.
 line(g,[42,344],[491,344],'#758a7a',3);for(const x of[68,171,274,377,468])ellipse(g,x,345,1.4,1,'#c2c7af');
 roundBox(g,510,302,41,31,4,'#70887a','#48695c');for(let i=0;i<4;i++)line(g,[515,310+i*4],[545,310+i*4],'#a2ad944d',.7);
}

/** Detailed 2:1 cutaway and scenic seat view, sharing the world's palette and native cast. */
export function drawCabin(g:G,t:number,p:number,s:CabinState,people:readonly Character[],reduced:boolean,narrow=false):void{
 const time=reduced?0:t,progress=Math.max(0,Math.min(1,p));
 g.save();g.lineJoin='round';g.lineCap='round';
 const ambient=g.createLinearGradient(0,0,960,420);ambient.addColorStop(0,'#263e3e');ambient.addColorStop(1,'#182d30');g.fillStyle=ambient;g.fillRect(0,0,960,420);
 if(s.seat==='window')scenicWindow(g,time,progress,s,people,reduced,narrow);else cutaway(g,time,progress,s,people,reduced,narrow);
 // Compact physical flight placard leaves faces and scenery unobstructed.
 const x=narrow?(s.seat==='window'?304:480):s.seat==='window'?769:820;
 roundBox(g,x-91,16,182,33,5,'#283f3ce8','#a2ad8b66');
 sceneText(g,s.first?'FIRST CLASS':'ECONOMY',x,29,9,'#d7c196');
 const stage=progress<.18?'CLIMB':progress>.86?'APPROACH':'CRUISE';
 sceneText(g,stage+' · '+Math.round(Math.sin(progress*Math.PI)*38000).toLocaleString()+' FT',x,41,9,'#c9d7c4');
 g.restore();
}
