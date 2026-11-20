export interface LiveNotice{id:string;lat:number;lon:number;title:string;detail:string;severity:string;closed:boolean;updatedAt:string|null}
export interface CitySources{
 fetchedAt:string;
 cameras:{available:boolean;source:string;sourceUrl:string;note:string;items:{id:string;name:string;description:string;direction:string;lat:number;lon:number;imageUrl:string|null;viewUrl:string;offline:boolean;catalogueUpdatedAt:string|null}[]};
 airQuality:{pm25:number;pm10:number;aqi:number;at:string;source:string;sourceUrl:string}|null;
 earthquakes:{source:string;sourceUrl:string;items:{id:string;magnitude:number;depth:number;time:string;location:string}[]}|null;
}
export interface LiveCityData{sources?:CitySources|null;code:string;centre:{lat:number;lon:number;name:string};fetchedAt:string;weather:{temperature:number;wind:number;windDirection?:number|null;cloud:number;rain:number;symbol:string;forecastAt:string;source:string;sourceUrl:string}|null;weatherStatus:string;traffic:{available:boolean;provider:{source:string;url:string;coverage:string}|null;notices:LiveNotice[];status:string;vehicles:string}}
export const CITY_TOOLS=[
 ['refreshMap','Refresh this mapped district'],['refreshLive','Refresh live conditions'],['resetZoom','Reset map zoom'],['detail','Close street view'],['overview','Neighbourhood overview'],
 ['labels','Show or hide place labels'],['traffic','Show or hide road traffic'],['people','Show or hide local people'],['fixtures','Show or hide street furniture'],['weather','Show or hide weather effects'],
 ['cruise','Traffic mode: relaxed cruise'],['cityFlow','Traffic mode: city flow'],['rush','Traffic mode: busy rush hour'],
 ['cafe','Walk to the nearest cafe'],['bank','Walk to the nearest bank'],['shop','Walk to the nearest shop'],['park','Walk to the nearest park'],['talk','Talk to the nearest local'],
 ['road','Inspect the nearest mapped road'],['notices','Read current road notices'],['drive','Enter a nearby parked car'],['parkCar','Park and leave this car'],['clearRoute','Cancel the walking route'],
] as const;
export type CityTool=typeof CITY_TOOLS[number][0];
/** Approximate sun elevation from position and UTC time; model data remains separately attributed. */
export function cityDaylight(lat:number,lon:number,at=Date.now()):number{const d=new Date(at),day=(at-Date.UTC(d.getUTCFullYear(),0,0))/86400000,decl=.409*Math.sin(2*Math.PI*(day-81)/365),hour=(d.getUTCHours()+d.getUTCMinutes()/60+lon/15-12)*Math.PI/12,a=lat*Math.PI/180,elevation=Math.asin(Math.sin(a)*Math.sin(decl)+Math.cos(a)*Math.cos(decl)*Math.cos(hour));return Math.max(0,Math.min(1,(elevation+.12)/.4));}
export function projectedNotices(live:LiveCityData|null,origin:{lat:number;lon:number}|undefined){return live&&origin?live.traffic.notices.map(n=>({...n,x:(n.lon-origin.lon)*111320*Math.cos(origin.lat*Math.PI/180),y:-(n.lat-origin.lat)*111320})):[];}
