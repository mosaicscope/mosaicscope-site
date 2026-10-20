import {hangarBay} from './Hangar';
import {DEALER_AIRCRAFT} from '../content/aircraft';
import type {Simulation} from './Simulation';
import {VEHICLES,type VehicleClass} from '../content/vehicles';
import {makeVehicle} from './Traffic';
import type {InteriorDef,Prop,PropType} from '../content/interiors';
import {PROP_INFO} from '../content/interiors';
export interface Purchase {id:number;sku:string;name:string;building:number;price:number;tick:number;vehicle?:number;bay?:{x:number;y:number};sailing?:import("./Sea").SeaState;target?:{x:number;y:number};flight?:{at:number;until:number;x:number;y:number};rounds?:number}
export interface CommerceState {serial:number;purchases:Purchase[]}
export const newCommerce=():CommerceState=>({serial:1,purchases:[]});
export function restoreCommerce(v:unknown):CommerceState {
 const s=v as CommerceState;if(!s||!Number.isSafeInteger(s.serial)||!Array.isArray(s.purchases))return newCommerce();
 const purchases=s.purchases.filter(p=>p&&Number.isSafeInteger(p.id)&&typeof p.sku==='string'&&typeof p.name==='string'&&Number.isSafeInteger(p.building)&&Number.isFinite(p.price+p.tick)).slice(-500).map(p=>{
  const sailing=p.sailing&&[p.sailing.x,p.sailing.y,p.sailing.heading,p.sailing.speed,p.sailing.rudder,p.sailing.travelled].every(Number.isFinite)?p.sailing:undefined;
  const flight=p.flight&&Object.values(p.flight).every(Number.isFinite)&&p.flight.until>p.flight.at?p.flight:undefined;
  const target=p.target&&Number.isFinite(p.target.x+p.target.y)?p.target:undefined;
  const bay=p.bay&&Number.isFinite(p.bay.x+p.bay.y)?{x:p.bay.x,y:p.bay.y}:undefined;
  return {...p,bay,sailing,flight,target};
 });return {serial:Math.max(1,s.serial,...purchases.map(p=>p.id+1)),purchases};
}

