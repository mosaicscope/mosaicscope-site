import test from 'node:test';
import assert from 'node:assert/strict';
import {districtCentre,convertDestination,osmXml} from '../../functions/api/destination-map.js';
test('real river centre-lines survive the map limit and retain estimated-width provenance',()=>{const c=districtCentre('CHC'),geometry=[{lat:c.lat,lon:c.lon},{lat:c.lat+.001,lon:c.lon+.001}],d=convertDestination({elements:[...Array.from({length:320},(_,id)=>({id,tags:{landuse:'tree_pit'},geometry:[...geometry,geometry[0],geometry[0]]})),{id:999,tags:{waterway:'river',name:'Actual river'},geometry}]},'CHC');assert.equal(d.terrain[0].kind,'water');assert.equal(d.terrain[0].name,'Actual river');assert.equal(d.terrain[0].tags.widthEstimated,'yes');assert.equal(d.terrain[0].points.length,4);});
test('worldwide destinations have bounded, whitelisted district centres',()=>{
 const kuwait=districtCentre('G285787');assert.match(kuwait.name,/Kuwait/);assert.ok(kuwait.lat>28&&kuwait.lat<31);
 assert.equal(districtCentre('__proto__'),null);assert.equal(districtCentre('Gunknown'),null);assert.equal(districtCentre('G285787',21,0),null);assert.equal(districtCentre('G285787',.5,0),null);
 const next=districtCentre('G285787',1,0);assert.ok(next.lon>kuwait.lon);assert.equal(next.lat,kuwait.lat);
});
test('live map conversion retains land cover, water and road restrictions, without inventing traffic observations',()=>{
 const c=districtCentre('LHR'),geometry=[{lat:c.lat,lon:c.lon},{lat:c.lat,lon:c.lon+.0001},{lat:c.lat+.0001,lon:c.lon+.0001},{lat:c.lat,lon:c.lon}];const d=convertDestination({elements:[{id:1,tags:{natural:'water',name:'Pond'},geometry},{id:2,tags:{leisure:'park',name:'Green'},geometry},{id:3,tags:{highway:'residential',lanes:'2',oneway:'yes',bridge:'yes'},geometry}]},'LHR');assert.equal(d.terrain[0].kind,'water');assert.equal(d.terrain[1].kind,'green');assert.equal(d.roads[0].tags.oneway,'yes');assert.equal(d.roads[0].tags.bridge,'yes');assert.equal(d.traffic.live,false);
 const xml='<osm><node id="1" lat="1" lon="1"/><node id="2" lat="1" lon="2"/><node id="3" lat="2" lon="2"/><way id="9"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="natural" v="water"/></way></osm>';assert.equal(osmXml(xml).elements[0].tags.natural,'water');
});
test('new city codes use their own origin for road and footprint projection',()=>{
 const c=districtCentre('G285787'),d=convertDestination({elements:[{id:1,tags:{building:'yes',name:'Mapped building','building:levels':'3'},geometry:[{lat:c.lat,lon:c.lon},{lat:c.lat,lon:c.lon+.0001},{lat:c.lat+.0001,lon:c.lon+.0001},{lat:c.lat,lon:c.lon}]}]},'G285787');
 assert.equal(d.buildings.length,1);assert.deepEqual(d.buildings[0].points[0],[0,-0]);assert.equal(d.buildings[0].heightEstimated,false);assert.equal(d.source,'OpenStreetMap contributors');
});

test('architectural source attributes and worldwide country survive map conversion',()=>{
 const c=districtCentre('G285787'),geometry=[{lat:c.lat,lon:c.lon},{lat:c.lat,lon:c.lon+.0001},{lat:c.lat+.0001,lon:c.lon+.0001},{lat:c.lat,lon:c.lon}];
 const d=convertDestination({elements:[{id:42,tags:{building:'house','building:material':'stone','building:colour':'#ccbbaa','building:architecture':'vernacular','roof:shape':'flat','roof:colour':'#aabbcc','roof:material':'concrete','building:levels':'2'},geometry}]},'G285787');
 assert.equal(d.buildings[0].tags.country,'KW');for(const [k,v]of Object.entries({'building:material':'stone','building:colour':'#ccbbaa','building:architecture':'vernacular','roof:shape':'flat','roof:colour':'#aabbcc','roof:material':'concrete'}))assert.equal(d.buildings[0].tags[k],v);
});

test('map venue opening hours and contact provenance survive without invented opening claims',()=>{
 const c=districtCentre('CHC'),geometry=[{lat:c.lat,lon:c.lon},{lat:c.lat+.0001,lon:c.lon},{lat:c.lat+.0001,lon:c.lon+.0001},{lat:c.lat,lon:c.lon}];
 const d=convertDestination({elements:[{id:10,tags:{building:'yes',amenity:'cafe',name:'Mapped cafe',opening_hours:'Mo-Fr 07:00-16:00',website:'https://example.org/'},geometry},{id:11,tags:{name:'Mapped venue',amenity:'restaurant',opening_hours:'24/7'},lat:c.lat,lon:c.lon}]},'CHC');
 assert.equal(d.buildings[0].tags.opening_hours,'Mo-Fr 07:00-16:00');assert.equal(d.buildings[0].tags.website,'https://example.org/');assert.equal(d.venues[0].tags.opening_hours,'24/7');assert.equal(d.venues[0].open,undefined);
});
