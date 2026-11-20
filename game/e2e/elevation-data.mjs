import {fetchElevation,elevationCoordinates} from '../../functions/api/city-elevation.js';
const points=elevationCoordinates(1,0);if(points.lat.length!==26||!elevationCoordinates(0,0)||elevationCoordinates(500,0)!==null)throw Error('Invalid coordinate grid');
const result=await fetchElevation(0,0,async u=>{if(u.searchParams.has('apikey')||u.searchParams.get('latitude').split(',').length!==26)throw Error('Unexpected service request');return {ok:true,json:async()=>({elevation:Array.from({length:26},(_,i)=>i)})};});
if(result.heights.length!==25||result.reference!==25)throw Error('Bad conversion');console.log('Elevation service request and validation passed');
