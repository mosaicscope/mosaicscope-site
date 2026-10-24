import type {Simulation} from '../sim/Simulation';
import type {DistrictData} from '../ui/DestinationDistrict';
import {GROUND_H,FLOOR_H} from '../content/buildings';
/** Update existing surveyed buildings only. Footprint changes need a complete navigation rebuild. */
export function refreshSurveyMetadata(sim:Simulation,data:DistrictData):number{
 const m=sim.world.mapped;if(!m||!Array.isArray(data.buildings))return 0;let changed=0;
 for(const fresh of data.buildings){const b=m.buildings.find(b=>b.id===fresh.id);if(!b||!Number.isFinite(fresh.height)||fresh.height<3||fresh.height>180||!fresh.tags||typeof fresh.tags!=='object')continue;
  b.height=fresh.height;b.heightEstimated=fresh.heightEstimated;b.name=typeof fresh.name==='string'?fresh.name.slice(0,160):b.name;
  b.tags=Object.fromEntries(Object.entries(fresh.tags).filter((entry):entry is [string,string]=>typeof entry[1]==='string').map(([k,v])=>[k,v.slice(0,160)]));
  const id=m.buildingIds.get(b.id),physical=id===undefined?null:sim.world.buildings[id];
  if(physical){physical.floors=Math.max(1,Math.round(b.height/3.2));physical.height=GROUND_H+(physical.floors-1)*FLOOR_H;}
  const damage=m.damageFootprints.find(d=>d.id===b.id);if(damage)damage.height=b.height;
  changed++;
 }
 return changed;
}
