import type {CivicDamage} from '../sim/CivicDamage';
import {facadeBreached} from '../sim/FacadeImpact';

type Point=[number,number];
/** Shared outline for both the visible breach and the clipped facade. */
export function openingOutline(d:CivicDamage):Point[]{const o=d as CivicDamage&{openingHeight?:number;openingContour?:number[][]},height=Math.max(.3,Math.min(10,o.openingHeight??1)),shape=o.openingContour&&o.openingContour.length>=3&&o.openingContour.length<=64&&o.openingContour.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]))?o.openingContour:[[.04,0],[.04,.78],[.12,1],[.5,1],[.88,1],[.96,.78],[.96,0]];return shape.map(([x,y])=>[Math.max(0,Math.min(1,x)),Math.max(0,Math.min(1,y))*height]);}

export type DamageProjection=(u:number,h:number,out?:number)=>Point;
const outline=[[.21,.1],[.16,.51],[.28,.89],[.49,1.01],[.78,.83],[.84,.45],[.74,.11]];
/** The exact same opening clips the facade paint and its emissive light. */
export function facadeDamagePath(g:CanvasRenderingContext2D,d:CivicDamage,P:DamageProjection):void {
  const opening=d as CivicDamage&{opening?:boolean;openingHeight?:number};
  if(opening.opening){g.beginPath();openingOutline(d).forEach(([u,h],i)=>{const p=P(u,h);if(i)g.lineTo(...p);else g.moveTo(...p)});g.closePath();return;}
  const size=.45+d.severity*.55,centre=d.impactU??.5;
  g.beginPath();outline.forEach(([u,h],i)=>{const p=P(Math.max(.025,Math.min(.975,centre+(u-.5)*size)),.06+h*size);if(i)g.lineTo(...p);else g.moveTo(...p);});g.closePath();
}
export function eraseFacadeGlow(g:CanvasRenderingContext2D,d:CivicDamage,P:DamageProjection):void {
  if(d.severity<.004)return;
  g.save();g.globalCompositeOperation='destination-out';g.globalAlpha=1;facadeDamagePath(g,d,P);g.fillStyle='#000';g.fill();g.restore();
}

/** Local surface deformation: windows shatter, boards split, sheet metal folds and concrete spalls.
 * Even severe concrete damage stays at bumper height; the structural volume never disappears. */
