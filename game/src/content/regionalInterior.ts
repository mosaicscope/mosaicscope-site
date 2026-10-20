import type {InteriorDef} from './interiors';
import {regionProfile} from './regions';
/** Regional materials and decor preserve the tested floor plan and every service/navigation target. */
export function regionalInterior(country:string,city:string,base:InteriorDef):InteriorDef{
 if(!country)return base;const d=structuredClone(base),p=regionProfile(country),gulf=['KW','AE','QA','BH','OM','SA'].includes(country);
 d.title=city+' · '+d.title.replace(/Christchurch|Canterbury|Ōtautahi|Pūtahi/g,'Local');
 if(!['hospital','police','mentalhealth','bank'].includes(d.kind)){
  for(const z of d.zones){if(gulf){z.floor=z.floor==='wood'?'marble':z.floor;z.color='#b9ad92';}else if(country==='IN'&&z.floor==='wood'){z.floor='tile';z.color='#a4947b';}}
  for(const prop of d.props){if(['rug','sofa','chair','table','counter'].includes(prop.type))prop.color=gulf?'#93805e':country==='JP'?'#847761':p.wall;if(prop.label&&/Christchurch|Port Hills|Ōtautahi|Canterbury/i.test(prop.label))prop.label='Local print · '+city;}
 }
 d.flavour=['A local room in '+city+'.',...p.foods.slice(0,2).map(n=>n+' is part of the neighbourhood.')];return d;
}
