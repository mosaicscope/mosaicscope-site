import cities from '../../data/world-cities.json' with {type:'json'};
const globalCities=new Map(cities.map(c=>['G'+c.id,{name:c.name+', '+c.country,lat:c.lat,lon:c.lon}]));
// OpenStreetMap geometry is ODbL data. Fixed destination centres and bounded tiles; never an arbitrary URL proxy.
export const DESTINATION_CENTRES={SYD:{name:'Circular Quay, Sydney',lat:-33.8605,lon:151.2095},RAR:{name:'Avarua, Rarotonga',lat:-21.2077,lon:-159.7753},DPS:{name:'Ubud, Bali',lat:-8.5068,lon:115.2625},NRT:{name:'Shibuya, Tokyo',lat:35.6595,lon:139.7005},LAX:{name:'Santa Monica, Los Angeles',lat:34.0129,lon:-118.4957},LHR:{name:'Westminster, London',lat:51.5007,lon:-.1246}};
export function districtCentre(code,cx=0,cy=0){const c=Object.hasOwn(DESTINATION_CENTRES,code)?DESTINATION_CENTRES[code]:globalCities.get(code)??null;if(!c||!Number.isInteger(cx)||!Number.isInteger(cy)||Math.abs(cx)>20||Math.abs(cy)>20)return null;return {...c,lat:c.lat+cy*400/111320,lon:c.lon+cx*400/(111320*Math.cos(c.lat*Math.PI/180))};}
export function convertDestination(raw,code,cx=0,cy=0){const origin=districtCentre(code),centre=districtCentre(code,cx,cy);if(!centre)throw Error('Unknown district');const project=p=>[(p.lon-origin.lon)*111320*Math.cos(origin.lat*Math.PI/180),(p.lat-origin.lat)*-111320];
 const buildings=[],roads=[],venues=[];
 for(const e of raw.elements??[]){const t=e.tags??{},geom=e.geometry?.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));if(t.building&&geom?.length>=4){let points=geom.map(project);if(points.length>100)points=points.filter((_,i)=>i%Math.ceil(points.length/100)===0);const levels=Number.parseFloat(t['building:levels']),height=Number.parseFloat(t.height);buildings.push({id:e.id,name:t.name||t['addr:housename']||'',kind:t.amenity||t.shop||t.tourism||t.building,points,height:Number.isFinite(height)?Math.min(180,Math.max(3,height)):Number.isFinite(levels)?Math.min(180,levels*3.2):9.6,heightEstimated:!Number.isFinite(height)&&!Number.isFinite(levels),tags:{amenity:t.amenity,shop:t.shop,tourism:t.tourism,address:[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' ')}});}
 else if(t.highway&&geom?.length>=2)roads.push({id:e.id,name:t.name||'',kind:t.highway,points:geom.map(project)});
 else if(t.name&&Number.isFinite(e.lat)&&Number.isFinite(e.lon))venues.push({id:e.id,name:t.name,kind:t.amenity||t.shop||t.tourism||'venue',point:project(e),tags:{amenity:t.amenity,shop:t.shop,tourism:t.tourism}});
 }
 return {code,cx,cy,centre,origin,source:'OpenStreetMap contributors',licence:'ODbL-1.0',sourceUrl:'https://www.openstreetmap.org/copyright',fetchedAt:new Date().toISOString(),buildings:buildings.slice(0,180),roads:roads.slice(0,100),venues:venues.slice(0,90)};
}
/** Minimal read-API XML conversion. Attribute values are data, never HTML or executable markup. */
export function osmXml(xml){
 const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos);/g,v=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[v]));
 const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));
 const nodes=new Map(),elements=[];
 for(const m of xml.matchAll(/<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g)){const a=attrs(m[1]),tags=Object.fromEntries([...((m[2]??'').matchAll(/<tag\b([^>]*?)\/>/g))].map(t=>{const a=attrs(t[1]);return[a.k,a.v];})),n={id:Number(a.id),lat:Number(a.lat),lon:Number(a.lon),tags};nodes.set(n.id,n);if(tags.name)elements.push(n);}
 for(const m of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)){const a=attrs(m[1]),tags=Object.fromEntries([...m[2].matchAll(/<tag\b([^>]*?)\/>/g)].map(t=>{const a=attrs(t[1]);return[a.k,a.v];})),refs=[...m[2].matchAll(/<nd\b([^>]*?)\/>/g)].map(n=>nodes.get(Number(attrs(n[1]).ref)));if((tags.building||tags.highway)&&refs.every(Boolean))elements.push({id:Number(a.id),tags,geometry:refs.map(n=>({lat:n.lat,lon:n.lon}))});}
 return {elements};
}
export async function fetchDestination(code,cx=0,cy=0){const c=districtCentre(code,cx,cy);if(!c)throw Error('Invalid destination');
 // The official map API provides complete referenced nodes for this small bounding box.
 try{const dy=260/111320,dx=dy/Math.cos(c.lat*Math.PI/180),url=`https://api.openstreetmap.org/api/0.6/map?bbox=${c.lon-dx},${c.lat-dy},${c.lon+dx},${c.lat+dy}`,r=await fetch(url,{headers:{'User-Agent':'MosaicScope/1.0 public game map'},signal:AbortSignal.timeout(12000)});if(r.ok){const raw=osmXml(await r.text());if(raw.elements.length)return convertDestination(raw,code,cx,cy);}}catch{}
 const around=`(around:350,${c.lat.toFixed(6)},${c.lon.toFixed(6)})`,q=`[out:json][timeout:18];(way["building"]${around};way["highway"~"^(primary|secondary|tertiary|residential|pedestrian|footway|service)$"]${around};node["name"]["amenity"]${around};node["name"]["shop"]${around};node["name"]["tourism"]${around};);out geom;`;
 let error;for(const host of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'])try{const r=await fetch(host,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'MosaicScope/1.0 public game district data'},body:'data='+encodeURIComponent(q),signal:AbortSignal.timeout(22000)});if(!r.ok)throw Error('Map service '+r.status);return convertDestination(await r.json(),code,cx,cy);}catch(e){error=e;}throw error;
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':status===200?'public,max-age=86400,s-maxage=604800':'public,max-age=60'}});
export async function onRequestGet({request,waitUntil}){const u=new URL(request.url),code=u.searchParams.get('code')??'',cx=Number(u.searchParams.get('x')??0),cy=Number(u.searchParams.get('y')??0);if(!districtCentre(code,cx,cy))return json({error:'Unknown destination or district'},400);
 const key=new Request(`${u.origin}/api/destination-map?code=${code}&x=${cx}&y=${cy}`),cache=caches.default,hit=await cache.match(key);if(hit)return hit;
 try{const result=json(await fetchDestination(code,cx,cy));waitUntil(cache.put(key,result.clone()));return result;}catch{return json({error:'Mapped district temporarily unavailable',code,cx,cy},503);}
}
