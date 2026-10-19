import type {Character,Toy} from "../entities/types";
export const UNARMED={
 slap:{name:'Slap',reach:1.2,rate:.35,damage:.45,knockback:1.2,pose:'slap',xp:0,part:'head'},
 jab:{name:'Jab',reach:1.35,rate:.4,damage:.8,knockback:1.7,pose:'punch0',xp:0,part:'torso'},
 shove:{name:'Shove',reach:1.25,rate:.7,damage:.3,knockback:3.8,pose:'shove',xp:0,part:'torso'},
 hook:{name:'Hook',reach:1.15,rate:.7,damage:1.3,knockback:3.2,pose:'punch3',xp:8,part:'head'},
 kick:{name:'Kick',reach:1.65,rate:1.0,damage:1.5,knockback:4.3,pose:'kick',xp:16,part:'leg'},
 uppercut:{name:'Uppercut',reach:1.05,rate:.85,damage:1.8,knockback:4,pose:'punch4',xp:30,part:'head'},
} as const;
export type UnarmedStyle=keyof typeof UNARMED;
export function unarmedMove(style:UnarmedStyle|undefined,xp=0){const selected=UNARMED[style??'jab'];return xp>=selected.xp?selected:UNARMED.jab;}
export const AMMO_PACKS=[{id:'pistol',name:'Pistol rounds',rounds:48,price:45},{id:'revolver',name:'Revolver rounds',rounds:36,price:55},{id:'smg',name:'SMG rounds',rounds:100,price:100},{id:'shotgun',name:'Shotgun shells',rounds:24,price:80},{id:'rifle',name:'Rifle rounds',rounds:60,price:120}] as const;

/** Carried equipment slows both keyboard movement and path walking. */
export function equipmentPace(c:Character,toys:Toy[]):number{
 const def=c.hand>=0?toys[c.hand]?.def:undefined;
 const weapon=def==='rifle'||def==='shotgun'?.86:def==='mace'?.88:def==='smg'?.94:1;
 return weapon*((c.combat?.vest??0)>0?.92:1)*((c.combat?.helmet??0)>0?.98:1);
}
