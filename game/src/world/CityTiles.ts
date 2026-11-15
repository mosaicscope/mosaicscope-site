/** Sparse continuation tiles. The bundled survey keeps its dense core; distant districts allocate only touched chunks. */
export class CityTiles{
 static readonly size=32;
 private chunks=new Map<string,{tiles:Uint8Array;buildings:Int32Array}>();
 constructor(private invalidate:(x:number,y:number)=>void){}
 get count(){return this.chunks.size;}
 private address(x:number,y:number){const cx=Math.floor(x/32),cy=Math.floor(y/32);return{key:cx+','+cy,index:(y-cy*32)*32+x-cx*32};}
 tile(x:number,y:number){const a=this.address(x,y);return this.chunks.get(a.key)?.tiles[a.index]??0;}
 building(x:number,y:number){const a=this.address(x,y);return this.chunks.get(a.key)?.buildings[a.index]??-1;}
 set(x:number,y:number,tile:number,building=-1){const a=this.address(x,y);let c=this.chunks.get(a.key);if(!c){c={tiles:new Uint8Array(1024),buildings:new Int32Array(1024).fill(-1)};this.chunks.set(a.key,c);}else{this.chunks.delete(a.key);this.chunks.set(a.key,c);}c.tiles[a.index]=tile;c.buildings[a.index]=building;this.invalidate(x,y);}
 trim(x:number,y:number,max=512){if(this.chunks.size<=max)return;const keep=new Set([...this.chunks.keys()].sort((a,b)=>{const [ax,ay]=a.split(',').map(Number),[bx,by]=b.split(',').map(Number);return Math.hypot(ax*32-x,ay*32-y)-Math.hypot(bx*32-x,by*32-y);}).slice(0,max));for(const key of this.chunks.keys())if(!keep.has(key))this.chunks.delete(key);}
}
