import type {FleetModel} from './fleet';
export type FusionClass=`fusion_hyper_${number}`;
const names=['Aurora','Photon','Eon','Helix','Pulsar','Orbit','Ion','Zenith','Nebula','Quasar'];
export const FUSION_FLEET=Object.fromEntries(Array.from({length:50},(_,i)=>{
 const name=names[i%10]+' '+['X','Nova','GT','R','S'][Math.floor(i/10)];
 const shape={cf:.28+(i%7)*.022,cr:.08+(i%5)*.025,hood:.28+(i%5)*.025,deck:.42+(i%6)*.02,cab:[-.32+(i%4)*.02,.1+(i%3)*.02] as [number,number],roof:[-.25+(i%5)*.012,-.08+(i%4)*.014] as [number,number],cw:.78+(i%5)*.025,rw:.59+(i%6)*.03,wheel:.27+(i%4)*.01,pill:1};
 const spec:FleetModel={name:'Fusion '+name,base:'super',length:2.05+(i%8)*.05,width:1+(i%6)*.024,height:.43+(i%5)*.018,speed:(280+(i%10)*5)/7.2,mass:1.25+(i%8)*.07,price:350000+i*6000,wb:.29+(i%7)*.007,lamp:i%2?'bar':'slit',trim:i%3?'stripe':'wing',rim:'#d6b86d',powerSource:'fusion',colors:['#e93631','#dbb85b','#dee9ec','#66d6e7','#7b64ca'],traffic:.012,body:{family:'Fusion '+name,shape}};return [`fusion_hyper_${i}`,spec];
})) as Record<FusionClass,FleetModel>;
