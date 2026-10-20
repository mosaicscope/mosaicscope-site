/** Continuous joint-based gait: hooves plant on the ground and flex during the recovery phase. */
export function drawHorse(g:CanvasRenderingContext2D,x:number,y:number,phase:number,size:number,coat=0,jockey?:number):void{
 const moving=phase!==0,p=phase*Math.PI*2,bob=moving?Math.sin(p*2)*1.4:0,colors=['#80563c','#473c35','#b98e63','#776c60','#c3ba9e','#9b694a'],body=colors[Math.abs(coat)%6];
 g.save();g.translate(x,y);g.scale(size,size);g.lineJoin='round';g.lineCap='round';g.strokeStyle='#302c27';
 g.fillStyle='#1113';g.beginPath();g.ellipse(0,2,36,5,0,0,7);g.fill();
 for(const far of[true,false]){
  for(let i=0;i<2;i++){const hip=i?20:-23,cycle=p+(i?1.7:0)+(far?Math.PI:.2),swing=moving?Math.sin(cycle)*.65:0,lift=moving?Math.max(0,Math.cos(cycle))*1.15:0;
   const kneeX=hip+Math.sin(swing)*14,kneeY=-19+bob+Math.cos(swing)*13,footX=kneeX+Math.sin(swing-lift)*14,footY=Math.min(0,kneeY+Math.cos(swing-lift)*14);
   g.strokeStyle=far?'#514537':body;g.lineWidth=5;g.beginPath();g.moveTo(hip,-20+bob);g.lineTo(kneeX,kneeY);g.lineTo(footX,footY);g.stroke();g.strokeStyle='#302c27';g.lineWidth=4;g.beginPath();g.moveTo(footX-2,footY+1);g.lineTo(footX+3,footY+1);g.stroke();
  }
  if(far){g.fillStyle=body;g.strokeStyle='#392f28';g.lineWidth=1.2;g.beginPath();g.ellipse(-2,-28+bob,30,14,-.08,0,7);g.fill();g.stroke();g.beginPath();g.moveTo(18,-29+bob);g.bezierCurveTo(22,-39+bob,24,-53+bob,29,-54+bob);g.lineTo(38,-43+bob);g.lineTo(29,-22+bob);g.fill();g.stroke();}
 }
 g.fillStyle=body;g.beginPath();g.ellipse(35,-49+bob,12,6,.55,0,7);g.fill();g.strokeStyle='#2f2926';g.lineWidth=3;g.beginPath();g.moveTo(25,-47+bob);g.lineTo(22,-38+bob);g.stroke();
 g.fillStyle='#3c3028';g.beginPath();g.moveTo(28,-53+bob);g.lineTo(27,-62+bob);g.lineTo(33,-54+bob);g.fill();g.fillStyle='#181a17';g.beginPath();g.arc(37,-50+bob,1.1,0,7);g.fill();g.beginPath();g.arc(44,-45+bob,1.3,0,7);g.fill();
 g.strokeStyle='#342b25';g.lineWidth=5;g.beginPath();g.moveTo(-30,-29+bob);g.bezierCurveTo(-38,-31,-39,-22+Math.sin(p)*3,-45,-21+Math.sin(p)*4);g.stroke();
 if(jockey!==undefined){const c=['#ca5b50','#5986af','#c5a35e','#589374','#a275ab','#d2cfbd'][jockey%6];g.fillStyle='#362d29';g.fillRect(-8,-40+bob,21,5);g.strokeStyle='#373c36';g.lineWidth=3;g.beginPath();g.moveTo(-2,-44+bob);g.lineTo(8,-37+bob);g.lineTo(8,-24+bob);g.stroke();g.strokeStyle=c;g.lineWidth=9;g.beginPath();g.moveTo(-4,-46+bob);g.lineTo(4,-53+bob);g.stroke();g.strokeStyle='#ccb594';g.lineWidth=2;g.beginPath();g.moveTo(5,-51+bob);g.lineTo(18,-44+bob);g.lineTo(37,-44+bob);g.stroke();g.fillStyle='#ccb594';g.beginPath();g.arc(9,-58+bob,4,0,7);g.fill();g.fillStyle=c;g.beginPath();g.ellipse(8,-61+bob,5,3,0,Math.PI,Math.PI*2);g.fill();}
 g.restore();
}
