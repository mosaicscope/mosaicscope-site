import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.route('**/api/**',r=>r.fulfill({json:{weather:'clear',isDay:true,temp:14,wind:10,hour:12}}));await page.goto(process.argv[2]||'http://127.0.0.1:4173/world/');await page.getByRole('button',{name:'Start new game',exact:true}).click();await page.getByRole('button',{name:'Start my story',exact:true}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();
 const result=await page.evaluate(()=>{const g=window.__mosaics,s=g.sim;g.setSpeed(0);s.spawnNpcAt(s.player.x,s.player.y,Math.max(0,650-s.chars.length));s.rebuildHash();s.lod.update(s);g.renderer.cam.zoom=g.renderer.cam.targetZoom=1;const steps=[],draw=[];for(let i=0;i<120;i++){const t=performance.now();s.step();steps.push(performance.now()-t);}for(let i=0;i<40;i++){const t=performance.now();g.renderer.render(1,1/60,{selected:-1,hovered:-1,debug:g.debug,reduceMotion:false,quality:2,showNames:false});draw.push(performance.now()-t);}const stats=a=>({mean:a.reduce((s,n)=>s+n,0)/a.length,p95:[...a].sort((a,b)=>a-b)[Math.floor(a.length*.95)]});return{population:s.chars.length,simulation:stats(steps),render:stats(draw),fullFigures:g.renderer.stats.figures,silhouettes:g.renderer.stats.silhouettes};});
 fs.mkdirSync('bench-results',{recursive:true});fs.writeFileSync(`bench-results/crowd-${process.argv[3]||'latest'}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
