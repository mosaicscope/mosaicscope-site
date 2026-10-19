import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:900},deviceScaleFactor:2}),errors=[];
page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('e2e/screenshots',{recursive:true});
try{
 await page.route('**/api/**',r=>r.fulfill({json:{weather:'clear',isDay:true,temp:14,wind:10,hour:12}}));
 await page.goto(process.argv[2]||'http://127.0.0.1:4173/world/');await page.getByRole('button',{name:'Start new game',exact:true}).click();await page.getByRole('button',{name:'Start my story',exact:true}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();
 await page.evaluate(()=>{window.__mosaics.setSpeed(0);window.__mosaics.sim.expansion.nextEncounter=1e12;});
 await page.getByRole('button',{name:'Fight / gun controls',exact:true}).click();
 const mechanism=page.getByRole('img',{name:'Enlarged moving weapon mechanism; visual demonstration only'});
 await mechanism.scrollIntoViewIfNeeded();await page.waitForTimeout(200);const a=await mechanism.evaluate(c=>c.toDataURL());await page.waitForTimeout(400);if(a===await mechanism.evaluate(c=>c.toDataURL()))throw Error('Weapon mechanism did not animate');
 for(const def of['pistol','revolver','smg','rifle','shotgun','golden_pistol']){await page.getByLabel('Weapon mechanism',{exact:true}).selectOption(def);await page.waitForTimeout(80);if(!await mechanism.evaluate(c=>c.getContext('2d').getImageData(300,112,1,1).data[3]))throw Error('Blank weapon '+def);}
 await page.getByLabel('Weapon mechanism',{exact:true}).selectOption('shotgun');await page.screenshot({path:'e2e/screenshots/gritty-weapon-study.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Fight / gun controls',exact:true}).click();await mechanism.scrollIntoViewIfNeeded();await page.waitForTimeout(100);const still=await mechanism.evaluate(c=>c.toDataURL());await page.waitForTimeout(200);if(still!==await mechanism.evaluate(c=>c.toDataURL()))throw Error('Reduced motion preview still animates');await page.getByRole('button',{name:'Close',exact:true}).click();await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{const g=window.__mosaics,s=g.sim,p=s.player;g.settings.fakeBlood=true;g.applySettings();s.fakeBlood=true;g.renderer.fakeBlood=true;const q=s.world.nearestWalkable(p.x,p.y);p.x=p.px=q.x;p.y=p.py=q.y;p.emo.fear=1;p.emo.mood=-.8;p.needs.energy=.05;p.phys=2;p.physTimer=9999;p.blood=.7;p.wounds=[{part:'arm',kind:'stab',severity:3,bandaged:false,tick:s.tick,hits:6,weapon:'knife',detached:{side:1,x:p.x+.5,y:p.y+.3,z:.4,vx:1,vy:1,vz:1,angle:.4,spin:3,tick:s.tick,cause:'knife'}},{part:'leg',kind:'fracture',severity:3,compound:true,bandaged:false,tick:s.tick,art:39},{part:'torso',kind:'stab',severity:3,bandaged:false,tick:s.tick,art:12}];g.renderer.cam.follow=p.id;g.renderer.cam.zoom=g.renderer.cam.targetZoom=2.7;g.renderer.cam.lookAt(p.x,p.y,true);});
 await page.waitForTimeout(200);await page.screenshot({path:'e2e/screenshots/gritty-nonfatal-trauma.png'});
 const started=await page.evaluate(()=>window.__mosaics.sim.player.wounds[0].detached.x);await page.evaluate(()=>{const s=window.__mosaics.sim;for(let i=0;i<30;i++)s.step();});if(started===await page.evaluate(()=>window.__mosaics.sim.player.wounds[0].detached.x))throw Error('Detached limb did not move physically');
 await page.evaluate(()=>{const g=window.__mosaics;g.interior.show(g.sim.world.buildings.find(b=>b.kind==='hotel'));});await page.waitForTimeout(250);
 const resolution=await page.evaluate(()=>{const v=window.__mosaics.interior.view,l=v.staticLayer;return{dpr:v.dpr,layer:l.cv.width/l.w,sprites:[...v.sprites.values()].map(s=>s.cv.width/s.w)};});
 if(resolution.layer<1.99||resolution.sprites.some(s=>s<1.99))throw Error('Interior caches are below device resolution '+JSON.stringify(resolution));
 await page.screenshot({path:'e2e/screenshots/gritty-sharp-interior.png'});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);if(await page.locator('.iv').evaluate(e=>e.scrollWidth>e.clientWidth+2))throw Error('Interior overflows on mobile');
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS: six moving weapon mechanisms, reduced motion, visible trauma and physical limb motion, full-device-pixel interior caches, mobile and no runtime errors');
}finally{await browser.close();}
