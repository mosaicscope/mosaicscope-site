import type {Camera} from './Camera';
import type {Character,Vehicle} from '../entities/types';
import {VEHICLES} from '../content/vehicles';
import {pose,solve,drawFigure,J} from './StickFigure';
type Point=[number,number,number];
const kinds=new Set(['motorcycle','sportbike','cruiser','bicycle','ebike','escooter']);
/** Local geometry is projected through the same camera as cars, with a real wheel contact plane. */
export function drawTwoWheeler(g:CanvasRenderingContext2D,cam:Camera,v:Vehicle,alpha:number,time:number,driver?:Character):boolean{
 if(!kinds.has(v.cls))return false;
 const d=VEHICLES[v.cls],z=cam.zoom,L=d.length,x=v.px+(v.x-v.px)*alpha,y=v.py+(v.y-v.py)*alpha,c=Math.cos(v.heading),s=Math.sin(v.heading);
 const bicycle=v.cls==='bicycle'||v.cls==='ebike',scooter=v.cls==='escooter',sport=v.cls==='sportbike',cruiser=v.cls==='cruiser';
 const radius=bicycle?.19:scooter?.095:cruiser?.195:.18,rear=-L*.36,front=L*(cruiser?.4:.36),spin=time*v.speed/Math.max(.1,radius),steer=v.steerAngle??0;
 const bank=scooter||bicycle?0:Math.max(-.22,Math.min(.22,-(v.yaw??0)*v.speed*.025));
 const P=(p:Point):[number,number]=>{const yy=p[1]*Math.cos(bank)-(p[2]-radius)*Math.sin(bank),zz=radius+p[1]*Math.sin(bank)+(p[2]-radius)*Math.cos(bank),q=cam.toScreen(x+p[0]*c-yy*s,y+p[0]*s+yy*c,zz,{x:0,y:0});return[q.x,q.y];};
 const line=(points:Point[],colour:string,width=1)=>{g.strokeStyle=colour;g.lineWidth=Math.max(.45,width*z);g.beginPath();points.forEach((p,i)=>{const q=P(p);if(i)g.lineTo(...q);else g.moveTo(...q);});g.stroke();};
 const face=(points:Point[],colour:string,edge?:string)=>{g.fillStyle=colour;g.beginPath();points.forEach((p,i)=>{const q=P(p);if(i)g.lineTo(...q);else g.moveTo(...q);});g.closePath();g.fill();if(edge){g.strokeStyle=edge;g.lineWidth=.6*z;g.stroke();}};
 const box=(a:number,b:number,w:number,lo:number,hi:number,col:string)=>{face([[a,-w,lo],[b,-w,lo],[b,-w,hi],[a,-w,hi]],'#303b39','#192522');face([[b,-w,lo],[b,w,lo],[b,w,hi],[b,-w,hi]],col,'#25312f');face([[a,w,lo],[b,w,lo],[b,w,hi],[a,w,hi]],col,'#25312f');face([[a,-w,hi],[b,-w,hi],[b,w,hi],[a,w,hi]],col,'#a1aaa055');};
 const tube=(points:Point[],col:string,w=2)=>{line(points,'#202a28',w+1.3);line(points,col,w);};
 const ring=(cx:number,cy:number,cz:number,r:number,n=24):Point[]=>Array.from({length:n},(_,i)=>[cx+Math.cos(i/n*Math.PI*2)*r,cy,cz+Math.sin(i/n*Math.PI*2)*r]);
 const wheel=(axle:number,width:number,turn=0)=>{
  const transform=(p:Point):Point=>[axle+p[0]*Math.cos(turn)-p[1]*Math.sin(turn),p[0]*Math.sin(turn)+p[1]*Math.cos(turn),p[2]];
  const far=ring(0,-width/2,radius,radius).map(transform),near=ring(0,width/2,radius,radius).map(transform),inner=ring(0,width/2+.001,radius,radius*.79).map(transform);
  for(let i=0;i<24;i++)face([far[i],far[(i+1)%24],near[(i+1)%24],near[i]],i%4===0?'#37403c':'#202925');
  g.beginPath();for(const points of[near,inner.slice().reverse()]){points.forEach((p,i)=>{const q=P(p);if(i)g.lineTo(...q);else g.moveTo(...q);});g.closePath();}g.fillStyle='#1c2523';g.fill('evenodd');
  line([...inner,inner[0]],bicycle?'#b5bdb0':'#909c94',bicycle?.65:1.3);
  const hub=transform([0,width/2+.002,radius]),n=z<1?6:bicycle?20:sport?7:10;
  for(let i=0;i<n;i++){const a=spin+i/n*Math.PI*2,edge=transform([Math.cos(a)*radius*.78,width/2+.002,radius+Math.sin(a)*radius*.78]);line([hub,edge],bicycle?'#bbc4b1aa':'#7b8980',bicycle?.35:1.3);}
  const rotor=ring(0,width/2+.004,radius,radius*(bicycle?.32:.47),16).map(transform);face(rotor,'#84938b77');line([...rotor,rotor[0]],'#b2b8a8',.55);
  const q=P(hub);g.fillStyle='#c6c8b3';g.beginPath();g.arc(q[0],q[1],Math.max(.8,z*.8),0,Math.PI*2);g.fill();
  if(!bicycle&&!scooter)tube([transform([-.055,width/2+.008,radius+.035]),transform([-.055,width/2+.008,radius+.1])],'#aa8a57',1.4);
 };
 g.save();g.lineCap='round';g.lineJoin='round';
 const shadow=P([0,0,.01]);g.fillStyle='#101a1866';g.beginPath();g.ellipse(shadow[0],shadow[1]+z,L*20*z,L*7*z,.3,0,6.3);g.fill();
 wheel(rear,bicycle?.028:scooter?.05:.105);wheel(front,bicycle?.028:scooter?.05:.095,steer*.65);
 let seat:Point=[-.07,0,cruiser?.4:bicycle?.49:.48],bar:Point=[L*.22,0,cruiser?.73:sport?.59:bicycle?.6:.68];
 if(bicycle){
  const crank:Point=[-.05,0,.22],head:Point=[L*.22,0,.52],hub:Point=[rear,0,radius];
  tube([hub,seat,crank,hub],v.color,1.6);tube([seat,head,crank],v.color,1.8);tube([head,[front,0,radius]],'#9eaaa0',1.5);
  line([[rear,.036,radius+.04],[-.05,.036,.27],[-.05,.036,.18],[rear,.036,radius-.03]],'#64706a',.65);
  const sprocket=ring(-.05,.044,.22,.057,16);face(sprocket,'#9ba89d');line([...sprocket,sprocket[0]],'#c6cbb8',.6);
  for(const side of[-1,1]){const a=spin+(side>0?Math.PI:0),p:Point=[-.05+Math.cos(a)*.1,side*.09,.22+Math.sin(a)*.1];tube([[-.05,side*.05,.22],p],'#b5beb1',1.2);line([[p[0]-.035,p[1]-.025,p[2]],[p[0]+.035,p[1]+.025,p[2]]],'#35463c',2);}
  box(seat[0]-.13,seat[0]+.06,.07,seat[2],seat[2]+.025,'#343d35');tube([head,bar],'#a1afa4',1.2);tube([[bar[0],-.16,bar[2]],[bar[0],.16,bar[2]]],'#9ba99a',1.3);
  for(const side of[-1,1])tube([[bar[0]-.055,side*.16,bar[2]],[bar[0]+.01,side*.16,bar[2]]],'#3d4e43',2.4);
  line([[bar[0],-.12,bar[2]],[bar[0]+.045,-.09,.49],[front,-.04,radius+.04]],'#293a32',.5);
  if(v.cls==='ebike'){box(-.035,.17,.055,.29,.4,'#424f49');line([[.02,.06,.3],[.14,.06,.36]],'#a9bc9b',1.1);}
  for(const axle of[rear,front]){const arc=Array.from({length:12},(_,i)=>[axle+Math.cos(.2+i/11*2.7)*radius*1.12,0,radius+Math.sin(.2+i/11*2.7)*radius*1.12] as Point);line(arc,'#81908a',1.4);}
  box(rear-.05,rear+.06,.08,.39,.415,'#6d7970');
 }else if(scooter){
  box(-L*.35,L*.36,.075,.13,.19,v.color);bar=[L*.32,0,1.12];seat=[-.09,0,.18+(61-4)*.45/26];
  tube([[front,0,radius],[bar[0],0,.33],bar],'#9daf9e',2.5);box(bar[0]-.024,bar[0]+.024,.026,.36,.78,v.color);
  tube([[bar[0],-.15,bar[2]],[bar[0],.15,bar[2]]],'#bdc5b2',1.8);for(const side of[-1,1])tube([[bar[0]-.035,side*.15,bar[2]],[bar[0]+.015,side*.15,bar[2]]],'#30433a',2.7);
  face([[-.2,-.05,.195],[.15,-.05,.195],[.15,.05,.195],[-.2,.05,.195]],'#34443b');line([[bar[0],.035,1.02],[front,.035,.25]],'#33463c',.5);
  box(bar[0]-.015,bar[0]+.015,.038,1.06,1.1,'#bfcdaf');
 }else{
  // Swingarm, paired suspension, radiator and finned engine live between two independent wheels.
  for(const side of[-1,1]){tube([[rear,side*.06,radius],[.02,side*.065,.32],[-.16,side*.075,.46]],'#6f7f74',2);tube([[rear,side*.075,radius],[-.19,side*.075,.44]],cruiser?'#bfc5b2':'#979f8b',1.6);tube([[front,side*.045,radius],[bar[0]+.015,side*.045,bar[2]-.05]],'#bac3af',2.4);}
  tube([[rear,0,radius],seat,[.2,0,.44],[front,0,radius]],'#34453b',3);
  box(-.19,.13,.12,.22,.4,'#52615a');for(let i=0;i<7;i++)line([[-.18,.125,.24+i*.023],[.1,.125,.24+i*.023]],'#b0b8a6',.7);
  box(.12,.18,.105,.25,.43,'#374942');for(let i=0;i<5;i++)line([[.182,-.09+i*.045,.27],[.182,-.09+i*.045,.4]],'#8e9e8c',.6);
  const tankLo:Point[]=[[-.17,-.11,.43],[.16,-.105,.43],[.27,0,.45],[.16,.105,.43],[-.17,.11,.43]],tankHi:Point[]=[[-.13,-.08,.55],[.12,-.065,.57],[.21,0,.54],[.12,.065,.57],[-.13,.08,.55]];
  for(let i=0;i<5;i++)face([tankLo[i],tankLo[(i+1)%5],tankHi[(i+1)%5],tankHi[i]],v.color,'#1f312b');face(tankHi,v.color,'#b6bea066');
  const cap=P([.015,0,.575]);g.fillStyle='#b8c1ad';g.beginPath();g.ellipse(cap[0],cap[1],2*z,z,0,0,6.3);g.fill();
  box(-L*.31,-.09,.095,seat[2]-.025,seat[2]+.035,'#2d3a31');
  tube([[-L*.35,.14,.22],[.16,.14,.22],[.22,.13,.33]],cruiser?'#b6bead':'#73887a',4);line([[-L*.33,.144,.23],[.06,.144,.23]],'#d6d7bc99',.7);
  if(sport){face([[.05,-.13,.28],[.36,-.1,.38],[.39,-.09,.57],[.19,-.1,.66],[-.02,-.13,.51]],v.color,'#24382d');face([[.05,.13,.28],[.36,.1,.38],[.39,.09,.57],[.19,.1,.66],[-.02,.13,.51]],v.color,'#24382d');face([[.2,-.08,.63],[.32,-.055,.77],[.36,.055,.77],[.2,.08,.63]],'#7daba984','#c1d0bc77');line([[.1,.135,.34],[.26,.11,.44]],'#d2d7b588',1.1);}
  else{box(bar[0]+.025,bar[0]+.08,.067,.51,.62,'#5b6e61');face([[bar[0]+.081,-.055,.53],[bar[0]+.081,.055,.53],[bar[0]+.081,.055,.6],[bar[0]+.081,-.055,.6]],'#e3dfb3','#a3b199');}
  tube([[bar[0],-.18,bar[2]],[bar[0]-.035,0,bar[2]],[bar[0],.18,bar[2]]],'#b1bcaa',1.7);
  for(const side of[-1,1]){tube([[bar[0],side*.13,bar[2]],[bar[0]-.045,side*.19,bar[2]]],'#35463a',2.9);line([[bar[0],side*.13,bar[2]],[bar[0]-.035,side*.2,bar[2]+.13]],'#9cae98',1);box(bar[0]-.085,bar[0]-.025,.026,bar[2]+.12,bar[2]+.15,'#8faaa1');}
  for(const axle of[rear,front]){const arc=Array.from({length:12},(_,i)=>[axle+Math.cos(.15+i/11*2.8)*radius*1.12,0,radius+Math.sin(.15+i/11*2.8)*radius*1.12] as Point);line(arc,v.color,sport?3.2:2.2);}
  box(rear-.05,rear+.015,.05,.3,.34,'#bd7766');
 }
 if(Math.abs(v.speed)<.1&&v.driver<0)tube([[-.08,.07,.25],[-.14,.16,.015]],'#8c9e89',1.1);
 if(driver){
  const k=z*.45,dir=Math.cos(v.heading)-Math.sin(v.heading)>0?1:-1,q=P(seat),a=pose(scooter?'skate':'sit','normal',time,spin,0,0);a.lean=sport?.36:cruiser?.05:.18;a.lean+=bank*.3;
  solve(a,q[0],q[1]+(61-a.bob)*k,k,dir);
  const limb=(index:number,origin:number,target:Point,l1:number,l2:number,bend:number)=>{const end=P(target),ox=J[origin],oy=J[origin+1],dx=end[0]-ox,dy=end[1]-oy,d=Math.max(.01,Math.hypot(dx,dy)),ang=Math.atan2(dy,dx),b=Math.acos(Math.max(-1,Math.min(1,(d*d+l1*l1-l2*l2)/(2*d*l1))));J[index]=ox+Math.cos(ang+b*bend)*l1;J[index+1]=oy+Math.sin(ang+b*bend)*l1;J[index+2]=end[0];J[index+3]=end[1];};
  for(const side of[-1,1]){const phase=spin+(side>0?Math.PI:0),foot:Point=scooter?[side<0?-.16:.03,side*.055,.195]:bicycle?[-.05+Math.cos(phase)*.1,side*.09,.22+Math.sin(phase)*.1]:[.04,side*.14,.17];limb(side<0?16:20,0,foot,30*k,31*k,-dir);limb(side<0?8:12,6,[bar[0]-.02,side*.16,bar[2]],22*k,17.5*k,dir);}
  drawFigure(g,driver,q[0],q[1],k,dir,time,0,1);
 }
 g.restore();return true;
}
