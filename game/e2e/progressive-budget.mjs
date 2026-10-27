import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Offline test'}}));
 await page.goto(process.argv[2]||'http://127.0.0.1:4173/world/');
 await page.getByRole('button',{name:'Start new game',exact:true}).click();await page.getByRole('button',{name:'Start my story',exact:true}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();
 await page.evaluate(()=>{window.__mosaics.reset(1);window.__mosaics.setSpeed(0);window.__mosaics.renderer.cam.zoom=window.__mosaics.renderer.cam.targetZoom=1;});
 if(process.argv.includes('--injured'))await page.evaluate(()=>{const g=window.__mosaics,s=g.sim,p=s.player,cast=[p,...s.chars.filter(c=>c.inCar<0&&c.inside<0&&c.id!==p.id).slice(0,7)];cast.forEach((c,i)=>{const q=s.world.nearestFoot(p.x+(i%4)*1.3,p.y+Math.floor(i/4)*1.3,5);c.x=c.px=q.x;c.y=c.py=q.y;c.wounds=[{part:'torso',kind:'cut',severity:3,bandaged:false,tick:s.tick,ballistics:[{angle:0,exit:true,age:0}],tissue:{exposed:.85,extension:.7,velocity:0,sway:.2,swayVelocity:0,age:0}},{part:'leg',kind:'cut',severity:3,bandaged:false,tick:s.tick}];c.blood=.65;c.bleed=.4;c.promoted=true;s.lod.markHot(c.id,s.tick,600);});s.rebuildHash();});
 const cdp=await page.context().newCDPSession(page),results=[];
 for(const rate of [1,4]){await cdp.send('Emulation.setCPUThrottlingRate',{rate});
  results.push(await page.evaluate(async rate=>{
   const g=window.__mosaics,s=g.sim;s.detailBudget=8;s.lod.update(s);g.renderer.resize(0);
   const step=[],draw=[],metrics={vehicleMs:0,cityMs:0,aiMs:0,moveMs:0,physicsMs:0,eventsMs:0},options={selected:-1,hovered:-1,debug:g.debug,reduceMotion:false,quality:0,showNames:false};
   for(let i=0;i<200;i++){const a=performance.now();s.step();const b=performance.now();g.renderer.render(1,1/60,options);const c=performance.now();if(i>=80){step.push(b-a);draw.push(c-b);for(const k in metrics)metrics[k]+=s.metrics[k]/120;}if(i%10===0)await new Promise(r=>setTimeout(r,0));}
   const stats=a=>({mean:a.reduce((s,n)=>s+n,0)/a.length,p95:[...a].sort((a,b)=>a-b)[Math.floor(a.length*.95)]});
   return{cpuThrottle:rate,cars:s.vehicles.length,people:s.chars.length,step:stats(step),draw:stats(draw),combined:stats(step.map((v,i)=>v+draw[i])),metrics,figures:g.renderer.stats.figures};
  },rate));
 }
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 if(errors.length)throw Error(errors.join('\n'));
 fs.mkdirSync('bench-results',{recursive:true});fs.writeFileSync('bench-results/frame-budget.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
