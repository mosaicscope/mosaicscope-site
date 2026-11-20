import type {MappedCity} from './MappedWorld';
export interface ElevationTile {code:'CHC';cx:number;cy:number;spacing:100;reference:number;heights:number[];source:string;sourceUrl:string}
export function validElevation(tile:ElevationTile,cx:number,cy:number):boolean{return !!tile&&tile.code==='CHC'&&tile.cx===cx&&tile.cy===cy&&tile.spacing===100&&Number.isFinite(tile.reference)&&Array.isArray(tile.heights)&&tile.heights.length===25&&tile.heights.every(v=>Number.isFinite(v)&&v>-500&&v<9000);}
/** Bilinear interpolation of a 100 m sampling grid; values are metres relative to the city origin. */
export function sampledElevation(tile:ElevationTile,east:number,north:number):number {
 const x=Math.max(0,Math.min(4,(east-(tile.cx*400-200))/100)),y=Math.max(0,Math.min(4,((tile.cy*400+200)-north)/100)),ix=Math.min(3,Math.floor(x)),iy=Math.min(3,Math.floor(y)),u=x-ix,v=y-iy,a=tile.heights[iy*5+ix],b=tile.heights[iy*5+ix+1],c=tile.heights[(iy+1)*5+ix],d=tile.heights[(iy+1)*5+ix+1];
 return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v-tile.reference;
}
export function elevationAt(map:MappedCity,x:number,y:number):number|null {
 const grids=map.elevation;if(!grids?.size)return null;const east=(x-map.offsetX)*map.metresPerTile,north=-(y-map.offsetY)*map.metresPerTile,cx=Math.round(east/400),cy=Math.round(north/400);let tile=grids.get(cx+','+cy);
 // Extend the nearest loaded edge temporarily, preventing a cliff while the next district loads.
 if(!tile){let best=Infinity;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const candidate=grids.get((cx+dx)+','+(cy+dy));if(!candidate)continue;const distance=Math.hypot(east-candidate.cx*400,north-candidate.cy*400);if(distance<best){best=distance;tile=candidate;}}if(best>600)return null;}
 return tile?sampledElevation(tile,east,north)/map.metresPerTile:null;
}
