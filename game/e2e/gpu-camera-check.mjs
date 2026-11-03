import {chromium} from 'playwright-core';
import {createServer} from 'vite';
const server=await createServer({configLoader:'runner',cacheDir:'../.vite-cache-gpu',server:{host:'127.0.0.1',port:5191,strictPort:true,hmr:false}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Offline test'}}));
 await page.goto('http://127.0.0.1:5191/world/');
 await page.getByRole('button',{name:'Start new game',exact:true}).click();await page.getByRole('button',{name:'Start my story',exact:true}).click();if(await page.getByRole('button',{name:'Skip',exact:true}).isVisible())await page.getByRole('button',{name:'Skip',exact:true}).click();
 await page.waitForFunction(()=>window.__mosaics?.sim?.tick>2);const btn=page.getByRole('button',{name:'Toggle driving camera'});await btn.click();await btn.click();
 await page.waitForFunction(()=>window.__mosaics?.renderer?.gpuView?.renderer?.domElement?.style.display==='block',{},{timeout:45000});
 const initial=await page.evaluate(()=>{const g=window.__mosaics,p=g.sim.player,r=g.renderer,h=r.perspectiveHeading,q={x:p.x+Math.cos(h)*4,y:p.y+Math.sin(h)*4},sp=r.worldToScreen(q.x,q.y),back=r.screenToWorld(sp.x,sp.y);return {label:document.querySelector('.camera-toggle')?.textContent,heading:h,x:p.x,y:p.y,error:Math.hypot(q.x-back.x,q.y-back.y)};});if(!initial.label.includes('WebGL')||initial.error>.1)throw Error('GPU camera projection failed '+JSON.stringify(initial));
 await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');const after=await page.evaluate(()=>({x:window.__mosaics.sim.player.x,y:window.__mosaics.sim.player.y}));if((after.x-initial.x)*Math.cos(initial.heading)+(after.y-initial.y)*Math.sin(initial.heading)<.01)throw Error('Foot movement failed');
 await page.evaluate(async()=>{const {makeVehicle,seat}=await import('/world/src/sim/Traffic.ts');const sim=window.__mosaics.sim,p=sim.player,v=makeVehicle(sim,'sedan',p.x,p.y,p.facing,'parked');seat(sim,p,v);v.state='free';});await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('w');const car=await page.evaluate(()=>{const g=window.__mosaics,v=g.sim.vehicles[g.sim.player.inCar];return {seated:g.sim.player.inCar>=0,speed:v.speed,shown:g.renderer.gpuView.renderer.domElement.style.display};});if(!car.seated||car.shown!=='block')throw Error('Driving mode failed '+JSON.stringify(car));
 await page.evaluate(async()=>{const {unseat}=await import('/world/src/sim/Traffic.ts');const g=window.__mosaics;unseat(g.sim,g.sim.vehicles[g.sim.player.inCar]);});await btn.click();if(await page.evaluate(()=>window.__mosaics.renderer.perspectiveActive||window.__mosaics.renderer.gpuView.renderer.domElement.style.display!=='none'))throw Error('Return to city view failed');
 if(errors.length)throw Error(errors.join('\n'));console.log('GPU_CAMERA_CHECK',JSON.stringify({initial,car,errors}));
} finally {await browser.close();await server.close();}

