const CAMERA_LAYER='https://services.arcgis.com/CXBb7LAjgIIdcsPt/arcgis/rest/services/LiveCamerasNZTA_Public_View/FeatureServer/0/query';
export const CAMERA_SOURCE='https://www.journeys.nzta.govt.nz/traffic-cameras';
const clean=(value)=>String(value??'').replace(/<[^>]*>/g,'').slice(0,240);
export function publicCameraUrl(value){try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||!['www.trafficnz.info','trafficnz.info','www.journeys.nzta.govt.nz'].includes(u.hostname))return null;u.protocol='https:';return u.href;}catch{return null;}}
export function camerasFrom(raw){
 if(raw.error||!Array.isArray(raw.features))throw Error('Camera service unavailable');
 return raw.features.flatMap(f=>{const a=f.attributes??{},lat=f.geometry?.y??a.lat,lon=f.geometry?.x??a.lon;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return[];
  return [{id:String(a.id),name:clean(a.name),description:clean(a.description),direction:clean(a.direction),lat,lon,
   imageUrl:publicCameraUrl(a.imageurl),viewUrl:publicCameraUrl(a.viewurl)??CAMERA_SOURCE,
   offline:/^(true|1|yes)$/i.test(String(a.offline))||/^(true|1|yes)$/i.test(String(a.undermaintenance)),
   // updatedate describes the catalogue record, not the capture time of the image.
   catalogueUpdatedAt:Number.isFinite(a.updatedate)?new Date(a.updatedate).toISOString():null}];
 }).slice(0,30);
}
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(6500),headers:{'User-Agent':'MosaicScopeLiveCity/1.0'}});if(!r.ok)throw Error('Source unavailable');const d=await r.json();if(d.error)throw Error('Source unavailable');return d;}
export async function fetchCitySources(centre){
 const camera=new URL(CAMERA_LAYER);for(const[k,v]of Object.entries({f:'json',where:'1=1',outFields:'id,name,description,direction,imageurl,viewurl,offline,undermaintenance,updatedate,lat,lon',geometry:[centre.lon-.2,centre.lat-.15,centre.lon+.2,centre.lat+.15].join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',resultRecordCount:'30'}))camera.searchParams.set(k,v);
 const tasks=await Promise.allSettled([
  get(camera).then(camerasFrom),
  get(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${centre.lat.toFixed(4)}&longitude=${centre.lon.toFixed(4)}&current=pm2_5,pm10,us_aqi&timezone=UTC`),
  get('https://api.geonet.org.nz/quake?MMI=3'),
 ]);
 const [cams,air,quakes]=tasks,current=air.status==='fulfilled'?air.value.current:null;
 return {
  fetchedAt:new Date().toISOString(),
  cameras:{available:cams.status==='fulfilled',source:'NZTA / Eagle public camera catalogue',sourceUrl:CAMERA_SOURCE,items:cams.status==='fulfilled'?cams.value:[],note:'Public road-camera stills; image capture time is not supplied. Cameras may be outside the playable city centre.'},
  airQuality:current&&Number.isFinite(current.pm2_5)?{pm25:current.pm2_5,pm10:current.pm10,aqi:current.us_aqi,at:current.time+'Z',source:'Open-Meteo / CAMS atmospheric model',sourceUrl:'https://open-meteo.com/en/docs/air-quality-api'}:null,
  earthquakes:quakes.status==='fulfilled'&&Array.isArray(quakes.value.features)?{source:'GeoNet',sourceUrl:'https://www.geonet.org.nz/earthquake',items:quakes.value.features.filter(f=>{const p=f.geometry?.coordinates;return p&&Math.abs(p[0]-centre.lon)<2&&Math.abs(p[1]-centre.lat)<1.5;}).slice(0,5).map(f=>({id:clean(f.properties.publicID),magnitude:f.properties.magnitude,depth:f.properties.depth,time:f.properties.time,location:clean(f.properties.locality)}))}:null,
 };
}
