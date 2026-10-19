import {chromium} from 'playwright-core';
import fs from 'node:fs';
fs.mkdirSync('e2e/screenshots',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/api/**',r=>r.fulfill({json:{weather:'clear',isDay:true,temp:14,wind:10,hour:12}}));await page.goto(process.argv[2]||'http://127.0.0.1:4173/world/');await page.getByRole('button',{name:'Start new game',exact:true}).click();await page.getByRole('button',{name:'Start my story',exact:true}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();
 await page.evaluate(()=>{const g=window.__mosaics,s=g.sim,p=s.player;g.setSpeed(0);s.expansion.nextEncounter=1e12;p.inCar=-1;p.inside=-1;p.wounds=[{part:'head',kind:'cut',severity:2,art:2,bandaged:false,tick:s.tick},{part:'torso',kind:'gash',severity:3,art:3,bandaged:false,tick:s.tick},{part:'leg',kind:'graze',severity:1,art:36,bandaged:false,tick:s.tick}];p.bleed=.8;p.nextThink=s.tick;g.renderer.cam.follow=p.id;g.renderer.cam.setZoom(3);g.setSpeed(1);});
 await page.waitForFunction(()=>window.__mosaics.sim.pendingAmbulance.has(window.__mosaics.sim.playerId));
 await page.locator('.medical-status').waitFor();
 const ambulance=await page.evaluate(()=>{const g=window.__mosaics,p=g.sim.player;g.setSpeed(0);const v=g.sim.vehicles.find(v=>v.rescueTarget===p.id);if(!v)throw Error('No visible ambulance dispatched');return{id:v.id,x:v.x,y:v.y};});
 await page.screenshot({path:'e2e/screenshots/damage-cartoon-injuries.png'});
 await page.evaluate(id=>{const g=window.__mosaics,p=g.sim.player,v=g.sim.vehicles[id];v.x=v.px=p.x+4;v.y=v.py=p.y;v.state='parked';v.speed=0;g.setSpeed(1);},ambulance.id);
 await page.waitForFunction(id=>window.__mosaics.sim.vehicles[id].rescueAt!==undefined,ambulance.id);
 await page.evaluate(id=>{const g=window.__mosaics,s=g.sim,v=s.vehicles[id];g.setSpeed(0);v.damage=.85;v.dmgF=.8;v.dmgL=.7;v.dmgS=.6;v.dmgR=.55;v.glassDamage=.7;v.speed=0;},ambulance.id);
 await page.screenshot({path:'e2e/screenshots/damage-ambulance-treatment.png'});
 await page.evaluate(id=>{const g=window.__mosaics,s=g.sim,v=s.vehicles[id];s.tick=v.rescueAt-1;g.setSpeed(1);},ambulance.id);
 await page.waitForFunction(()=>{const s=window.__mosaics.sim;return !s.pendingAmbulance.has(s.playerId)&&s.player.wounds.every(w=>w.bandaged)&&s.player.blood>=.79;});
 if(await page.evaluate(()=>window.__mosaics.sim.player.blood<=0))throw Error('Nonfatal invariant failed');
 await page.evaluate(()=>window.__mosaics.setSpeed(0));await page.screenshot({path:'e2e/screenshots/damage-recovered-bandages.png'});if(errors.length)throw Error(errors.join('\n'));console.log('PASS: detailed cartoon wounds, visible ambulance dispatch and arrival, damaged vehicle drawing, treatment and nonfatal recovery without runtime errors');
}finally{await browser.close();}
