import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/api/**',r=>r.fulfill({json:{weather:'clear',isDay:true,temp:14,wind:10,hour:12}}));await page.goto(process.argv[2]||'http://127.0.0.1:4173/world/');await page.getByRole('button',{name:'Start new game',exact:true}).click();await page.getByRole('button',{name:'Start my story',exact:true}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();
 await page.evaluate(()=>window.__mosaics.setSpeed(0));await page.getByRole('button',{name:'Fight / gun controls',exact:true}).click();await page.getByRole('button',{name:'Browse 500 reaction animations',exact:true}).click();
 const canvas=page.getByRole('img',{name:'Actual reaction animation catalogue: 500 distinct motion sequences'}),slider=page.getByLabel('Animation position',{exact:true});await canvas.scrollIntoViewIfNeeded();
 const seen=new Set(),visuals=new Map();fs.mkdirSync('e2e/screenshots',{recursive:true});
 for(let n=0;n<84;n++){
  const ids=await page.locator('.reaction-scores li').evaluateAll(es=>es.map(e=>e.dataset.clip));ids.forEach(id=>seen.add(id));const phases=[];
  for(const phase of[.195,.49,.815]){
   await slider.evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));},phase);await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(55);
   phases.push(await canvas.evaluate(async(c,count)=>{const scale=c.width/960,cv=document.createElement('canvas');cv.width=260;cv.height=260;const g=cv.getContext('2d'),out=[];for(let i=0;i<count;i++){g.clearRect(0,0,260,260);g.drawImage(c,(i%3*320+30)*scale,(Math.floor(i/3)*360+45)*scale,260*scale,260*scale,0,0,260,260);const hash=await crypto.subtle.digest('SHA-256',g.getImageData(0,0,260,260).data);out.push(Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join(''));}return out;},ids.length));
  }
  ids.forEach((id,i)=>visuals.set(id,phases.map(p=>p[i]).join(':')));
  if(n===0||n===54||n===83)await page.screenshot({path:`e2e/screenshots/reactions-page-${n+1}.png`});
  if(n<83)await page.getByRole('button',{name:'Next page',exact:true}).evaluate(e=>e.click());
 }
 if(seen.size!==500)throw Error('Catalogue exposes only '+seen.size+' clips');
 const unique=new Set(visuals.values());if(unique.size!==500){const duplicates=[...visuals].filter(([id,sig],i,a)=>a.some(([other,v],j)=>j<i&&v===sig));throw Error('Only '+unique.size+' distinct face/body animations; duplicates '+JSON.stringify(duplicates.map(d=>d[0])));}
 await page.getByLabel('Reaction family',{exact:true}).selectOption('headache');if(await page.locator('.reaction-count').textContent().then(t=>!t.includes('25 distinct clips')))throw Error('Family filtering failed');
 await page.getByLabel('Find reaction',{exact:true}).fill('temple');if(!await page.locator('.reaction-scores li').count())throw Error('Action search failed');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Fight / gun controls',exact:true}).click();await page.getByRole('button',{name:'Browse 500 reaction animations',exact:true}).click();await page.waitForTimeout(80);if(await page.locator('.reaction-catalogue').evaluate(e=>e.scrollWidth>e.clientWidth+2))throw Error('Mobile catalogue overflows');
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS: all 500 clips reachable and 500 distinct rendered face/body sequences (labels excluded), family/search/scrubbing and mobile');
}finally{await browser.close();}
