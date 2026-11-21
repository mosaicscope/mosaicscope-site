// Worldwide public camera directory for the Mosaics world game.
//
// GET /api/cameras?provider=<id>&lat=<deg>&lon=<deg>&r=<km>[&d=<caltrans district>][&limit=<n>]
//
// Only official / openly licensed public feeds are used. Every response names the provider, its
// licence and the attribution text the UI must show. Nothing here touches private, login-gated or
// key-gated cameras. Images are never proxied: the browser loads each still straight from the
// publisher's own open-data host, which is what those licences are for.
const agent={'User-Agent':'MosaicScopeLiveCameras/1.0 (+https://mosaicscope.pages.dev/)','Accept-Encoding':'gzip'};
const clean=(v,n=160)=>String(v??'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,n);
const num=v=>{const n=typeof v==='string'?parseFloat(v):v;return Number.isFinite(n)?n:null;};
/** Great-circle distance in km. */
export function km(aLat,aLon,bLat,bLon){const r=Math.PI/180,x=(bLon-aLon)*r*Math.cos((aLat+bLat)*r/2),y=(bLat-aLat)*r;return Math.hypot(x,y)*6371;}
/** Accept only https URLs on the provider's own hosts. */
export function safeUrl(value,hosts){try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||!hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return null;u.protocol='https:';if(u.hostname.startsWith('s3-')&&!u.pathname.startsWith('/jamcams.tfl.gov.uk/'))return null;return u.href;}catch{return null;}}
const cam=(id,name,lat,lon,img,extra={})=>({id:String(id),name:clean(name,100),lat,lon,img,dir:clean(extra.dir,60),page:extra.page??null,at:extra.at??null});