export function paintFacadeDamage(g:CanvasRenderingContext2D,d:CivicDamage,P:DamageProjection,z:number,time=0):void {
  if(d.severity<.004)return;
  const material=d.material??'brick',breached=(d as CivicDamage&{opening?:boolean}).opening||facadeBreached(material,d.severity),working=d.phase==='working',progress=d.repairProgress??0,centre=d.impactU??.5;
  const line=(points:Point[],color:string,width=1)=>{g.beginPath();points.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.strokeStyle=color;g.lineWidth=Math.max(.45,width*z);g.stroke();};
  const box=(u:number,h:number,w:number,height:number,col:string,out=0)=>{g.beginPath();for(const [i,p]of [P(u,h,out),P(u+w,h,out),P(u+w,h+height,out),P(u,h+height,out)].entries())i?g.lineTo(...p):g.moveTo(...p);g.closePath();g.fillStyle=col;g.fill();};
  g.save();g.lineCap='round';
  facadeDamagePath(g,d,P);g.fillStyle=working?'#a98b60':breached?'#171f22':material==='concrete'||material==='stone'?'#a6a59a':'#6e7068';if(!(d as CivicDamage&{opening?:boolean}).opening)g.fill();
  g.strokeStyle=working?'#6b573f':material==='glass'?'#c2e1e3':'#5a5d54';g.lineWidth=Math.max(.6,z*.8);g.stroke();
  if((d as CivicDamage&{opening?:boolean}).opening){
    // Keep the aperture transparent: broken edges, exposed rods and rubble sit
    // outside it so a car behind the wall remains visible.
    const shape=openingOutline(d),edge=material==='glass'?'#b9dce0':material==='brick'?'#d0a18a':'#d4d1c3';
    for(let i=1;i<shape.length-1;i++){const [u,h]=shape[i],direction=u<.5?-1:1;
      line([P(u,h),P(u+direction*(.035+(i%2)*.015),h+.04),P(u+direction*.07,h+.09)],edge,1.1);
      if(material==='concrete'||material==='brick'||material==='stone')line([P(u,h),P(u+direction*.035,h-.06)],'#67544a',.7);
    }
    for(let i=0;i<12;i++){const u=.03+((i*37+(d.variant??0)*11)%94)/100,out=.12+(i%4)*.15,a=P(u,.015,out),b=P(u+.035,.015,out+.05),c=P(u+.018,.06+(i%3)*.025,out+.04);g.fillStyle=material==='glass'?'#b4d9dcad':material==='brick'?'#a87962':'#aaa99b';g.beginPath();g.moveTo(...a);g.lineTo(...b);g.lineTo(...c);g.closePath();g.fill();}
    g.restore();return;
  }
  if(working){
    // Replacement panels cover only the struck bay, with studs and attached scaffold frames.
    const masonry=material==='concrete'||material==='stone',metal=material==='metal';
    for(let i=0;i<4;i++)box(centre-.23+i*.115,.1,.103,.78,masonry?i%2?'#a7aca1':'#b8bbb0':metal?i%2?'#9aaba7':'#728b88':i%2?'#b69b70':'#a78b63');
    for(const h of [.26,.58,.82])line([P(centre-.24,h),P(centre+.24,h)],masonry||metal?'#6b7a74':'#685a43',.8);
    const width=.34,height=1.45;
    for(const u of[centre-width,centre+width])line([P(u,0,.18),P(u,height,.18)],'#a7b0a6',1.4);
    line([P(centre-width,.12,.18),P(centre+width,height,.18)],'#788981',.7);
    for(const h of[.48,1.1]){line([P(centre-width,h,.18),P(centre+width,h,.18)],'#b4bbb0',1.2);box(centre-width,h-.04,width*2,.055,'#9c8764',.2);}
    // A maintenance worker and the work lamp move while the recorded job makes progress.
    const worker=centre+.36,arm=.65+Math.sin(time*3.7+(d.variant??0))*.08;
    box(worker-.045,.23,.09,.25,'#d3b455',.32);
    const head=P(worker,.59,.32);g.fillStyle='#e4c69a';g.beginPath();g.arc(...head,Math.max(1,2*z),0,Math.PI*2);g.fill();
    line([P(worker,.25,.32),P(worker-.06,.02,.32)],'#303b40',1.1);line([P(worker,.25,.32),P(worker+.06,.02,.32)],'#303b40',1.1);
    line([P(worker,.45,.32),P(worker-.15,arm,.28)],'#e4c69a',1.1);
    box(centre-.24,.98,.48,.055,'#354449');box(centre-.24,.98,.48*progress,.055,'#b2c995');
  }else{
    const seed=d.variant??0;
    // Clip fracture lines and displaced material to this impact's actual footprint.
    g.save();facadeDamagePath(g,d,P);g.clip();
    if(material==='brick'&&d.severity>.22){
      for(let row=0;row<5;row++)for(let col=0;col<5;col++){
        if(breached&&(row+col+seed)%3===0)continue;
        const u=centre-.29+col*.13+(row%2)*.055,h=.1+row*.17;
        box(u,h,.116,.14,(row+col)%2?'#a3785d':'#b28d6b',d.severity*.025);
      }
    }else if(material==='timber'){
      for(let i=0;i<6;i++){const u=centre-.28+i*.11,split=breached&&i%3===1;
        line([P(u,.1),P(u+(split?.045:0),.43),P(u-(split?.035:0),.9)],i%2?'#c0a17a':'#6b543b',2.2);
      }
    }else if(material==='metal'){
      for(let i=0;i<6;i++){const u=centre-.3+i*.12;line([P(u,.1),P(u+.07*d.severity,.48),P(u,.91)],i%2?'#c0c7bc':'#46575a',1.7);}
    }else{
      for(let i=0;i<7;i++){
        const a=i*Math.PI*2/7+(seed%7)*.13,r=.2+d.severity*.17;
        line([P(centre,.46),P(centre+Math.cos(a)*r*.55,.46+Math.sin(a)*r*.8),P(centre+Math.cos(a)*r,.46+Math.sin(a)*r*1.5)],material==='glass'?'#b4d4d9':'#585f5b',material==='glass'?.65:.8);
      }
      if(material==='concrete'||material==='stone')for(let i=0;i<4;i++)line([P(centre-.22,.22+i*.08),P(centre+.22,.25+i*.08)],i%2?'#c5c5b9':'#777e75',1.4);
    }
    g.restore();
  }
  const debris=working?Math.ceil((1-progress)*5):Math.min(14,Math.ceil(d.severity*(breached?14:5)));
  for(let i=0;i<debris;i++){
    const u=centre+(((i*37+(d.variant??0)*11)%93)/93-.5)*.8,out=.05+(i%4)*.09;
    const a=P(u,.025,out),b=P(u+.045,.02,out+.03),c=P(u+.025,.08,out+.055);
    g.fillStyle=material==='glass'?'#b4d9dcad':material==='timber'?'#b29165':material==='brick'?'#aa7860':material==='metal'?'#9faeaa':'#b3b3a4';
    g.beginPath();g.moveTo(...a);g.lineTo(...b);g.lineTo(...c);g.closePath();g.fill();
  }
  if(d.phase!=='reported')for(const u of[centre-.46,centre+.46]){
    const base=P(u,0,.42),tip=P(u,.32,.42);g.fillStyle='#d49a43';g.beginPath();g.moveTo(base[0]-3*z,base[1]+z);g.lineTo(...tip);g.lineTo(base[0]+3*z,base[1]+z);g.closePath();g.fill();
    line([P(u-.035,.12,.42),P(u+.035,.12,.42)],'#f4dfb1',1.2);
    if(!working){g.fillStyle=`rgba(255,192,71,${.45+.5*(.5+.5*Math.sin(time*2+(d.variant??0)))})`;g.beginPath();g.arc(tip[0],tip[1]-z,1.3*z,0,Math.PI*2);g.fill();}
  }
  g.restore();
}