export interface MarketItem {id:string;name:string;category:'Cars'|'Marine'|'Aircraft'|'Home'|'Property'|'Experiences'|'Armory';price:number;detail:string;vehicle?:VehicleClass;prop?:PropType;length?:number;speed?:number;mass?:number}
export const MARKET:MarketItem[]=[
 {id:'civic:cone',name:'Named road cone',category:'Experiences',price:7500,detail:'A named cone at your chosen game address.'},
 {id:'civic:statue',name:'Bronze Mosaic statue',category:'Experiences',price:2250000,detail:'A commemorative statue placed at your chosen game address.'},
 {id:'home:toaster',name:'Diamond toaster',category:'Home',price:95000,prop:'machine',detail:'A visible kitchen appliance for your owned home.'},
 {id:'defense:launcher',name:'Remote rocket battery',category:'Armory',price:400000,detail:'A fictional game launcher delivered to a map address. Select a visible map target from My assets; each shot costs $1,000 and has a cooldown.'},
 ...Object.values(VEHICLES).filter(v=>!['police','ambulance','fire','tank'].includes(v.cls)).map(v=>({id:'car:'+v.cls,name:v.name,category:'Cars' as const,price:v.price,detail:v.blurb,vehicle:v.cls})),
 ...([
 ['jetski','Jet ski',18000,3,35,1],['hovercraft','Gold hovercraft',12500000,15,25,12],['dinghy','Runabout',12000,5,15,2],['fishing','Fishing launch',95000,9,14,5],['sailboat','Coastal yacht',240000,12,12,8],['cabin','Cabin cruiser',420000,16,20,16],['ferry','Passenger ferry',2800000,38,16,80],['yacht','Superyacht',28000000,62,18,140],['cruise','Cruise ship',180000000,180,12,800]
 ] as const).map(([id,name,price,length,speed,mass])=>({id:'boat:'+id,name,category:'Marine' as const,price,length,speed,mass,detail:`${length} m hull · ${speed} game knots. Delivered to the coastal marina; board and steer it in the sea region.`})),
 ...([['propeller','Touring aircraft',450000],['helicopter','Helicopter',3100000],['private-jet','Private jet',45000000]] as const).map(([id,name,price])=>({id:'air:'+id,name,category:'Aircraft' as const,price,detail:'Delivered to the airport. Your owned aircraft unlocks a private departure without a commercial fare.'})),
 ...DEALER_AIRCRAFT.map(a=>({id:'air:'+a.id,name:a.name,category:'Aircraft' as const,price:a.price,detail:`${a.type} · ${a.length.toFixed(1)} m · ${a.seats} seats · ${a.engines} engine${a.engines>1?'s':''}. Hangar delivery and private departures included.`})),
 ...([['sofa','Lounge suite',1800,'sofa'],['bed','Bedroom suite',2400,'bed'],['table','Dining suite',1200,'table'],['plant','Indoor plants',160,'plant'],['screen','Cinema screen',4200,'screen'],['lamp','Reading lamp',180,'lamp'],['cabinet','Designer cabinetry',3200,'cabinet'],['rug','Woven rug',450,'rug']] as const).map(([id,name,price,prop])=>({id:'home:'+id,name,category:'Home' as const,price,prop,detail:'Choose an owned address. Delivered furnishings appear inside that building, with their matching use action.'})),
 {id:'property:home',name:'City residence',category:'Property',price:180000,detail:'Buy an available residential building on this map. Visit and furnish the actual address.'},
 {id:'experience:amusement',name:'Amusement park company',category:'Experiences',price:250000,detail:'Open at a mapped site; ticket takings feed your existing daily company ledger.'},
 {id:'experience:marine',name:'Marine discovery park',category:'Experiences',price:320000,detail:'Own a marine education attraction at a mapped site; exhibits and daily takings belong to the company.'},
];
export function deliverySite(sim:Simulation,sku:string):number {
 if(sku.startsWith('air:')){const residence=sim.commerce.purchases.find(o=>o.sku==='property:home'&&hangarBay(sim,o.building));if(residence)return residence.building;const airfield=sim.world.buildings.find(b=>b.kind==='airport'&&hangarBay(sim,b.id));if(airfield)return airfield.id;const overflow=sim.world.buildings.find(b=>['house','flat','flats','hotel'].includes(b.kind)&&hangarBay(sim,b.id));if(overflow)return overflow.id;}
 const kind=sku.startsWith('air:')?'airport':sku.startsWith('car:')?'dealership':null;
 const candidates=sim.world.buildings.filter(b=>kind?b.kind===kind:['flat','flats','house','hotel'].includes(b.kind));
 return (candidates[0]??sim.world.buildings[0])?.id??-1;
}
export function buyMarket(sim:Simulation,sku:string,building:number):string {
 const item=MARKET.find(i=>i.id===sku),b=sim.world.buildings[building],p=sim.player;
 if(!item||!b)return 'Choose a valid delivery address.';
 if(p.cash<item.price)return 'Insufficient funds.';
 if(item.id.startsWith('experience:')&&['hospital','police','prison','airport'].includes(b.kind))return 'Choose a commercial attraction site.';
 if(item.id.startsWith('experience:')&&sim.life.businesses.some(c=>c.id===building))return 'This site already belongs to a company.';
 if(item.category==='Home'&&!sim.commerce.purchases.some(o=>o.sku==='property:home'&&o.building===building))return 'Buy this residence before furnishing it.';
 if(item.category==='Property'&&!['flat','flats','house','hotel'].includes(b.kind))return 'Choose a residential address.';
 if(['Home','Property','Aircraft','Experiences','Armory'].includes(item.category)&&sim.commerce.purchases.some(o=>o.sku===sku&&o.building===building))return 'Already installed at this address.';
 const bay=item.category==='Aircraft'?hangarBay(sim,building):null;if(item.category==='Aircraft'&&!bay)return 'No clear hangar apron near this address. Try the airport or another residence.';
 const order:Purchase={id:sim.commerce.serial++,sku,name:item.name,building,price:item.price,tick:sim.tick,...(bay?{bay}:{})};
 if(item.vehicle){const available=sim.vehicles.filter(v=>v.state==='parked'&&v.driver<0&&v.owner<0&&v.forSale&&v.cls===item.vehicle&&Math.hypot(v.x-b.door.x,v.y-b.door.y)<18),stock=available[0];
   if(stock){stock.cls=item.vehicle;stock.color=VEHICLES[item.vehicle].colors[0];stock.owner=p.id;stock.forSale=false;order.vehicle=stock.id;}
   else {const spots=[];for(let y=Math.max(1,Math.floor(b.door.y)-18);y<Math.min(sim.world.size-1,b.door.y+18);y++)for(let x=Math.max(1,Math.floor(b.door.x)-18);x<Math.min(sim.world.size-1,b.door.x+18);x++)if(sim.world.tile(x,y)===20)spots.push({x:x+.5,y:y+.5});spots.sort((a,c)=>Math.hypot(a.x-b.door.x,a.y-b.door.y)-Math.hypot(c.x-b.door.x,c.y-b.door.y));const spot=spots.find(p=>!sim.vehicles.some(v=>Math.hypot(v.x-p.x,v.y-p.y)<2));if(!spot)return 'No clear parking bay at this address. Choose another delivery site.';if(sim.vehicles.some(v=>Math.hypot(v.x-spot.x,v.y-spot.y)<2))return 'The delivery bay is occupied. Clear it or choose another dealership.';const v=makeVehicle(sim,item.vehicle,spot.x,spot.y,0,'parked');v.owner=p.id;order.vehicle=v.id;}
 }
 p.cash-=item.price;sim.commerce.purchases.push(order);
 if(item.id.startsWith('experience:')){const name=item.name;sim.life.businesses.push({id:building,name,kind:sku.endsWith('amusement')?'amusement park':'marine park',level:1,last:sim.tick});b.name=name;sim.life.renames[building]=name;}
 return `Delivered ${item.name} · ${b.name}.`;
}
export function createCompany(sim:Simulation,name:string,kind:string,building:number):string {
 const b=sim.world.buildings[building],title=name.trim().replace(/[<>\x00-\x1f]/g,'').slice(0,48);
 if(!b||!title||!['retail','food','media','transport','services'].includes(kind))return 'Choose a name, company type and premises.';
 if(sim.life.businesses.some(c=>c.id===building))return 'This premises already belongs to a company.';
 if(['hospital','police','prison','airport'].includes(b.kind))return 'Choose commercial premises.';
 if(sim.player.cash<1500)return 'Registration and lease deposit cost $1,500.';
 sim.player.cash-=1500;sim.life.businesses.push({id:building,name:title,kind,level:1,last:sim.tick});sim.life.renames[building]=title;b.name=title;
 return `${title} is open at ${sim.world.streetName(b.door.x,b.door.y)}. Daily takings use your business ledger.`;
}
/** Install actual props without blocking the entrance, existing fixtures or service targets. */
export function furnishInterior(sim:Simulation,building:number,base:InteriorDef):InteriorDef {
 const owned=sim.commerce.purchases.filter(o=>o.building===building&&(o.sku.startsWith('home:')||o.sku.startsWith('experience:')));if(!owned.length)return base;
 const attraction=owned.find(o=>o.sku.startsWith('experience:'));
 const def=attraction?parkInterior(attraction.sku.endsWith('marine')):structuredClone(base),props:Prop[]=[];
 for(const o of owned){if(o.sku.startsWith('experience:'))continue;const item=MARKET.find(i=>i.id===o.sku),type=item?.prop??(o.sku.endsWith('marine')?'fountain':'machine'),w=type==='sofa'?2.5:type==='bed'?2:1.3,h=type==='bed'?2.5:1.1;
  const existing=def.props.find(p=>p.type===type);
  if(existing){existing.label=o.name;existing.color='#8c7c66';const effect=type==='bed'?'rest':type==='sofa'?'sit':type==='table'?'eat':'play';const service=def.interactables.find(i=>i.effect===effect);if(service)service.label=o.name;else def.interactables.push({id:'order-'+o.id,label:o.name,x:existing.x+existing.w/2,y:Math.min(def.size.h-1,existing.y+existing.h+.5),text:o.name+' is ready to use.',effect});continue;}
  outer:for(let y=1;y<def.size.h-h-1;y+=1.5)for(let x=2;x<def.size.w-w-1;x+=1.5){
   if(Math.hypot(x-def.door.x,y-def.door.y)<3)continue;
   if([...def.props,...props].some(p=>!PROP_INFO[p.type].wall&&x<p.x+p.w+.4&&x+w+.4>p.x&&y<p.y+p.h+.4&&y+h+.4>p.y))continue;
   if(def.interactables.some(i=>Math.hypot(x-i.x,y-i.y)<2))continue;
   props.push({type,x,y,w,h,color:'#8c7c66',label:o.name});
   def.interactables.push({id:'order-'+o.id,label:o.name,x:x+w/2,y:y+h+.5,range:1.5,text:o.name+' is ready to use.',effect:type==='bed'?'rest':type==='sofa'?'sit':type==='table'?'eat':'play'} as typeof def.interactables[number]);break outer;
  }
 }
 def.props.push(...props);return def;
}

