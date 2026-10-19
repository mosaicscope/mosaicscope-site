import type {Wound,WoundPart,Vehicle,Character} from "../entities/types";
const faceSites=['left-eye','right-eye','cheek','nose','brow'] as const;
const faceMarks=['bruise','scrape','cut','swelling'] as const;
export const FACE_DAMAGE_MODELS=faceSites.flatMap((site,zone)=>faceMarks.map((mark,pattern)=>({id:`face-${site}-${mark}`,site,zone,mark,pattern})));
const bodySites=[['chest','torso'],['abdomen','torso'],['back','torso'],['left-upper-arm','arm'],['right-upper-arm','arm'],['left-forearm','arm'],['right-forearm','arm'],['knee','leg'],['shin','leg']] as const;
const bodyMarks=['bruise','scrape','cut','torn-clothing','swelling'] as const;
export const BODY_DAMAGE_MODELS=bodySites.flatMap(([site,part],zone)=>bodyMarks.map((mark,pattern)=>({id:`body-${site}-${mark}`,site,part,zone,mark,pattern})));
const carSites=['bonnet','boot','left-door','right-door','roof','windscreen','rear-window','front-bumper','rear-bumper','sill'] as const;
const carMarks=['scuff','dent','crease','split-paint','bent-panel','scorch'] as const;
export const CAR_DAMAGE_MODELS=carSites.flatMap((site,zone)=>carMarks.map((mark,pattern)=>({id:`car-${site}-${mark}`,site,zone,mark,pattern,threshold:[.12,.26,.4,.56,.72,.9][pattern]})));
export function woundArt(part:WoundPart,kind:Wound['kind'],seed:number):number{
 const motif=kind==='bruise'?0:kind==='graze'?1:kind==='fracture'?4:kind==='gash'?3:2;
 if(part==='head')return (Math.abs(seed)%5)*4+(motif===4?3:motif);
 const zones=bodySites.map((s,i)=>s[1]===part?i:-1).filter(i=>i>=0);
 return zones[Math.abs(seed)%zones.length]*5+motif;
}
export function bodyDamageModel(w:Wound){const model=BODY_DAMAGE_MODELS[w.art??woundArt(w.part,w.kind,w.tick)];return model?.part===w.part?model:BODY_DAMAGE_MODELS[woundArt(w.part,w.kind,w.tick)];}
export function faceDamageModel(w:Wound){return FACE_DAMAGE_MODELS[w.art??woundArt('head',w.kind,w.tick)]??FACE_DAMAGE_MODELS[0];}
export function carZoneDamage(v:Vehicle,zone:number):number{
 const f=v.dmgF??0,r=v.dmgR??0,l=v.dmgL??0,s=v.dmgS??0;
 return [f,r,l,s,Math.max(f,r),v.glassDamage??f,v.glassDamage??r,f,r,Math.max(l,s)][zone];
}
export function needsMedicalResponse(c:Character):boolean{return c.blood<.45||(c.phys===2&&c.physTimer>10)||c.wounds.filter(w=>!w.bandaged).reduce((n,w)=>n+w.severity,0)>=6||c.wounds.some(w=>!w.bandaged&&(w.severity===3||w.kind==='fracture'));}
