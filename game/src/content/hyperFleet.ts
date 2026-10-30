import type {FleetModel} from './fleet';
export type HyperClass = `hyper_sport_${number}`;
const names=['Veloce','Inferno','Aquila','Tempest','Vortex','Razor','Solare','Mirage','Falcon','Titan','Strada','Nemesis','Meteor','Fiamma','Vigil','Sirocco','Falx','Corsa','Onyx','Ferro','Vanta','Raptor','Eclipse','Spectre','Ignis','Zonda','Rival','Vector','Thunder','Nova','Stella','Sabre','Zephyr','Astra','Scorpion','Striker','Pulse','Magma','Comet','Phantom'];
const lamps=['slit','quad','bar','round','square'] as const;
/** Forty collectible high-performance variants, using the shared damageable car bodies. */
export const HYPER_FLEET=Object.fromEntries(names.map((name,i)=>{
 const shape={cf:.22+(i%8)*.022,cr:.07+(i%7)*.018,hood:.32+(i%5)*.025,deck:.43+(i%6)*.018,cab:[-.34+(i%3)*.02,.08+(i%4)*.018] as [number,number],roof:[-.27+(i%5)*.015,-.09+(i%4)*.016] as [number,number],cw:.78+(i%5)*.025,rw:.58+(i%6)*.035,wheel:.27+(i%4)*.01,pill:1};
 const spec:FleetModel={name:'Lamborgotti '+name,base:i%3?'super':'super_wedge',length:2.08+(i%8)*.045,width:.98+(i%6)*.025,height:.44+(i%5)*.017,speed:(270+i*50/39)/7.2,mass:1.18+(i%9)*.06,price:145000+i*5400,wb:.29+(i%7)*.007,lamp:lamps[i%5],trim:i%3===0?'wing':i%3===1?'stripe':'plain',rim:i%3===0?'#d9ae48':'#c7b987',colors:['#e51f26','#ef2921','#d3a838','#e6bd53','#f4d279'],traffic:.025,body:{family:'Hyper '+name,shape}};return [`hyper_sport_${i}`,spec];
})) as Record<HyperClass,FleetModel>;
