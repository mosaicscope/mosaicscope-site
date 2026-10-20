import type {Character} from '../entities/types';
import type {ReactionClip} from './NegativeReactions';
export interface ReactionFace{eyeL:number;eyeR:number;browL:number;browR:number;browY:number;pupilX:number;pupilY:number;mouthOpen:number;mouthCurve:number;mouthWidth:number;jaw:number;teeth:number;tears:number;sweat:number}
const neutral:ReactionFace={eyeL:1,eyeR:1,browL:0,browR:0,browY:0,pupilX:0,pupilY:0,mouthOpen:0,mouthCurve:0,mouthWidth:1,jaw:0,teeth:0,tears:0,sweat:0};
const face=(p:Partial<ReactionFace>):ReactionFace=>({...neutral,...p});
const faces={
 ache:face({eyeL:.25,eyeR:.45,browL:.7,browR:-.5,mouthCurve:-.7,jaw:.2,teeth:.6,sweat:.5}),
 strain:face({eyeL:.4,eyeR:.3,browL:.6,browR:-.7,mouthOpen:.25,mouthWidth:1.2,teeth:1,jaw:-.2}),
 wince:face({eyeL:.08,eyeR:.2,browL:.8,browR:-.8,mouthCurve:-.8,mouthWidth:1.1,teeth:.6}),
 breath:face({eyeL:.6,eyeR:.6,browL:.3,browR:-.3,browY:-.4,mouthOpen:.65,mouthWidth:.55,sweat:.6}),
 flinch:face({eyeL:.1,eyeR:.5,browL:.75,browR:-.4,mouthOpen:.4,jaw:.5}),
 fear:face({eyeL:1.25,eyeR:1.3,browL:-.45,browR:.45,browY:-.6,mouthOpen:.6,mouthWidth:.65,sweat:.7}),
 cower:face({eyeL:.35,eyeR:.4,browL:-.7,browR:.7,mouthCurve:-.8,tears:.5}),
 shock:face({eyeL:1.5,eyeR:1.45,browL:-.2,browR:.2,browY:-.8,mouthOpen:.9,mouthWidth:.7,pupilY:-.2}),
 sob:face({eyeL:.12,eyeR:.15,browL:-.8,browR:.8,mouthOpen:.6,mouthCurve:-.8,tears:1}),
 sad:face({eyeL:.55,eyeR:.5,browL:-.6,browR:.6,mouthCurve:-.65,pupilY:.5,tears:.5}),
 sigh:face({eyeL:.4,eyeR:.4,browY:.2,mouthOpen:.4,mouthWidth:.45,pupilY:.3}),
 vex:face({eyeL:.6,eyeR:.8,browL:.7,browR:-.25,mouthCurve:-.4,jaw:.6,pupilX:.4}),
 tense:face({eyeL:.35,eyeR:.35,browL:.7,browR:-.7,mouthOpen:.3,mouthWidth:1.3,teeth:1}),
 angry:face({eyeL:.55,eyeR:.5,browL:1,browR:-1,browY:.3,mouthOpen:.5,mouthWidth:1.2,teeth:1}),
 disgust:face({eyeL:.35,eyeR:.65,browL:.8,browR:.3,mouthCurve:-.8,mouthWidth:.7,jaw:-.6}),
 shame:face({eyeL:.45,eyeR:.5,browL:-.45,browR:.5,mouthCurve:-.55,pupilY:.8,jaw:.1}),
 panic:face({eyeL:1.4,eyeR:1.2,browL:-.7,browR:.7,browY:-.6,mouthOpen:1,mouthWidth:.9,sweat:1}),
 grief:face({eyeL:.2,eyeR:.3,browL:-1,browR:1,mouthOpen:.4,mouthCurve:-1,tears:1,pupilY:.6}),
 overwhelmed:face({eyeL:.8,eyeR:.25,browL:-.7,browR:.8,mouthOpen:.45,jaw:.4,tears:.6,sweat:.8}),
 tired:face({eyeL:.2,eyeR:.2,browY:.3,mouthCurve:-.3,pupilY:.5,sweat:.3}),
 left:face({eyeL:.2,eyeR:.7,browL:.8,browR:-.2,pupilX:-.7,mouthCurve:-.6,jaw:.4,teeth:.4}),
 right:face({eyeL:.7,eyeR:.2,browL:.2,browR:-.8,pupilX:.7,mouthCurve:-.6,jaw:-.4,teeth:.4}),
 shut:face({eyeL:.05,eyeR:.05,browL:.8,browR:-.8,mouthOpen:.2,mouthCurve:-.8,teeth:.8}),
 cry:face({eyeL:.15,eyeR:.25,browL:-.9,browR:.9,mouthOpen:.7,mouthCurve:-.7,tears:1}),
 plead:face({eyeL:1.1,eyeR:1.1,browL:-.7,browR:.7,mouthCurve:-.8,mouthOpen:.15,pupilY:-.4,tears:.5}),
 bite:face({eyeL:.45,eyeR:.65,browL:.6,browR:-.5,mouthOpen:.2,mouthCurve:-.45,mouthWidth:.7,teeth:1,jaw:.4}),
 gag:face({eyeL:.2,eyeR:.3,browL:.8,browR:-.8,mouthOpen:1,mouthWidth:.8,jaw:.2,sweat:.6}),
 yawn:face({eyeL:.1,eyeR:.1,browL:-.2,browR:.2,mouthOpen:1,mouthWidth:1.15}),
 resolve:face({eyeL:.75,eyeR:.75,browL:.35,browR:-.35,mouthCurve:-.1,mouthWidth:.8}),
 lookUp:face({eyeL:.9,eyeR:.9,browL:-.4,browR:.4,browY:-.5,pupilY:-.8,mouthOpen:.3}),
 lookDown:face({eyeL:.4,eyeR:.45,browL:-.35,browR:.4,pupilY:.9,mouthCurve:-.55}),
};
const familyFaces=[faces.ache,faces.strain,faces.wince,faces.breath,faces.flinch,faces.fear,faces.cower,faces.shock,faces.sob,faces.sad,faces.sigh,faces.vex,faces.tense,faces.angry,faces.disgust,faces.shame,faces.panic,faces.grief,faces.overwhelmed,faces.tired];
/** Sustained conditions get a quiet expression, never a repeating three-gesture facial performance. */
export function conditionFace(index:number,strength:number):ReactionFace{
 const f=mix(neutral,familyFaces[index],Math.min(.85,.35+strength*.4));
 f.mouthOpen=Math.min(.12,f.mouthOpen);f.tears=0;f.sweat=index<4||index===16?Math.min(.5,f.sweat):0;return f;
}
export function focusedFace():ReactionFace{return face({eyeL:.8,eyeR:.8,browL:.3,browR:-.3,mouthCurve:-.1});}
const gestureFaces:Record<string,keyof typeof faces>={};
for(const [kind,keys]of Object.entries({left:'tl el al cl wl sl ql at kl jl ll hel nl xl ril pl dl ol gl ul il swl ml rl dlw yl lp',right:'tr er ar cr wr sr qr aw kr jr lr her nr xr rir pr dr or gr ur ir swr mr rr drw yr hp',shut:'tt fh fc rb he dk ds',lookDown:'ct bk kn slp hd',lookUp:'hb hu nb sn',strain:'ah bw bn nt',breath:'bi bo se',flinch:'hs pb sp',cry:'slv sb',plead:'cp wrg',bite:'ak gc ca te',gag:'st ss ff fs',disgust:'mb fp sh',yawn:'yh ws',resolve:'rc ts tu ch',cower:'cg sq'}))for(const key of keys.split(' '))gestureFaces[key]=kind as keyof typeof faces;
const fields=Object.keys(neutral) as (keyof ReactionFace)[];
const mix=(a:ReactionFace,b:ReactionFace,u:number):ReactionFace=>{const out={...neutral};for(const k of fields)out[k]=a[k]+(b[k]-a[k])*u;return out;};
const cachedFrames=new WeakMap<ReactionClip,ReactionFace[]>();
export function sampleReactionFace(clip:ReactionClip,time:number,reduced=false):ReactionFace{
 const base=familyFaces[clip.index],u=reduced?.5:Math.max(0,Math.min(1,time/clip.duration)),times=[0,.13,.24,.43,.55,.76,.87,1];
 let keys=cachedFrames.get(clip);if(!keys){keys=[neutral,...clip.keys.flatMap(k=>{const f=mix(base,faces[gestureFaces[k]??'strain'],.65);if(Math.abs(f.browL)+Math.abs(f.browR)+Math.abs(f.browY)<.22){const dominant=(['browL','browR','browY'] as const).reduce((a,b)=>Math.abs(base[a])>=Math.abs(base[b])?a:b);f[dominant]=base[dominant];}return[f,f];}),neutral];cachedFrames.set(clip,keys);}let i=0;while(i<6&&u>times[i+1])i++;const t=Math.max(0,Math.min(1,(u-times[i])/(times[i+1]-times[i])));return mix(keys[i],keys[i+1],t*t*(3-2*t));
}
const activeFaces=new WeakMap<Character,ReactionFace>();
export function setReactionFace(c:Character,f:ReactionFace|null):void{if(f)activeFaces.set(c,f);else activeFaces.delete(c);}
export function currentReactionFace(c:Character):ReactionFace|undefined{return activeFaces.get(c);}
export function drawReactionMouth(g:CanvasRenderingContext2D,f:ReactionFace,x:number,y:number,w:number,ink:string,paper:string):void{
 w*=f.mouthWidth;x+=f.jaw*w*.25;g.strokeStyle=ink;g.fillStyle=ink;g.beginPath();
 if(f.mouthOpen>.12){const h=w*(.18+f.mouthOpen*.65);g.ellipse(x,y,w,h,0,0,7);g.fill();if(f.teeth>.25){g.save();g.beginPath();g.ellipse(x,y,w,h,0,0,7);g.clip();g.fillStyle=paper;g.fillRect(x-w,y-h*.7,w*2,h*.65);g.strokeStyle='#5d4941';g.lineWidth=Math.max(.4,w*.09);for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(x+i*w*.45,y-h*.7);g.lineTo(x+i*w*.45,y-h*.05);g.stroke();}g.restore();}}
 else{g.moveTo(x-w,y+.1*w);g.quadraticCurveTo(x,y+f.mouthCurve*w,x+w,y+.1*w);g.stroke();}
}
export function drawReactionAccents(g:CanvasRenderingContext2D,f:ReactionFace,x:number,y:number,r:number,k:number):void{
 g.save();g.lineWidth=Math.max(.7,k);g.lineCap='round';
 for(const side of[-1,1]){if(f.tears>.2){const xx=x+side*r*.47;g.strokeStyle='#91c5d3';g.beginPath();g.moveTo(xx,y+r*.18);g.quadraticCurveTo(xx+side*k,y+r*.45,xx,y+r*(.4+f.tears*.45));g.stroke();}if(f.sweat>.3){g.fillStyle='#b1d1d0';g.beginPath();g.ellipse(x+side*r*.85,y-r*.05,1.1*k,(1+f.sweat*2)*k,-side*.3,0,7);g.fill();}}
 g.restore();
}
