import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/api/**',r=>r.fulfill({json:{weather:'clear',isDay:true,temp:14,wind:10,hour:12}}));
 await page.goto(process.argv[2]||'http://127.0.0.1:4173/world/');
 await page.getByRole('button',{name:'Start new game',exact:true}).click();
 const canvas=page.locator('.welcome canvas');await page.waitForTimeout(150);const original=await canvas.evaluate(c=>c.toDataURL());
 await page.getByLabel('Clothing',{exact:true}).selectOption('coat');await page.getByLabel('Legwear',{exact:true}).selectOption('jeans');await page.getByLabel('Footwear',{exact:true}).selectOption('boots');await page.getByLabel('bowtie',{exact:true}).check();await page.waitForTimeout(150);
 if(original===await canvas.evaluate(c=>c.toDataURL()))throw Error('Outfit preview did not change');
 fs.mkdirSync('e2e/screenshots',{recursive:true});await page.screenshot({path:'e2e/screenshots/depth-creator-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
 if(await page.locator('.welcome').evaluate(e=>e.scrollWidth>e.clientWidth+2))throw Error('Mobile creator overflows');
 await page.getByRole('button',{name:'Start my story',exact:true}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();
 await page.evaluate(()=>{const g=window.__mosaics;g.setSpeed(0);g.saves.save(g.sim,'quick');});
 if(!(await page.context().cookies()).some(c=>c.name==='mosaics_continue'&&c.value==='quick'))throw Error('Continue cookie missing');
 await page.setViewportSize({width:1366,height:900});
 const ids=['dog','wedding','water','magpie','quake','wallet','bus','wind','bike','market','keys','busker','cake','duck','interview','power','ring','cone','flood','tourist','piano','soup','skater','poster','parcel','protest','tram','memorial','puppet','trolley','seed','film','bee','mural','flat','choir','hail','book','referee','farewell'];
 for(const id of ids)for(let choice=0;choice<2;choice++){
  await page.evaluate(({id,choice})=>{const g=window.__mosaics;g.sim.expansion.pending=null;g.sim.expansion.seen=[id];g.sim.expansion.outcomes??={};g.sim.expansion.outcomes[id]=choice;g.activities.show('Explore');},{id,choice});await page.waitForTimeout(45);
  if(!await page.locator('.play-scene:visible').evaluate(c=>c.getContext('2d').getImageData(450,250,1,1).data[3]))throw Error(`Blank outcome ${id}/${choice}`);
 }
 await page.screenshot({path:'e2e/screenshots/depth-choice-outcome.png'});
 await page.getByRole('button',{name:'Close',exact:true}).click();
 const litter=await page.evaluate(()=>{const g=window.__mosaics,s=g.sim,p=s.player,d=s.world.pois.find(q=>q.kind==='door'&&q.building===-2);p.x=p.px=d.x;p.y=p.py=d.y;p.vx=p.vy=0;p.phys=0;p.inCar=-1;return s.litter.add('can',d.x,d.y)?.id;});
 await page.keyboard.press('e');await page.locator('.modal[role=dialog]').waitFor();
 if(!await page.locator('.modal[role=dialog]').textContent().then(t=>t.includes('Instagram')))throw Error('Studio entrance action was stolen by litter');
 if(await page.evaluate(id=>window.__mosaics.sim.litter.pieces[id].taken,litter))throw Error('Door interaction collected the can instead');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: live outfit rendering, mobile creator, cookie-selected save, all 80 resolved encounter scenes');
}finally{await browser.close();}
