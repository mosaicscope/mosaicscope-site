import {TOYS} from '../content/toys';
import {drawToy} from '../render/ToyArt';
export interface ScanItem{id:number;def?:string;name:string;category:string}
export function scannerDefinition(item:ScanItem):string{return item.def??Object.values(TOYS).find(t=>t.name===item.name)?.id??({weapon:'bat',food:'pie',valuable:'watch',tool:'wrench',ammo:'ammo_9mm'} as Record<string,string>)[item.category]??'ball';}
export function prohibitedItem(item:ScanItem):boolean{const d=TOYS[scannerDefinition(item)];return item.category==='weapon'||item.category==='ammo'||!!d?.substance&&d.substance!=='alcohol';}
const masks=new Map<string,HTMLCanvasElement>(),tints=new Map<string,HTMLCanvasElement>();
/** The same item art as the inventory/world, recoloured through its alpha mask. */
export function drawScannerItem(g:CanvasRenderingContext2D,item:ScanItem,x:number,y:number,colour:string,alpha=1):void{
 const def=scannerDefinition(item);let cv=masks.get(def);
 if(!cv){cv=document.createElement('canvas');cv.width=180;cv.height=100;const p=cv.getContext('2d')!;
  p.fillStyle='#fff';p.strokeStyle='#fff';p.lineWidth=2;
  if(def==='stimulant_powder'||def==='cannabis'){p.beginPath();p.roundRect(58,18,48,65,4);p.fillStyle='#c5e2d5';p.fill();p.stroke();p.clearRect(61,24,42,4);p.fillStyle='#617f73';if(def==='cannabis'){for(let i=0;i<7;i++){p.save();p.translate(82,57);p.rotate(i*.65-2);p.beginPath();p.ellipse(0,-10,3,17,0,0,6.283);p.fill();p.restore();}}else{p.beginPath();p.moveTo(63,76);p.lineTo(73,49);p.lineTo(87,58);p.lineTo(96,45);p.lineTo(102,76);p.fill();}}
  else if(def==='sedative'){p.fillStyle='#c1d2c9';p.fillRect(58,18,53,64);p.strokeRect(58,18,53,64);for(let row=0;row<3;row++)for(let col=0;col<2;col++){p.fillStyle='#526f64';p.beginPath();p.ellipse(72+col*24,31+row*20,7,5,-.35,0,6.283);p.fill();}}
  else drawToy(p,def,50,65,1.55,0,TOYS[def]?.color??'#c4ddd0');
  masks.set(def,cv);
 }
 const key=def+colour;let tint=tints.get(key);if(!tint){tint=document.createElement('canvas');tint.width=180;tint.height=100;const p=tint.getContext('2d')!;p.drawImage(cv,0,0);p.globalCompositeOperation='source-atop';p.fillStyle=colour+'77';p.fillRect(0,0,180,100);tints.set(key,tint);}
 g.save();g.globalAlpha=alpha;g.shadowBlur=0;g.drawImage(tint,x-64,y-66,128,72);g.restore();
}
