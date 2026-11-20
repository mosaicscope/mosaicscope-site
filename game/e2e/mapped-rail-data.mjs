import {convertDestination,osmXml} from '../../functions/api/destination-map.js';
const xml='<osm><node id="1" lat="-43.53" lon="172.63"/><node id="2" lat="-43.531" lon="172.631"/><way id="8"><nd ref="1"/><nd ref="2"/><tag k="barrier" v="guard_rail"/></way><way id="9"><nd ref="1"/><nd ref="2"/><tag k="highway" v="motorway"/></way></osm>';
const result=convertDestination(osmXml(xml),'CHC',0,0);
if(result.barriers.length!==1||result.barriers[0].id!==8||result.roads[0]?.kind!=='motorway')throw Error('OSM barrier or motorway conversion failed');
console.log('OSM barrier and motorway conversion passed');
