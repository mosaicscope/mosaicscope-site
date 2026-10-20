import type {MarketItem} from '../sim/Commerce';
/** Shared catalogue/sea hull art, kept in the world's shaded vector style. */
export function drawBoat(g:CanvasRenderingContext2D,x:number,y:number,angle:number,item:MarketItem,scale=1,time=0):void {
 g.save();g.translate(x,y);g.rotate(angle);g.scale(scale,scale*.72);
 const length=Math.max(36,Math.min(420,(item.length??8)*12)),width=length*(item.id.endsWith('jetski')?.36:.27);
 g.lineJoin='round';g.lineWidth=1.8;g.strokeStyle='#141c1c';g.fillStyle='#c9c6b8';g.beginPath();g.moveTo(length*.55,0);g.bezierCurveTo(length*.25,-width,-length*.42,-width,-length*.48,-width*.6);g.lineTo(-length*.48,width*.6);g.bezierCurveTo(-length*.42,width,length*.25,width,length*.55,0);g.closePath();g.fill();g.stroke();
 g.fillStyle='#657b7d';g.fillRect(-length*.32,-width*.55,length*.57,width*1.1);g.strokeRect(-length*.32,-width*.55,length*.57,width*1.1);
 if(item.id.endsWith('jetski')){g.fillStyle='#b69c65';g.fillRect(-8,-3,15,6);}
 else if(item.id.endsWith('sailboat')){g.strokeStyle='#d7d4c4';g.beginPath();g.moveTo(0,0);g.lineTo(0,-length*.65);g.lineTo(length*.26,0);g.closePath();g.fillStyle='#eee5d2';g.fill();g.stroke();}
 else {const decks=item.id.endsWith('cruise')?4:item.id.endsWith('ferry')?2:1;for(let d=0;d<decks;d++){const inset=d*3;g.fillStyle=d%2?'#b9b6a5':'#e1dac6';g.fillRect(-length*.28+inset,-width*.4+inset*.3,length*.48-inset*2,width*.8-inset*.6);g.fillStyle='#314d5b';const cabin=length*.48-inset*2,count=Math.max(2,Math.floor(cabin/10));for(let i=0;i<count;i++)g.fillRect(-length*.28+inset+4+i*(cabin-12)/(count-1),-width*.35+d*3,5,3);}}
 g.strokeStyle='#ede6d377';g.lineWidth=.8;g.beginPath();g.moveTo(length*.38,-width*.25);g.lineTo(-length*.4,-width*.7);g.moveTo(length*.38,width*.25);g.lineTo(-length*.4,width*.7);g.stroke();
 if(time){g.strokeStyle='#a7c2c055';for(let i=1;i<4;i++){g.beginPath();g.moveTo(-length*.55-i*8,(-width-i*4)*.5);g.quadraticCurveTo(-length*.7-i*7,Math.sin(time*2+i)*3,-length*.55-i*8,(width+i*4)*.5);g.stroke();}}
 g.restore();
}
