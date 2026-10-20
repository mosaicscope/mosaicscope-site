import {contactPose,groundReaction,stampPose} from './ReactionAnatomy';
import {sampleReactionFace,setReactionFace,conditionFace,focusedFace} from './ReactionFaces';
import type {Character} from '../entities/types';
import type {Angles} from './StickFigure';
import {REACTION_CLIPS} from './ReactionScores';
import {REACTION_KEYS,REST_REACTION} from './ReactionPoses';
export const NEGATIVE_REACTIONS=REACTION_CLIPS;
export type ReactionClip=typeof REACTION_CLIPS[number];
export const REACTION_TRACKS=['lean','bob','hipX','thighL','bendL','thighR','bendR','armL','foreL','armR','foreR','tilt','lying'] as const;
const cachedFrames=new WeakMap<ReactionClip,Angles[]>();
/** Interpolated, held anatomical keys. Every clip has its own authored three-action score. */
export function sampleReactionClip(clip:ReactionClip,time:number,reduced=false):Angles{
 const u=reduced?.5:Math.max(0,Math.min(1,time/clip.duration));
 if(u===0||u===1)return {...REST_REACTION};
 const times=[0,.13,.24,.43,.55,.76,.87,1];let keys=cachedFrames.get(clip);if(!keys){keys=[REST_REACTION,...clip.keys.flatMap(k=>{const p=contactPose(k,{...REACTION_KEYS[k].angles});return[p,p];}),REST_REACTION];cachedFrames.set(clip,keys);}
 let i=0;while(i<times.length-2&&u>times[i+1])i++;
 const raw=Math.max(0,Math.min(1,(u-times[i])/(times[i+1]-times[i]))),v=raw*raw*(3-2*raw),a=keys[i],b=keys[i+1],out={...REST_REACTION};
 for(const track of REACTION_TRACKS)out[track]=a[track]+(b[track]-a[track])*v;
 groundReaction(out);
 for(let stage=0;stage<3;stage++){const key=clip.keys[stage];if(key!=='ts'&&key!=='tu')continue;const start=stage*.315,end=start+.37;if(u>=start&&u<=end){const stamped={...out};stampPose(stamped,key==='ts'?0:1,(u-start)/(end-start));const ramp=(v:number)=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);},blend=ramp((u-start)/.055)*ramp((end-u)/.055);for(const track of REACTION_TRACKS)out[track]+=(stamped[track]-out[track])*blend;}}
 return out;
}
export function reactionFor(c:Character,_time=0){
 if(!c.emo||!c.pers)return null;
 let hurt:Character['wounds'][number]|undefined;for(const w of c.wounds??[])if(!w.bandaged&&(!hurt||w.severity>hurt.severity))hurt=w;
 let family=-1,strength=0;
 if(hurt){family=['head','arm','leg','torso'].indexOf(hurt.part);strength=.55+hurt.severity*.15;}
 else if(c.emo.fear>.35){family=c.emo.fear>.9?16:c.emo.fear>.7?6:4;strength=c.emo.fear;}
 else if(c.emo.frustration>.45){family=c.emo.frustration>.85?13:c.emo.frustration>.65?12:11;strength=c.emo.frustration;}
 else if(c.emo.mood<-.25){family=9;strength=-c.emo.mood;}
 else if((c.needs?.energy??1)<.2){family=19;strength=1-c.needs.energy;}
 if(family<0)return null;
 const event=hurt?`${hurt.part}:${hurt.tick}:${hurt.hits??1}`:`${family}`;
 const variant=(Math.imul(c.id+1,2654435761)+(hurt?.tick??0)+(hurt?.hits??0))>>>0;
 return {clip:NEGATIVE_REACTIONS[family*25+variant%25],strength,key:event,acute:!!hurt||family===4||family===6||family===16};
}
const performances=new WeakMap<Character,{key:string;start:number;perform:boolean}>();
const occupiedActions=new Set(['shoot','swing','punch','throw','kick','slap','shove','uppercut','shield','repair','deal','bet','carry','craft','photo','play','kiss','sit','sitdrink','phone']);
export function applyNegativeReaction(a:Angles,c:Character,t:number,speed:number,action:string,reduced=false):void{
 const r=reactionFor(c);if(!r){if(performances.get(c)?.key!=='neutral')performances.set(c,{key:'neutral',start:t,perform:false});setReactionFace(c,action==='shoot'?focusedFace():null);return;}
 let state=performances.get(c);if(!state||state.key!==r.key){state={key:r.key,start:t-.35,perform:r.acute||!!state&&r.strength>.75};performances.set(c,state);}
 const elapsed=Math.max(0,t-state.start),perform=state.perform&&(reduced||elapsed<r.clip.duration);
 setReactionFace(c,!r.acute&&action==='shoot'?focusedFace():perform?sampleReactionFace(r.clip,reduced?r.clip.duration*.5:elapsed,reduced):conditionFace(r.clip.index,r.strength));
 if(!state.perform||!perform&&!reduced)return;
 const p=sampleReactionClip(r.clip,reduced?0:elapsed,reduced),weight=.7+.3*r.strength;
 const down=a.lying>0||c.phys===2||c.phys===3,occupied=occupiedActions.has(action)||c.hand>=0;
 if(!down&&!occupied&&speed<.2&&c.phys===0){Object.assign(a,p);return;}
 // Preserve strikes, held equipment and the physical knockdown; react through the available joints.
 a.tilt+=p.tilt*weight*(down?.5:occupied?.65:1);
 a.lean+=p.lean*weight*(down?.08:occupied?.2:speed>.2?.45:1);
 if(!occupied){const armWeight=weight*(down?.5:c.phys===1?.55:speed>.2?.65:1);for(const k of ['armL','foreL','armR','foreR'] as const)a[k]+=(p[k]-REST_REACTION[k])*armWeight;}
 if(!down&&!occupied&&speed<.2&&c.phys===0){for(const k of ['thighL','bendL','thighR','bendR','hipX','bob'] as const)a[k]+=(p[k]-REST_REACTION[k])*weight;}
 else if(down)a.bob+=Math.min(1.5,p.bob*.05);
}
export function drawEmotionDetail(g:CanvasRenderingContext2D,c:Character,x:number,y:number,r:number,k:number):void{
 const reaction=reactionFor(c);if(!reaction)return;
 const {clip,strength}=reaction,tear=[6,8,15,17,18].includes(clip.index),sweat=[3,5,7,16,19].includes(clip.index);
 g.save();g.lineCap='round';g.lineWidth=Math.max(.65,k*.7);
 if(tear||sweat){g.strokeStyle=tear?'#9ebfc7bb':'#b9d5cfaa';for(const side of[-1,1]){const xx=x+side*r*(tear?.47:.88),yy=y+r*.12;g.beginPath();g.moveTo(xx,yy);g.quadraticCurveTo(xx+side*k,yy+3*k,xx,yy+(tear?7:4)*k*strength);g.stroke();g.fillStyle=tear?'#9ebfc7bb':'#b9d5cfaa';g.beginPath();g.ellipse(xx,yy+(tear?7:4)*k*strength,.7*k,1.2*k,0,0,7);g.fill();}}
 if(clip.index<4||clip.index===12||clip.index===13){g.strokeStyle='#936b6355';for(const side of[-1,1])for(let i=0;i<2;i++){g.beginPath();g.moveTo(x+side*(r*.55+i*k),y+r*.35);g.lineTo(x+side*(r*.7+i*k),y+r*.38+2*k);g.stroke();}}
 if(clip.index===19){g.fillStyle='#75687544';for(const side of[-1,1]){g.beginPath();g.ellipse(x+side*r*.45,y+r*.2,r*.2,1.4*k,0,0,7);g.fill();}}
 g.restore();
}
