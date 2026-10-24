import {h} from './dom';
import type {LiveCityData} from './LiveCity';
const link=(text:string,href:string)=>h('a',{text,href,target:'_blank',rel:'noopener noreferrer'});
export function citySourcePanel(live:LiveCityData|null):HTMLElement{
 const box=h('div.city-sources'),s=live?.sources;
 box.append(h('h3',{text:'Real Christchurch · compare the city'}),h('p',{text:'Roads and building footprints use OpenStreetMap. Facades are interpretations; untagged heights are estimates. Cameras cannot provide complete or exact building geometry.'}),
  link('Council CBD building models · 2018 historical reference','https://gis.ccc.govt.nz/arcgis/rest/services/Hosted/CCC_CBD_Building_Models_2018_V3/MapServer'),h('br'),
  link('Christchurch Council · authoritative open datasets','https://opendata-christchurchcity.hub.arcgis.com/'));
 if(!s){box.append(h('p',{text:'Camera, air-quality and earthquake sources are loading or unavailable.'}));return box;}
 const air=s.airQuality;
 box.append(h('p',{text:air?`Air-quality model · PM2.5 ${air.pm25} µg/m³ · US AQI ${air.aqi} · ${new Date(air.at).toLocaleString()}`:'Air-quality model temporarily unavailable.'}),
  link('Air data · Open-Meteo / Copernicus CAMS','https://open-meteo.com/en/docs/air-quality-api'));
 const quakes=s.earthquakes;
 box.append(h('h4',{text:'Regional earthquake bulletin'}),h('p',{text:'Recent GeoNet reports in the wider region. These reports do not trigger game earthquakes.'}));
 for(const q of quakes?.items??[])box.append(h('p',{text:`M ${q.magnitude.toFixed(1)} · ${q.location} · ${new Date(q.time).toLocaleString()} · ${Math.round(q.depth)} km deep`}));
 if(!quakes||!quakes.items.length)box.append(h('p',{text:quakes?'No matching events in the returned regional bulletin.':'GeoNet is temporarily unavailable.'}));
 box.append(link('GeoNet earthquake catalogue','https://www.geonet.org.nz/earthquake'));
 const cameras=s.cameras;
 box.append(h('h4',{text:'Public road cameras'}),h('p',{text:cameras.note}),link('Open NZTA cameras',cameras.sourceUrl));
 if(!cameras.available||!cameras.items.length)box.append(h('p',{text:cameras.available?'No public cameras returned in this area.':'Camera catalogue temporarily unavailable.'}));
 const gallery=h('div.city-camera-grid');
 for(const c of [...cameras.items].sort((a,b)=>Math.hypot(a.lat-live!.centre.lat,(a.lon-live!.centre.lon)*.72)-Math.hypot(b.lat-live!.centre.lat,(b.lon-live!.centre.lon)*.72))){
  const details=h('details.city-camera',null,[h('summary',{text:c.name+(c.offline?' · offline':'')}),h('p',{text:c.direction+' · '+c.description}),link('View on the camera provider',c.viewUrl) ]);
  if(!c.offline&&c.imageUrl){const image=h('img',{alt:c.name+' public traffic camera still',loading:'lazy',referrerpolicy:'no-referrer',style:{width:'100%',height:'auto',borderRadius:'8px'}}) as HTMLImageElement;
   let requested=false;details.addEventListener('toggle',()=>{if((details as HTMLDetailsElement).open&&!requested){requested=true;image.src=c.imageUrl!;}});
   image.addEventListener('error',()=>{image.remove();details.append(h('p',{text:'Camera image unavailable here. Open the provider link above to check the current view.'}));});details.append(image);
  }
  details.append(h('p',{text:'Frame time not supplied. Catalogue checked '+new Date(s.fetchedAt).toLocaleString()+'.'}));gallery.append(details);
 }
 box.append(gallery);return box;
}
