import type {Aircraft} from '../content/aircraft';
/** Shared dealer, hangar and flight-game renderer. Nose points right, dimensions in metres. */
export function drawAircraft(g:CanvasRenderingContext2D,a:Aircraft,x:number,y:number,scale=1,time=0,flying=false):void {
 g.save();g.translate(x,y);g.scale(scale,scale*.72);const L=a.length*5,S=a.span*4,poly=(p:number[][],fill:string)=>{g.fillStyle=fill;g.beginPath();p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();g.stroke();};g.strokeStyle='#343b3b';g.lineWidth=1.2;
 g.fillStyle='#0003';g.beginPath();g.ellipse(0,flying?60:20,L*.48,S*.24,0,0,7);g.fill();
 if(a.type==='rotor'){
  poly([[-L*.45,0],[-L*.06,-7],[L*.25,-10],[L*.42,0],[L*.3,12],[-L*.08,10]],a.color);
  poly([[L*.07,-8],[L*.28,-7],[L*.37,0],[L*.1,3]],'#3e6470');
  g.lineWidth=2;for(const dy of[-15,18]){g.beginPath();g.moveTo(-L*.18,dy);g.lineTo(L*.32,dy);g.stroke();for(const xx of[-L*.1,L*.22]){g.beginPath();g.moveTo(xx,7);g.lineTo(xx,dy);g.stroke();}}
  poly([[-L*.45,0],[-L*.5,-17],[-L*.36,-17],[-L*.3,0]],'#777e78');
  for(let rotor=0;rotor<(a.rotors??1);rotor++){const count=a.rotors??1,rx=count===1?-L*.02:count===2?(rotor-.5)*L*.5:(rotor%2-.5)*L*.58,ry=count===4?(Math.floor(rotor/2)-.5)*S*.45:-3;g.strokeStyle='#65706a';g.lineWidth=3;g.beginPath();g.moveTo(0,0);g.lineTo(rx,ry);g.stroke();g.save();g.translate(rx,ry);g.rotate(flying?time*(rotor%2?-32:32):.3+a.tail*.14);const radius=count>1?S*.32:S*.5;for(let blade=0;blade<(a.blades??2);blade++){g.rotate(Math.PI*2/(a.blades??2));g.fillStyle='#454e4b';g.fillRect(0,-1.6,radius,3.2);g.fillStyle='#c9b994';g.fillRect(radius-5,-1.6,5,3.2);}g.restore();}g.strokeStyle='#c3b8a2';g.beginPath();g.arc(-L*.43,0,7,0,7);g.stroke();
 }else{
  const sweep=.1+a.tail*.035;
  poly([[-L*.23,0],[-L*sweep,-S*.5],[L*.02,-S*.5],[L*.22,0],[L*.02,S*.5],[-L*sweep,S*.5]],'#8f9b9e');
  for(let i=0;i<a.engines;i++){const yy=(i-(a.engines-1)/2)*S/(a.engines+1);g.fillStyle='#5f7076';g.beginPath();g.ellipse(-L*.02,yy,L*.11,4,0,0,7);g.fill();if(a.type==='prop'||a.type==='seaplane'){g.save();g.translate(L*.09,yy);g.scale(1,flying?.25+Math.abs(Math.sin(time*45)):.9);g.fillStyle='#333b3e';g.fillRect(-1,-15,2,30);g.restore();}}
  poly([[-L*.5,-4],[-L*.33,-9],[L*.34,-8],[L*.5,-2],[L*.5,2],[L*.34,8],[-L*.33,9],[-L*.5,4]],a.color);
  poly([[-L*.47,0],[-L*.43,-S*.22],[-L*.31,-S*.22],[-L*.27,0],[-L*.31,S*.22],[-L*.43,S*.22]],'#626f76');
  poly([[-L*.47,-3],[-L*.43,-24-a.tail*2],[-L*.3,-22-a.tail],[-L*.24,-3]],a.color);
  poly([[L*.3,-6],[L*.4,-4],[L*.43,-1],[L*.31,-1]],'#345563');g.strokeStyle='#8b7760';g.beginPath();g.moveTo(-L*.28,5);g.lineTo(L*.28,5);g.stroke();
  g.fillStyle='#3d535d';for(let xx=-L*.23;xx<L*.26;xx+=6)g.fillRect(xx,-4,2.8,2);
  if(a.type==='seaplane')for(const yy of[-15,15]){g.fillStyle='#7d8986';g.beginPath();g.ellipse(0,yy,L*.32,4,0,0,7);g.fill();}
  if(!flying){g.fillStyle='#2b302e';for(const xx of[-L*.18,L*.33])g.fillRect(xx,10,5,5);}
 }
 g.restore();
}
