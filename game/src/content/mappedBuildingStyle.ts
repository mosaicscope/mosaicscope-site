import type {BuildingKind} from './buildings';
/** Map data chooses an existing town building style; it never introduces a separate destination art style. */
export interface RegionalArchitecture{wall:string;roof:string;material:string;shape:string;architecture:string;estimated:boolean}
const named:Record<string,string>={white:'#dedace',beige:'#c8b596',brown:'#826b55',red:'#9e6652',grey:'#8b9187',gray:'#8b9187',black:'#3b4440',blue:'#657f8d',green:'#72836b',yellow:'#d0bd86',orange:'#b5835d'};
const colour=(s:string|undefined,fallback:string)=>s&&/^#[0-9a-f]{6}$/i.test(s)?s:s&&named[s.toLowerCase()]||fallback;
/** Explicit OSM attributes win; regional palettes are labelled estimates when those attributes are absent. */
export function regionalArchitecture(tags:Record<string,string>):RegionalArchitecture{
 const countries:Record<string,string>={jp:'japan',kw:'kuwait',sa:'saudi arabia',qa:'qatar',ae:'united arab emirates',bh:'bahrain',om:'oman',in:'india',gb:'united kingdom',uk:'united kingdom',nz:'new zealand',au:'australia',id:'indonesia',ck:'cook islands',es:'spain',pt:'portugal',it:'italy',fr:'france',de:'germany',br:'brazil',ar:'argentina',cl:'chile',co:'colombia',pe:'peru',mx:'mexico'};const code=(tags.country??'').toLowerCase().trim(),country=countries[code]??code,style=(tags['building:architecture']??'').toLowerCase();
 const region=/japan|jp$|japanese/.test(country+' '+style)?'japan':/kuwait|saudi|qatar|emirates|bahrain|oman|arab/.test(country+' '+style)?'gulf':/india|indian/.test(country+' '+style)?'india':/united kingdom|london|gb$|victorian|georgian/.test(country+' '+style)?'british':/spain|portugal|italy|mediterranean/.test(country+' '+style)?'mediterranean':/brazil|argentina|chile|colombia|peru|mexico/.test(country+' '+style)?'latinamerica':/france|germany/.test(country+' '+style)?'european':/indonesia|cook islands|bali|rarotonga/.test(country+' '+style)?'tropical':/australia|new zealand|nz$|au$/.test(country)?'pacific':'modern';
 const palettes:Record<string,[string,string,string,string]>={mediterranean:['#c9b59b','#a36f57','plaster','gabled'],latinamerica:['#bfa990','#8d705e','plaster','flat'],european:['#b9b2a7','#657078','stone','gabled'],japan:['#c7bfa9','#4d5c5c','timber','gabled'],gulf:['#d1bf9d','#b3a381','concrete','flat'],india:['#c9b18f','#99765e','concrete','flat'],british:['#9c7662','#5d6567','brick','gabled'],tropical:['#c9c7ae','#9b7759','timber','hipped'],pacific:['#b9bca8','#7b7564','timber','gabled'],modern:['#9aa99f','#626e69','concrete','flat']};const [wall,roof,mat,shape]=palettes[region];
 return{wall:colour(tags['building:colour'],wall),roof:colour(tags['roof:colour'],roof),material:tags['building:material']||mat,shape:tags['roof:shape']||shape,architecture:style||region,estimated:!tags['building:colour']&&!tags['building:material']&&!tags['roof:shape']};
}
export function mappedBuildingStyle(mapped:{kind:string;height:number;heightEstimated:boolean;tags:Record<string,string>;points?:number[][]}):{kind:BuildingKind;floors:number}{
 const tag=mapped.tags.building||mapped.kind;
 const ps=mapped.points??[],area=Math.abs(ps.reduce((n,p,i)=>{const q=ps[(i+1)%ps.length];return n+p[0]*q[1]-q[0]*p[1];},0)/2);
 const kind:BuildingKind=mapped.tags.amenity==='cafe'?'cafe':mapped.tags.tourism==='hotel'?'hotel':mapped.tags.shop?'dairy':
  (['house','detached','semidetached_house','terrace','bungalow','residential'].includes(tag)||tag==='yes'&&area<250)&&mapped.height<=12?'house':
  ['apartments','residential','dormitory'].includes(tag)?'apartments':['retail','commercial','supermarket'].includes(tag)?'dairy':'office';
 const surveyed=Number.parseFloat(mapped.tags['building:levels']??'');
 return {kind,floors:Number.isFinite(surveyed)&&surveyed>0?Math.max(1,Math.min(40,Math.round(surveyed))):kind==='house'?(mapped.heightEstimated?2:Math.max(1,Math.min(2,Math.round(mapped.height/3.2)))):Math.max(2,Math.min(11,Math.round(mapped.height/3.2)))};
}
