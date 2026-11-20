import {districtCentre} from './destination-map.js';
// Coarse, token-free Copernicus DEM samples, cached per district. Not a street-level survey.
export function elevationCoordinates(cx,cy){
 const origin=districtCentre('CHC',0,0);if(!origin||!districtCentre('CHC',cx,cy))return null;
 const lat=[],lon=[],cos=Math.cos(origin.lat*Math.PI/180);
 for(let row=0;row<5;row++)for(let col=0;col<5;col++){const east=cx*400-200+col*100,north=cy*400+200-row*100;lat.push(origin.lat+north/111320);lon.push(origin.lon+east/(111320*cos));}
 lat.push(origin.lat);lon.push(origin.lon);return{lat,lon};
}
export async function fetchElevation(cx,cy,fetcher=fetch){
 const coords=elevationCoordinates(cx,cy);if(!coords)throw Error('Invalid district');
 const u=new URL('https://api.open-meteo.com/v1/elevation');u.searchParams.set('latitude',coords.lat.map(n=>n.toFixed(6)).join(','));u.searchParams.set('longitude',coords.lon.map(n=>n.toFixed(6)).join(','));
 const res=await fetcher(u,{signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error('Elevation unavailable');const data=await res.json(),values=data.elevation;
 if(!Array.isArray(values)||values.length!==26||!values.every(v=>Number.isFinite(v)&&v>-500&&v<9000))throw Error('Invalid elevation data');
 return{code:'CHC',cx,cy,spacing:100,reference:values[25],heights:values.slice(0,25),source:'Copernicus DEM GLO-90 via Open-Meteo',sourceUrl:'https://open-meteo.com/en/docs/elevation-api'};
}
export async function onRequestGet({request,waitUntil}){
 const u=new URL(request.url),cx=Number(u.searchParams.get('x')),cy=Number(u.searchParams.get('y'));if(!Number.isInteger(cx)||!Number.isInteger(cy)||!districtCentre('CHC',cx,cy))return new Response('Invalid district',{status:400});
 const cache=caches.default,key=new Request(`${u.origin}/api/city-elevation?x=${cx}&y=${cy}&v=1`),hit=await cache.match(key);if(hit)return hit;
 try{const data=await fetchElevation(cx,cy),response=new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':'public,max-age=86400,s-maxage=604800'}});waitUntil(cache.put(key,response.clone()));return response;}catch{return new Response('Elevation unavailable',{status:503,headers:{'Cache-Control':'no-store'}});}
}
