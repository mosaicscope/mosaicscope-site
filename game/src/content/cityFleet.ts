import type {FleetModel} from './fleet';
export type CityFleetClass = `city_sport_${number}` | `city_sedan_${number}`;
const marques=['Alpine','Avon','Canterbury','Coastal','Kauri','Korora','Port','Rakaia','Southern','Waimak'];
const sportNames=['Apex','Bolt','Circuit','Drift','Ember','Fury','Glide','Ignite','Sprint','Velocity'];
const sedanNames=['Ash','Brook','Central','Dale','Elm','Fern','Grove','Harbour','Iris','Junction'];
const lamps=['round','quad','slit','square','bar'] as const;
/** Stable IDs and distinct proportions, fittings and handling for each model. */
export const CITY_FLEET=Object.fromEntries([true,false].flatMap(sport=>Array.from({length:100},(_,i)=>{
 const marque=Math.floor(i/10),model=i%10,phase=(i*37)%100;
 const shape={cf:(sport?.24:.12)+phase*.0015,cr:.06+(i%9)*.018,hood:(sport?.35:.42)+(i%5)*.015,deck:.49+(i%6)*.015,
  cab:[sport?-.32:-.37,sport?.12:.22] as [number,number],roof:[-.27+(i%7)*.008,-.07+(i%8)*.01] as [number,number],
  cw:.84+(i%6)*.014,rw:.67+(i%8)*.018,wheel:.26+(i%7)*.008,pill:sport?1:2};
 const spec:FleetModel={name:`${marques[marque]} ${sport?sportNames[model]:sedanNames[model]} ${sport?'Sport':'Sedan'}`,
  base:sport?'sports':'sedan',length:(sport?1.98:2.15)+(i%10)*.035,width:(sport?.88:.85)+(i%7)*.014,
  height:(sport?.52:.65)+(i%8)*.012,speed:(sport?165+55*i/99:135+55*i/99)/7.2,
  mass:(sport?1.12:1.2)+(i%11)*.045,price:(sport?38000:11000)+i*(sport?620:210),wb:.29+(i%9)*.006,
  lamp:lamps[(marque+model)%lamps.length],trim:sport?(i%3===0?'wing':'stripe'):(i%3===0?'chrome':'plain'),
  traffic:sport?.035:.1,colors:sport?['#ec2a1c','#f6b62c','#3dd6ff','#eee4d3','#22334a']:['#eee4d3','#3a3430','#9a8d80','#1c2836','#6b3a12'],
  body:{family:`${sport?'Sport':'Sedan'} ${marques[marque]} ${model+1}`,shape}};
 return [`city_${sport?'sport':'sedan'}_${i}`,spec];
}))) as Record<CityFleetClass,FleetModel>;
