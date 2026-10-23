import {DestinationRoads} from './DestinationRoads';
import type {Camera} from './Camera';
import type {MappedCity} from '../world/MappedWorld';
/** Screen-sized static road buffer, reused while the camera follows a car. No huge world texture. */
export class MappedGround{
 private roads=new DestinationRoads();private cv=document.createElement('canvas');private map:MappedCity|null=null;
 private anchor={x:0,y:0};private zoom=0;private width=0;private height=0;private pad=192;
 draw(g:CanvasRenderingContext2D,cam:Camera,map:MappedCity):void{
  const origin=cam.toScreen(0,0,0,{x:0,y:0}),ratio=cam.zoom/(this.zoom||cam.zoom),dx=origin.x-this.anchor.x*ratio,dy=origin.y-this.anchor.y*ratio;
  if(this.map!==map||cam.viewW!==this.width||cam.viewH!==this.height||Math.abs(dx)>this.pad*.65||Math.abs(dy)>this.pad*.65||Math.abs(ratio-1)>.08){
   this.map=map;this.width=cam.viewW;this.height=cam.viewH;this.zoom=cam.zoom;this.anchor={...origin};this.cv.width=this.width+this.pad*2;this.cv.height=this.height+this.pad*2;const cg=this.cv.getContext('2d')!;
   this.roads.draw(cg,map.data,(x,y)=>{const p=cam.toScreen(x/map.metresPerTile+map.offsetX,y/map.metresPerTile+map.offsetY,0,{x:0,y:0});return[p.x+this.pad,p.y+this.pad];},this.cv.width,this.cv.height);
  }
  const r=cam.zoom/this.zoom;g.drawImage(this.cv,origin.x-(this.anchor.x+this.pad)*r,origin.y-(this.anchor.y+this.pad)*r,this.cv.width*r,this.cv.height*r);
 }
}
