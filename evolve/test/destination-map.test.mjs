import test from 'node:test';
import assert from 'node:assert/strict';
import {districtCentre,convertDestination} from '../../functions/api/destination-map.js';
test('worldwide destinations have bounded, whitelisted district centres',()=>{
 const kuwait=districtCentre('G285787');assert.match(kuwait.name,/Kuwait/);assert.ok(kuwait.lat>28&&kuwait.lat<31);
 assert.equal(districtCentre('__proto__'),null);assert.equal(districtCentre('Gunknown'),null);assert.equal(districtCentre('G285787',21,0),null);assert.equal(districtCentre('G285787',.5,0),null);
 const next=districtCentre('G285787',1,0);assert.ok(next.lon>kuwait.lon);assert.equal(next.lat,kuwait.lat);
});
test('new city codes use their own origin for road and footprint projection',()=>{
 const c=districtCentre('G285787'),d=convertDestination({elements:[{id:1,tags:{building:'yes',name:'Mapped building','building:levels':'3'},geometry:[{lat:c.lat,lon:c.lon},{lat:c.lat,lon:c.lon+.0001},{lat:c.lat+.0001,lon:c.lon+.0001},{lat:c.lat,lon:c.lon}]}]},'G285787');
 assert.equal(d.buildings.length,1);assert.deepEqual(d.buildings[0].points[0],[0,-0]);assert.equal(d.buildings[0].heightEstimated,false);assert.equal(d.source,'OpenStreetMap contributors');
});
