import type {FleetModel} from './fleet';
export type MachineClass=`machine_${number}`;
const names=['Rocket Comet','Monster Rampage','Titan Hauler','Veyron Vitesse','Colossus','Stingray','Thunder Rig','Hyper Roadster','Armoured Mammoth','Starfire','Supreme Truck','Velocity Wedge'];
export const MACHINE_FLEET=Object.fromEntries(names.map((name,i)=>{const truck=[1,2,4,6,8,10].includes(i),rocket=i===0;
 const shape={cf:truck?.12:.36,cr:truck?.08:.2,hood:truck?.55:.32,deck:truck?.6:.48,cab:[-.35,.15] as [number,number],roof:[-.25,.03] as [number,number],cw:.9,rw:.75,wheel:i===1?.43:truck?.32:.31,pill:2,boxy:truck};
 const spec:FleetModel={name:'Mosaic '+name,base:truck?'fourby':'super',length:truck?2.9+i*.025:2.25+i*.012,width:truck?1.3:1.02,height:truck?1.12:.48,speed:(rocket?423:truck?150:310)/7.2,mass:truck?3.4:1.35,price:rocket?950000:truck?145000:420000,wb:.32,lamp:truck?'square':'slit',trim:rocket?'rocket':i===1?'monster':truck?'work':'wing',traffic:.01,colors:rocket?['#dd3b25','#d8bd6a']:['#ec2a1c','#d5ad4a','#344b58'],body:{family:name,shape}};return [`machine_${i}`,spec];})) as Record<MachineClass,FleetModel>;