function parkInterior(marine:boolean):InteriorDef {
 const name=marine?'Marine discovery park':'Mosaic amusement park';
 return {kind:'fallback',title:name,size:{w:30,h:24},door:{x:1.5,y:14},light:'soft',ambience:['visitors','ticket desk','sea breeze'],busy:.7,staff:{color:'#b8a276'},zones:[{id:'entrance',name:'Tickets & information',x:0,y:0,w:8,h:24,floor:'pavers',color:'#89877a'},{id:'grounds',name:marine?'Marine exhibits':'Ride gardens',x:8,y:0,w:22,h:24,floor:marine?'concrete':'grass',color:marine?'#737c78':'#56694a'}],props:[{type:'counter',x:3,y:3,w:3,h:1,color:'#8a775c',label:'Tickets'},{type:marine?'aquarium':'wheel',x:11,y:4,w:7,h:4,color:'#789491',label:marine?'Coastal fish habitat':'Ferris wheel'},{type:marine?'aquarium':'machine',x:21,y:13,w:5,h:4,color:'#9e8765',label:marine?'Open water habitat':'Arcade pavilion'},{type:'bench',x:10,y:17,w:4,h:1,color:'#8d7961'},{type:'bench',x:19,y:20,w:4,h:1,color:'#8d7961'},{type:'tree',x:25,y:3,w:2,h:2,color:'#526b49'},{type:'tree',x:8,y:21,w:2,h:2,color:'#526b49'},{type:'bin',x:6,y:20,w:.7,h:.7,color:'#5c695c'}],interactables:[{id:'tickets',label:'Ticket office',x:4,y:5,text:'Your staff keep admissions and the daily company ledger.',effect:'browse'},{id:'ride',label:marine?'Watch the coastal habitat':'Ride the Ferris wheel',x:13,y:9,text:marine?'Fish move between the rocks while visitors watch the habitat.':'The wheel takes you above the gardens. The city looks different from up here.',effect:'play'},{id:'exhibit',label:marine?'Explore the open-water exhibit':'Play at the arcade',x:22,y:18,text:marine?'The open-water exhibit is part of your marine discovery company.':'One more round. Your visitors are having the same idea.',effect:'play'},{id:'rest',label:'Rest in the gardens',x:12,y:19,text:'A quiet bench away from the crowd.',effect:'sit'}],spots:[{x:4,y:2,doing:'work',face:'s'},{x:11,y:10,doing:'stand',face:'n'},{x:15,y:11,doing:'talk',face:'w'},{x:22,y:19,doing:'browse',face:'n'},{x:11,y:19,doing:'sit',face:'n'}],flavour:['Tickets please. Enjoy your visit.','The next group can come through now.']};
}
