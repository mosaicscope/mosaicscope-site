import {districtCentre} from './destination-map.js';
const agent={'User-Agent':'MosaicScopeLiveCity/1.0 https://mosaicscope.pages.dev/'};
const boundedText=(s,n=360)=>String(s??'').replace(/<[^>]*>/g,'').slice(0,n);
export function weatherFrom(raw,now=Date.now()){
 const series=raw.properties?.timeseries??[],at=series.find(s=>Date.parse(s.time)>=now-3600000&&Date.parse(s.time)<=now+7200000),v=at?.data?.instant?.details;
 if(!v||!Number.isFinite(v.air_temperature))return null;
 return{temperature:v.air_temperature,wind:v.wind_speed??0,cloud:v.cloud_area_fraction??0,rain:at.data.next_1_hours?.details?.precipitation_amount??at.data.next_6_hours?.details?.precipitation_amount??0,symbol:at.data.next_1_hours?.summary?.symbol_code??at.data.next_6_hours?.summary?.symbol_code??'',forecastAt:at.time,updatedAt:raw.properties?.meta?.updated_at,source:'MET Norway',sourceUrl:'https://api.met.no/',licence:'CC BY 4.0'};
}
export function nzNotices(raw,now=Date.now()){
 if(raw.error||!Array.isArray(raw.features))throw Error('Invalid NZTA response');
 return raw.features.flatMap(f=>{const a=f.attributes??{},p=f.geometry??{};if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||/completed|inactive|resolved/i.test(a.status??'')||a.endDate&&a.endDate<now)return[];return[{id:String(a.eventId??a.OBJECTID),lon:p.x,lat:p.y,title:boundedText(a.eventDescription||a.eventType),detail:boundedText(a.eventComments||a.impact),severity:boundedText(a.impact,80),closed:/road closed|full closure/i.test(a.impact??''),updatedAt:a.eventModified?new Date(a.eventModified).toISOString():null}];}).slice(0,80);
}
export function londonNotices(raw){if(!Array.isArray(raw))throw Error('Invalid TfL response');return raw.flatMap(a=>{let p;try{const value=JSON.parse(a.point??'null');p=value?.coordinates??value;}catch{}if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))return[];return[{id:String(a.id),lon:p[0],lat:p[1],title:boundedText(a.location||a.category||'Road disruption'),detail:boundedText(a.currentUpdate||a.comments),severity:boundedText(a.severity,80),closed:/full closure|road closed/i.test((a.currentUpdate??'')+' '+(a.comments??'')),updatedAt:a.currentUpdateDateTime??null}];}).slice(0,100);}
async function jsonFetch(url){const r=await fetch(url,{headers:agent,signal:AbortSignal.timeout(6500)});if(!r.ok)throw Error('Upstream '+r.status);return r.json();}
export async function fetchLiveCity(code,cx=0,cy=0){
 const centre=districtCentre(code,cx,cy);if(!centre)throw Error('Invalid city');
 const weatherTask=jsonFetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${centre.lat.toFixed(4)}&lon=${centre.lon.toFixed(4)}`).then(weatherFrom);
 let provider=null,noticesTask=Promise.resolve([]);
 if(centre.country==='NZ'||code==='CHC'){
  provider={source:'NZTA Waka Kotahi road notices',url:'https://www.nzta.govt.nz/about-us/our-data-and-official-information/use-our-data',coverage:'New Zealand highway events; local streets may have no notices'};
  const u=new URL('https://services.arcgis.com/CXBb7LAjgIIdcsPt/arcgis/rest/services/NZTA_Highway_Information/FeatureServer/0/query');
  for(const[k,v]of Object.entries({f:'json',where:'1=1',outFields:'eventId,status,eventDescription,eventType,impact,eventModified,endDate,eventComments',geometry:[centre.lon-.12,centre.lat-.09,centre.lon+.12,centre.lat+.09].join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',resultRecordCount:'80'}))u.searchParams.set(k,v);
  noticesTask=jsonFetch(u).then(nzNotices);
 }else if(code==='LHR'||Math.abs(centre.lat-51.5)<.4&&Math.abs(centre.lon+.12)<.7){provider={source:'Transport for London',url:'https://tfl.gov.uk/info-for/open-data-users/',coverage:'London road disruptions'};noticesTask=jsonFetch('https://api.tfl.gov.uk/Road/All/Disruption').then(londonNotices);}
 const[w,n]=await Promise.allSettled([weatherTask,noticesTask]);
 return{code,centre,fetchedAt:new Date().toISOString(),weather:w.status==='fulfilled'?w.value:null,weatherStatus:w.status==='fulfilled'&&w.value?'available':'unavailable',traffic:{available:!!provider&&n.status==='fulfilled',provider,notices:n.status==='fulfilled'?n.value:[],status:!provider?'No open road-notice feed configured here':n.status==='rejected'?'Road-notice service temporarily unavailable':'Current road notices fetched',vehicles:'Game traffic is simulated; road notices influence nearby routes.'}};
}
const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':status===200?'public,max-age=1800,s-maxage=1800':'public,max-age=60'}});
export async function onRequestGet({request,waitUntil}){const u=new URL(request.url),code=u.searchParams.get('code')??'',cx=Number(u.searchParams.get('x')??0),cy=Number(u.searchParams.get('y')??0);if(!districtCentre(code,cx,cy))return json({error:'Unknown city or district'},400);const key=new Request(u.origin+`/api/live-city?code=${code}&x=${cx}&y=${cy}&v=1`),cache=caches.default,hit=await cache.match(key);if(hit)return hit;try{const data=await fetchLiveCity(code,cx,cy),response=json(data);if(data.weather||data.traffic.available)waitUntil(cache.put(key,response.clone()));return response;}catch{return json({error:'Live city services unavailable'},503);}}