// ---- per-provider normalisers: raw JSON in, [{id,name,lat,lon,img,dir,page,at}] out ----
export function tflCameras(raw){
 if(!Array.isArray(raw))throw Error('Invalid TfL response');
 return raw.flatMap(p=>{const props=Object.fromEntries((p.additionalProperties??[]).map(a=>[a.key,a.value])),img=safeUrl(props.imageUrl,['s3-eu-west-1.amazonaws.com','jamcams.tfl.gov.uk']);
  if(!img||props.available==='false'||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return[];
  return[cam(p.id,p.commonName,p.lat,p.lon,img,{dir:props.view})];});
}
export function singaporeCameras(raw){
 const list=raw?.items?.[0]?.cameras;if(!Array.isArray(list))throw Error('Invalid data.gov.sg response');
 return list.flatMap(c=>{const img=safeUrl(c.image,['data.gov.sg']),lat=c.location?.latitude,lon=c.location?.longitude;if(!img||!Number.isFinite(lat)||!Number.isFinite(lon))return[];
  return[cam('SG'+c.camera_id,'Expressway camera '+c.camera_id,lat,lon,img,{at:c.timestamp})];});
}
export function digitrafficCameras(raw){
 if(!Array.isArray(raw?.features))throw Error('Invalid Digitraffic response');
 return raw.features.flatMap(f=>{const [lon,lat]=f.geometry?.coordinates??[],p=f.properties??{},preset=(p.presets??[]).find(x=>x.inCollection!==false);
  if(!preset||p.collectionStatus==='REMOVED_PERMANENTLY'||!Number.isFinite(lat)||!Number.isFinite(lon))return[];
  const name=clean(String(p.name??f.id).replace(/^[a-z]+(\d+)_/i,'Road $1 · ').replace(/_/g,' '));
  return[cam(f.id,name,lat,lon,'https://weathercam.digitraffic.fi/'+encodeURIComponent(preset.id)+'.jpg',{dir:preset.presentationName})];});
}
export function driveBcCameras(raw){
 if(!Array.isArray(raw))throw Error('Invalid DriveBC response');
 return raw.flatMap(c=>{const [lon,lat]=c.location?.coordinates??[];if(!c.is_on||c.marked_stale||!Number.isFinite(lat)||!Number.isFinite(lon))return[];
  return[cam('BC'+c.id,c.name_override||c.name,lat,lon,'https://www.drivebc.ca/images/'+encodeURIComponent(c.id)+'.jpg',{dir:c.orientation,page:'https://www.drivebc.ca/'})];});
}
export function caltransCameras(raw){
 if(!Array.isArray(raw?.data))throw Error('Invalid Caltrans response');
 return raw.data.flatMap(({cctv:c})=>{if(!c||c.inService!=='true')return[];const lat=num(c.location?.latitude),lon=num(c.location?.longitude),img=safeUrl(c.imageData?.static?.currentImageURL,['dot.ca.gov']);
  if(!img||lat===null||lon===null)return[];
  return[cam('CT'+c.location.district+'-'+c.index,c.location.locationName||c.location.route,lat,lon,img,{dir:c.location.direction,page:'https://cwwp2.dot.ca.gov/vm/iframemap.htm'})];});
}
export function nztaCameras(raw){
 if(raw.error||!Array.isArray(raw.features))throw Error('NZTA camera service unavailable');
 const hosts=['trafficnz.info','journeys.nzta.govt.nz'];
 return raw.features.flatMap(f=>{const a=f.attributes??{},lat=f.geometry?.y??a.lat,lon=f.geometry?.x??a.lon,img=safeUrl(a.imageurl,hosts);
  if(!img||!Number.isFinite(lat)||!Number.isFinite(lon)||/^(true|1|yes)$/i.test(String(a.offline))||/^(true|1|yes)$/i.test(String(a.undermaintenance)))return[];
  return[cam('NZ'+a.id,a.name,lat,lon,img,{dir:[a.direction,a.description].filter(Boolean).join(' · '),page:safeUrl(a.viewurl,hosts)??'https://www.journeys.nzta.govt.nz/traffic-cameras'})];});
}

// ---- providers ----
const NZTA_LAYER='https://services.arcgis.com/CXBb7LAjgIIdcsPt/arcgis/rest/services/LiveCamerasNZTA_Public_View/FeatureServer/0/query';
export const PROVIDERS={
 nzta:{name:'NZTA Waka Kotahi traffic cameras',country:'NZ',sourceUrl:'https://www.journeys.nzta.govt.nz/traffic-cameras',licence:'NZTA open data · CC BY 4.0',licenceUrl:'https://www.nzta.govt.nz/about-us/our-data-and-official-information/use-our-data',attribution:'Images © NZ Transport Agency Waka Kotahi, used under the NZTA open data licence (CC BY 4.0).',refresh:60,
  async load({lat,lon,r}){const d=r/111,u=new URL(NZTA_LAYER);for(const[k,v]of Object.entries({f:'json',where:'1=1',outFields:'id,name,description,direction,imageurl,viewurl,offline,undermaintenance',geometry:[lon-d*1.3,lat-d,lon+d*1.3,lat+d].join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',resultRecordCount:'250'}))u.searchParams.set(k,v);return nztaCameras(await getJson(u));},cacheKey:a=>'nzta:'+a.lat.toFixed(1)+':'+a.lon.toFixed(1)+':'+a.r},
 tfl:{name:'Transport for London JamCams',country:'GB',sourceUrl:'https://tfl.gov.uk/traffic/status/',licence:'TfL Open Data · free reuse with attribution',licenceUrl:'https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service',attribution:'Powered by TfL Open Data. Images © Transport for London.',refresh:60,
  async load(){return tflCameras(await getJson('https://api.tfl.gov.uk/Place/Type/JamCam'));},cacheKey:()=>'tfl'},
 sgp:{name:'Singapore LTA expressway cameras (data.gov.sg)',country:'SG',sourceUrl:'https://data.gov.sg/datasets?query=traffic+images',licence:'Singapore Open Data Licence v1.0',licenceUrl:'https://data.gov.sg/open-data-licence',attribution:'Contains information from Traffic Images, Land Transport Authority, accessed from data.gov.sg under the Singapore Open Data Licence v1.0.',refresh:60,rotating:true,
  async load(){return singaporeCameras(await getJson('https://api.data.gov.sg/v1/transport/traffic-images'));},cacheKey:()=>'sgp',ttl:30000},
 fi:{name:'Fintraffic Digitraffic road weather cameras',country:'FI',sourceUrl:'https://www.digitraffic.fi/en/road-traffic/#weather-cameras',licence:'CC BY 4.0',licenceUrl:'https://creativecommons.org/licenses/by/4.0/',attribution:'Source: Fintraffic / digitraffic.fi, licence CC 4.0 BY.',refresh:300,
  async load(){return digitrafficCameras(await getJson('https://tie.digitraffic.fi/api/weathercam/v1/stations',{'Digitraffic-User':'MosaicScope/live-cameras'}));},cacheKey:()=>'fi'},
 bc:{name:'DriveBC highway cameras (British Columbia)',country:'CA',sourceUrl:'https://www.drivebc.ca/',licence:'Open Government Licence – British Columbia',licenceUrl:'https://www2.gov.bc.ca/gov/content/data/open-data/open-government-licence-bc',attribution:'Contains information licensed under the Open Government Licence – British Columbia. Source: DriveBC, BC Ministry of Transportation and Transit.',refresh:300,
  async load(){return driveBcCameras(await getJson('https://www.drivebc.ca/api/webcams/'));},cacheKey:()=>'bc'},
 caltrans:{name:'Caltrans CCTV (California)',country:'US',sourceUrl:'https://cwwp2.dot.ca.gov/vm/iframemap.htm',licence:'Caltrans public data feed · no charge, credit Caltrans',licenceUrl:'https://cwwp2.dot.ca.gov/documentation/cctv/cctv.htm',attribution:'Images courtesy of the California Department of Transportation (Caltrans). Public data feed, no charge.',refresh:120,
  async load({d}){return caltransCameras(await getJson(`https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${String(d).padStart(2,'0')}.json`));},cacheKey:a=>'ct'+a.d},
};
async function getJson(url,headers={}){const r=await fetch(url,{headers:{...agent,...headers},signal:AbortSignal.timeout(9000)});if(!r.ok)throw Error('Upstream '+r.status);return r.json();}

// Raw provider lists are cached in the isolate for a few minutes so a busy page never hammers a publisher.
const memory=new Map();
async function cached(p,args){const key=p.cacheKey(args),hit=memory.get(key),ttl=p.ttl??600000;if(hit&&Date.now()-hit.at<ttl)return hit.list;const list=await p.load(args);memory.set(key,{at:Date.now(),list});if(memory.size>40)memory.delete(memory.keys().next().value);return list;}

export async function fetchCameras(params){
 const p=PROVIDERS[params.provider];if(!p)throw Object.assign(Error('Unknown provider'),{status:400});
 const lat=num(params.lat),lon=num(params.lon),r=Math.min(150,Math.max(2,num(params.r)??30)),d=params.d?String(params.d).replace(/\D/g,'').slice(0,2):'',limit=Math.min(300,Math.max(1,Math.round(num(params.limit)??120)));
 if(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180)throw Object.assign(Error('lat/lon required'),{status:400});
 if(params.provider==='caltrans'&&!/^(3|4|6|7|8|11|12)$/.test(d))throw Object.assign(Error('Unsupported Caltrans district'),{status:400});
 const all=await cached(p,{lat,lon,r,d}),items=all.map(c=>({...c,km:km(lat,lon,c.lat,c.lon)})).filter(c=>c.km<=r).sort((a,b)=>a.km-b.km).slice(0,limit);
 return{fetchedAt:new Date().toISOString(),provider:{id:params.provider,name:p.name,country:p.country,sourceUrl:p.sourceUrl,licence:p.licence,licenceUrl:p.licenceUrl,attribution:p.attribution,refresh:p.refresh,rotating:!!p.rotating},total:all.length,items:items.map(c=>({id:c.id,name:c.name,lat:+c.lat.toFixed(5),lon:+c.lon.toFixed(5),img:c.img,dir:c.dir,page:c.page,at:c.at,km:+c.km.toFixed(1)}))};
}
const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':status===200?'public,max-age=60,s-maxage=120':'public,max-age=30'}});
export async function onRequestGet({request}){
 const q=Object.fromEntries(new URL(request.url).searchParams);
 try{return json(await fetchCameras(q));}catch(e){return json({error:e.status===400?e.message:'Camera directory temporarily unavailable'},e.status===400?400:503);}
}
