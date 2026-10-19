import {readFile,writeFile,unlink} from 'node:fs/promises';
const source=await readFile('../functions/api/destination-map.js','utf8');
const {convertDestination,DESTINATION_CENTRES}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for(const code of Object.keys(DESTINATION_CENTRES)){
 const path=`public/destinations/${code}.raw.json`,raw=JSON.parse(await readFile(path,'utf8')),d=convertDestination(raw,code);
 await writeFile(`public/destinations/${code}.json`,JSON.stringify(d));await unlink(path);console.log(code,d.buildings.length,'buildings',d.roads.length,'roads',d.venues.length,'venues');
}
