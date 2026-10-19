import type {Character} from '../entities/types';
/** All coordinates are head-local, so eyewear and impact wear follow the neck transform. */
export function drawFaceAccessories(g:CanvasRenderingContext2D,c:Character,x:number,y:number,r:number,k:number,sep:number,eyeY:number,eyeR:number):void{
 const items=c.look.accessories??[],wear=c.look.accessoryWear??{};
 g.save();g.lineCap='round';g.lineJoin='round';
 const eyewear=items.find(a=>['glasses','goggles','safety-glasses','visor'].includes(a));
 if(eyewear){const damage=wear[eyewear]??0;g.save();g.translate(x,eyeY);g.rotate(damage*.055);g.lineWidth=1.3*k;g.strokeStyle=eyewear==='glasses'?'#2c302c':'#8e9a96';
  if(eyewear==='visor'){g.fillStyle='#b3d4d52e';g.beginPath();g.roundRect(-r*.91,-r*.45,r*1.82,r*1.32,3*k);g.fill();g.stroke();}
  else{for(const side of[-1,1]){g.beginPath();g.ellipse(side*sep,0,eyeR*1.4,eyeR*(eyewear==='goggles'?1.35:1.15),0,0,7);if(damage<3){g.fillStyle=eyewear==='goggles'?'#9bc6b02c':'#d3e9e91a';g.fill();}g.stroke();}g.beginPath();g.moveTo(-sep+eyeR,0);g.lineTo(sep-eyeR,0);g.stroke();}
  if(damage){g.strokeStyle='#dde7dc';g.lineWidth=.65*k;g.beginPath();g.moveTo(-sep-eyeR*.6,-eyeR*.55);g.lineTo(-sep+eyeR*.3,eyeR*.05);g.lineTo(-sep-eyeR*.2,eyeR*.8);g.moveTo(-sep+eyeR*.3,eyeR*.05);g.lineTo(-sep+eyeR*.9,-eyeR*.3);if(damage>1){g.moveTo(sep-eyeR*.8,eyeR*.4);g.lineTo(sep+eyeR*.8,-eyeR*.5);}g.stroke();}g.restore();
 }
 if(items.includes('headphones')){g.strokeStyle='#202a29';g.lineWidth=3*k;g.beginPath();g.ellipse(x,y-r*.06,r*1.04,r*1.13,0,Math.PI,Math.PI*2);g.stroke();for(const side of[-1,1]){const w=wear.headphones??0;g.save();g.translate(x+side*r*1.03,y+r*.05+w*k);g.rotate(side*w*.08);g.fillStyle='#586b66';g.strokeStyle='#bac4b4';g.lineWidth=k;g.beginPath();g.roundRect(-3*k,-6*k,6*k,12*k,2*k);g.fill();g.stroke();g.restore();}}
 const cover=items.find(a=>['respirator','medical-mask','mouthguard'].includes(a));
 if(cover){const damage=wear[cover]??0,yy=y+r*.51+damage*k*.6;g.save();g.translate(x,yy);g.rotate(damage*.07);g.strokeStyle='#c0c8b6';g.lineWidth=k;
  if(cover==='mouthguard'){g.fillStyle='#cfc8a7';g.beginPath();g.roundRect(-r*.35,-2*k,r*.7,4*k,k);g.fill();g.stroke();}
  else{g.fillStyle=cover==='respirator'?'#4e5e58':'#9eb9ad';g.beginPath();g.roundRect(-r*.58,-r*.23,r*1.16,r*.49,3*k);g.fill();g.stroke();if(cover==='respirator')for(const side of[-1,1]){g.fillStyle='#303e38';g.beginPath();g.arc(side*r*.38,0,r*.17,0,7);g.fill();}else{g.beginPath();g.moveTo(-r*.4,-k);g.lineTo(r*.4,-k);g.moveTo(-r*.4,2*k);g.lineTo(r*.4,2*k);g.stroke();}}
  if(damage){g.strokeStyle='#313d35';g.beginPath();g.moveTo(-r*.3,-r*.12);g.lineTo(r*.07,r*.1);g.lineTo(r*.2,-r*.05);g.stroke();}g.restore();
 }
 for(const [item,xx,yy]of[['nose-ring',x+r*.12,y+r*.26],['lip-ring',x+r*.23,y+r*.68],['brow-ring',x-sep,y-r*.37]] as const){if(!items.includes(item))continue;const damage=wear[item]??0;if(damage){g.fillStyle='#995b5266';g.beginPath();g.ellipse(xx,yy,3.2*k,2.5*k,0,0,7);g.fill();}g.strokeStyle='#d3bd83';g.lineWidth=1.1*k;g.beginPath();g.ellipse(xx+damage*k*.3,yy,1.7*k,2.1*k,damage*.15,0,5.6);g.stroke();}
 g.restore();
}
