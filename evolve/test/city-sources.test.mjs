import {test} from 'node:test';
import assert from 'node:assert/strict';
import {camerasFrom,publicCameraUrl,fetchCitySources} from '../../functions/api/city-sources.js';
test('camera URLs use the public provider and never arbitrary or executable URLs',()=>{
 assert.equal(publicCameraUrl('javascript:alert(1)'),null);assert.equal(publicCameraUrl('https://example.com/a'),null);
 assert.equal(publicCameraUrl('http://www.trafficnz.info/camera/596.jpg'),'https://www.trafficnz.info/camera/596.jpg');
 const [c]=camerasFrom({features:[{attributes:{id:1,name:'<b>Road</b>',offline:'false',undermaintenance:'true',imageurl:'https://example.com/a'},geometry:{x:172.6,y:-43.5}}]});
 assert.equal(c.name,'Road');assert.equal(c.offline,true);assert.equal(c.imageUrl,null);assert.equal(catalogueHasCapture(c),false);
 assert.throws(()=>camerasFrom({error:{code:500}}));
});
function catalogueHasCapture(c){return 'capturedAt'in c;}
test('one unavailable public source does not hide the remaining sources',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async url=>{
  if(String(url).includes('arcgis'))throw Error('offline');
  return new Response(JSON.stringify(String(url).includes('open-meteo')?{current:{pm2_5:3,pm10:5,us_aqi:12,time:'2026-10-24T00:00'}}:{features:[]}));
 };
 try{const d=await fetchCitySources({lat:-43.5,lon:172.6});assert.equal(d.cameras.available,false);assert.equal(d.airQuality.pm25,3);assert.deepEqual(d.earthquakes.items,[]);}finally{globalThis.fetch=original;}
});
