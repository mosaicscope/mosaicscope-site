/** Surface failure, not structural collapse. Energy uses the game's mass and speed units. */
export type FacadeMaterial='timber'|'brick'|'glass'|'concrete'|'metal'|'stone';
export const FACADE_RESPONSE:Record<FacadeMaterial,{resistance:number;hardness:number;breach:number;repair:number}>={
  glass:{resistance:18,hardness:.25,breach:.22,repair:55},
  timber:{resistance:70,hardness:.55,breach:.43,repair:90},
  brick:{resistance:155,hardness:.85,breach:.68,repair:125},
  metal:{resistance:110,hardness:.7,breach:.58,repair:100},
  concrete:{resistance:420,hardness:1,breach:Infinity,repair:160},
  stone:{resistance:380,hardness:.98,breach:Infinity,repair:170},
};
export function facadeResponse(material:FacadeMaterial,speed:number,mass:number,previous=0){
  const profile=FACADE_RESPONSE[material],energy=.5*Math.max(0,mass)*Math.max(0,speed)**2;
  const severity=Math.min(1,Math.max(0,previous)+energy/profile.resistance);
  return {energy,severity,breached:severity>=profile.breach,carDamage:Math.min(.7,Math.max(0,speed-1)*.017*profile.hardness)};
}
export function facadeBreached(material:FacadeMaterial|undefined,severity:number):boolean{return severity>=FACADE_RESPONSE[material??'brick'].breach;}
export function materialOf(tags:Record<string,string>={},kind='',floors=1):FacadeMaterial {
  const explicit=(tags['building:material']??tags.material??'').toLowerCase();
  if(/reinforced|concrete|cement/.test(explicit))return 'concrete';
  if(/timber|wood|weatherboard/.test(explicit))return 'timber';
  if(/glass|glazing/.test(explicit))return 'glass';
  if(/steel|metal|aluminium|aluminum/.test(explicit))return 'metal';
  if(/stone|granite|limestone/.test(explicit))return 'stone';
  if(/brick|masonry/.test(explicit))return 'brick';
  const use=tags.building??kind;
  return /house|detached|bungalow/.test(use)?'timber':/warehouse|garage|industrial/.test(use)?'metal':/office|hotel/.test(use)&&floors>4?'glass':/apartment|dairy|cafe|retail|residential/.test(use)?'brick':/church|museum/.test(use)?'stone':'concrete';
}
