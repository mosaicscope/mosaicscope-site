import {DestinationRoads} from './DestinationRoads';
import type {Camera} from './Camera';
import type {MappedCity} from '../world/MappedWorld';
/** Screen-sized static road buffer, reused while the camera follows a car. No huge world texture. */
export class MappedGround{
 private revision=-1;private roads=new DestinationRoads();private cv=document.createElement('canvas');private map:MappedCity|null=null;
 private anchor={x:0,y:0};private zoom=0;private width=0;private height=0;private pad=192;
 draw(g:CanvasRenderingContext2D,cam:Camera,map:MappedCity):void{
  const origin=cam.toScreen(0,0,0,{x:0,y:0}),ratio=cam.zoom/(this.zoom||cam.zoom),dx=origin.x-this.anchor.x*ratio,dy=origin.y-this.anchor.y*ratio,panX=dx-(1-ratio)*cam.viewW/2,panY=dy-(1-ratio)*cam.viewH/2;
  if(this.revision!==(map.revision??0)||this.map!==map||cam.viewW!==this.width||cam.viewH!==this.height||Math.abs(panX)+Math.max(0,1-ratio)*cam.viewW/2>this.pad*ratio*.65||Math.abs(panY)+Math.max(0,1-ratio)*cam.viewH/2>this.pad*ratio*.65||Math.abs(ratio-1)>(Math.abs(cam.zoom-cam.targetZoom)>.015?.3:.08)){
   this.revision=map.revision??0;this.map=map;this.width=cam.viewW;this.height=cam.viewH;this.zoom=cam.zoom;this.anchor={...origin};this.cv.width=this.width+this.pad*2;this.cv.height=this.height+this.pad*2;const cg=this.cv.getContext('2d')!;
   const corners=[cam.toWorld(-this.pad,-this.pad),cam.toWorld(cam.viewW+this.pad,-this.pad),cam.toWorld(-this.pad,cam.viewH+this.pad),cam.toWorld(cam.viewW+this.pad,cam.viewH+this.pad)],xs=corners.map(p=>(p.x-map.offsetX)*map.metresPerTile),ys=corners.map(p=>(p.y-map.offsetY)*map.metresPerTile),bounds={x0:Math.min(...xs)-20,y0:Math.min(...ys)-20,x1:Math.max(...xs)+20,y1:Math.max(...ys)+20};
   this.roads.draw(cg,map.data,(x,y)=>{const p=cam.toScreen(x/map.metresPerTile+map.offsetX,y/map.metresPerTile+map.offsetY,0,{x:0,y:0});return[p.x+this.pad,p.y+this.pad];},this.cv.width,this.cv.height,false,bounds);
  }
  const r=cam.zoom/this.zoom;g.drawImage(this.cv,origin.x-(this.anchor.x+this.pad)*r,origin.y-(this.anchor.y+this.pad)*r,this.cv.width*r,this.cv.height*r);
 }
}
