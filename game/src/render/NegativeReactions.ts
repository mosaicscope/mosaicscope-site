import type {Character} from '../entities/types';
import type {Angles} from './StickFigure';

const families=['headache','arm-pain','limp','winded','flinch','tremble','cower','startle','sob','withdraw','sigh','exasperated','clenched','angry','disgust','ashamed','panic','grief','overwhelmed','exhausted'] as const;
// Twenty performed reactions, each with 25 deterministic timing, weight and asymmetry variations.
// These are procedural performances on the existing skeleton, not 500 hand-drawn clips.
export const NEGATIVE_REACTIONS=families.flatMap((family,f)=>Array.from({length:25},(_,v)=>({
 id:`${family}-${v+1}`,family,index:f,tempo:.7+(v%5)*.19,weight:.65+Math.floor(v/5)*.12,
 asymmetry:(v-12)/24,phase:v*2.399963229728653,
})));
export function reactionFor(c:Character){
 if(!c.emo||!c.pers)return null;
 let hurt:Character['wounds'][number]|undefined;for(const w of c.wounds??[])if(!w.bandaged&&(!hurt||w.severity>hurt.severity))hurt=w;
 let family=-1,strength=0;
 if(hurt){family=['head','arm','leg','torso'].indexOf(hurt.part);strength=.35+hurt.severity*.18;}
 else if(c.emo.fear>.45){family=4+Math.min(3,Math.floor((1-c.pers.boldness)*4));strength=c.emo.fear;}
 else if(c.emo.frustration>.55){family=11+Math.min(3,Math.floor(c.pers.temper*4));strength=c.emo.frustration;}
 else if(c.emo.mood<-.3){family=c.emo.mood<-.75?15+Math.min(3,Math.floor(c.pers.sociability*4)):8+Math.min(2,Math.floor(c.pers.boldness*3));strength=-c.emo.mood;}
 else if((c.needs?.energy??1)<.16){family=19;strength=1-c.needs.energy;}
 if(family<0)return null;
 const variant=(Math.imul(c.id+1,2654435761)>>>0)%25;
 return {clip:NEGATIVE_REACTIONS[family*25+variant],strength};
}
const protectedActions=new Set(['shoot','swing','punch','throw','kick','slap','shove','uppercut','shield','repair','deal','bet','carry','craft','photo','play','kiss','sit','sitdrink']);
export function applyNegativeReaction(a:Angles,c:Character,t:number,speed:number,action:string,reduced=false):void{
 if(a.lying||c.phys!==0||protectedActions.has(action))return;
 const r=reactionFor(c);if(!r)return;
 const q=r.clip,intensity=r.strength*q.weight,phase=t*q.tempo*2+q.phase;
 const wave=reduced?0:Math.sin(phase),pulse=reduced?.35:Math.max(0,Math.sin(phase)),rest=speed<.2&&c.hand<0;
 a.tilt+=intensity*(.05*q.asymmetry+.04*wave);a.lean+=intensity*.05;
 if(speed>.2){if(q.index===2){a.bendR+=intensity*.12*pulse;a.bob+=intensity*pulse;}return;}
 switch(q.index){
  case 0:if(rest){a.armL=1.1;a.foreL=2.5;}a.tilt+=intensity*.12;break;
  case 1:if(rest){a.armL=.7;a.foreL=2.2;a.armR=.2;}a.lean+=intensity*.09;break;
  case 2:a.bendR+=intensity*.2;a.hipX-=intensity*1.4;break;
  case 3:if(rest){a.armR=.7;a.foreR=1.9;}a.lean+=intensity*(.12+.04*pulse);break;
  case 4:a.lean-=intensity*.12*pulse;if(rest){a.armL=.6+pulse*.3;a.foreL=1.6;}break;
  case 5:a.tilt+=intensity*wave*.07;if(rest){a.armL=.6;a.armR=.6;a.foreL=1.7;a.foreR=1.8;}break;
  case 6:a.lean+=intensity*.16;if(rest){a.armL=1.3;a.foreL=2.4;a.armR=1.2;a.foreR=2.2;}break;
  case 7:a.bob-=intensity*pulse*1.5;if(rest){a.armL=.8+pulse*.4;a.armR=.8+pulse*.4;}break;
  case 8:if(rest){a.armL=1.2;a.foreL=2.5;}a.bob+=intensity*pulse*1.4;break;
  case 9:a.lean+=intensity*.18;a.tilt-=intensity*.12;break;
  case 10:a.bob+=intensity*wave*.9;if(rest){a.armL+=pulse*.15;a.armR+=pulse*.15;}break;
  case 11:if(rest){a.armL=.8+pulse*.3;a.armR=.8+pulse*.25;a.foreL=1.3;a.foreR=1.4;}break;
  case 12:if(rest){a.foreL=.7;a.foreR=.7;}a.lean-=intensity*.08;break;
  case 13:if(rest){a.armR=.6+pulse*.3;a.foreR=1.2;}a.lean+=intensity*.14;break;
  case 14:a.tilt-=intensity*.18;if(rest){a.armL=.7;a.foreL=1.8;}break;
  case 15:a.lean+=intensity*.2;a.tilt+=intensity*.15;if(rest){a.armL=.5;a.foreL=2;}break;
  case 16:if(rest){a.armL=1.4;a.foreL=2.4;a.armR=1.4;a.foreR=2.4;}a.bob+=wave*intensity;break;
  case 17:a.lean+=intensity*.22;a.bob+=intensity*pulse*.7;break;
  case 18:if(rest){a.armL=1.2;a.foreL=2.5;a.armR=1.3;a.foreR=2.3;}a.tilt+=intensity*wave*.1;break;
  case 19:a.lean+=intensity*.16;a.bob+=intensity*(wave*.4+.5);break;
 }
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
