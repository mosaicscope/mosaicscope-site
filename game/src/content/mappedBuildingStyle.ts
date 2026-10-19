import type {BuildingKind} from './buildings';
/** Map data chooses an existing town building style; it never introduces a separate destination art style. */
export function mappedBuildingStyle(mapped:{kind:string;height:number;heightEstimated:boolean;tags:Record<string,string>}):{kind:BuildingKind;floors:number}{
 const tag=mapped.kind;
 const kind:BuildingKind=mapped.tags.amenity==='cafe'?'cafe':mapped.tags.tourism==='hotel'?'hotel':mapped.tags.shop?'dairy':
  ['house','detached','semidetached_house','terrace','bungalow','yes','residential'].includes(tag)&&mapped.height<=12?'house':
  ['apartments','residential','dormitory'].includes(tag)?'apartments':['retail','commercial','supermarket'].includes(tag)?'dairy':'office';
 return {kind,floors:kind==='house'?(mapped.heightEstimated?2:Math.max(1,Math.min(2,Math.round(mapped.height/3.2)))):Math.max(2,Math.min(11,Math.round(mapped.height/3.2)))};
}
