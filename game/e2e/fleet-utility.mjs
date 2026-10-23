// Render every added model at two LODs and capture a working-fleet contact sheet.
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import fs from 'node:fs';
const server=await createServer({server:{host:'127.0.0.1',port:5187,strictPort:true,hmr:false}});
await server.listen();
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/opt/pw-browsers/chromium'),headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({json:{weather:'clear',isDay:true,temp:14,wind:10,hour:12,posts:[]}}));
 await page.goto('http://127.0.0.1:5187/world/');
 const result=await page.evaluate(async()=>{
   const [{EXPANDED_FLEET},{drawCar},{Camera},{VEHICLES},{setPayload,stepUtility}]=await Promise.all([
     import('/world/src/content/fleetExpansion.ts'),import('/world/src/render/Cars.ts'),import('/world/src/render/Camera.ts'),import('/world/src/content/vehicles.ts'),import('/world/src/sim/VehicleUtility.ts')]);
   window.__mosaics?.setSpeed(0);
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=960;canvas.style='position:fixed;inset:0;z-index:99999;width:1280px;height:960px';document.body.append(canvas);
   const g=canvas.getContext('2d'),camera=new Camera();camera.resize(320,240);camera.worldSize=100;camera.lookAt(0,0,true);
   const make=(cls,id=0)=>({id,cls,x:0,y:0,px:0,py:0,heading:0,speed:4,color:VEHICLES[cls].colors[0],driver:0,owner:0,state:'free',dir:0,nextDir:-1,damage:0,siren:false,plate:'QA'+String(id).padStart(4,'0'),forSale:false,price:VEHICLES[cls].price,stuck:0,honkAt:0,crashedUntil:0,meet:false,driveThrottle:.9,wheelTravel:2});
   const start=performance.now();let rendered=0;
   for(const zoom of[.65,2])for(const[id]of Object.entries(EXPANDED_FLEET)){camera.zoom=zoom;g.clearRect(0,0,1280,960);drawCar(g,camera,make(id,rendered),1,3,.2,false);rendered++;}
   const elapsed=performance.now()-start;
   g.fillStyle='#1b2928';g.fillRect(0,0,1280,960);
   const examples=['pika','kestrel','quietlink','stockman','timberline','watercart','recovery','roadcrew','rescuepump','recycler','freshbox','quarry'];
   examples.forEach((id,i)=>{
     const x=i%4*320,y=Math.floor(i/4)*320,v=make(id,i);camera.zoom=id==='pika'?2.2:1.45;camera.resize(320,240);
     setPayload(v,VEHICLES[id].design?.utility?.capacity??0);
     for(let j=0;j<120;j++)stepUtility(v,-6,4,6,true,1/60);
     if(id==='watercart'){setPayload(v,2.5);stepUtility(v,0,6,5,false,.2);}
     v.bodyRoll=.025;v.bodyPitch=-.015;v.hazards=true;
     g.save();g.translate(x,y);g.fillStyle=i%2?'#263734':'#22322f';g.fillRect(4,4,312,312);drawCar(g,camera,v,1,4,.25,false);
     g.fillStyle='#e1dfc9';g.font='600 15px Arial';g.fillText(VEHICLES[id].name,14,268,290);g.fillStyle='#b2c6b5';g.font='12px Arial';g.fillText(VEHICLES[id].design?.body?.family??id,14,289,290);
     if(v.utility)g.fillText(v.utility.payload.toFixed(1)+' t load · '+Math.round(v.utility.brakeHeat*100)+'% brake heat',14,307,290);g.restore();
   });
   return {models:Object.keys(EXPANDED_FLEET).length,rendered,elapsedMs:Math.round(elapsed),examples};
 });
 fs.mkdirSync('e2e/screenshots',{recursive:true});await page.screenshot({path:'e2e/screenshots/utility-fleet.png'});
 if(result.models!==200||result.rendered!==400||errors.length)throw new Error(JSON.stringify({result,errors}));
 console.log('Fleet visual check passed:',JSON.stringify(result));
}finally{await browser?.close();await server.close();}
