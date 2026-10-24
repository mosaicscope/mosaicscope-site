import fs from 'node:fs';
import crypto from 'node:crypto';
const url=process.argv[2];
const normalize=s=>s.replace(/\r\n?/g,'\n');
for(const file of fs.readdirSync('../world/assets')){const r=await fetch(url+'/world/assets/'+file);if(!r.ok)throw Error(file+' HTTP '+r.status);const remote=normalize(await r.text()),local=normalize(fs.readFileSync('../world/assets/'+file,'utf8'));if(remote!==local)throw Error('Asset mismatch '+file);}
const r=await fetch(url+'/api/live-city?code=CHC');const d=await r.json();if(!r.ok||!d.centre||!d.traffic)throw Error('Live endpoint failed');console.log(JSON.stringify({assets:'all '+fs.readdirSync('../world/assets').length+' match',weather:d.weather?.source??d.weatherStatus,roadNotices:d.traffic.provider?.source??d.traffic.status,build:crypto.createHash('sha256').update(fs.readFileSync('../world/index.html')).digest('hex').slice(0,12)}));
