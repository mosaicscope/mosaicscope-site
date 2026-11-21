// Real-browser check of the worldwide live camera wall: node e2e/live-cameras.mjs [url]
import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
const check=(v,m)=>{if(!v)throw Error(m);},button=name=>page.getByRole('button',{name,exact:true});
page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('e2e/screenshots',{recursive:true});
const loaded=()=>page.evaluate(()=>[...document.querySelectorAll('.lc-tile img')].filter(i=>i.complete&&i.naturalWidth>0).length);
try{
 await page.goto(process.argv[2]??'http://localhost:5173/world/');for(const n of['Start new game','Start my story','Skip']){const b=button(n);if(await b.count())await b.click();}
 await page.waitForFunction(()=>window.__mosaics?.sim);
 await button('Live cameras').click();await page.waitForSelector('.lc-tile');
 const report={};
 for(const [name,provider] of [['Christchurch','nzta'],['London','tfl'],['Singapore','sgp'],['Helsinki','fi'],['Vancouver','bc'],['Los Angeles','caltrans'],['San Francisco','caltrans']]){
  await page.locator('.lc-tools input').first().fill(name);await button(name).click();
  await page.waitForFunction(()=>document.querySelector('.lc-note')?.textContent.includes('camera'),null,{timeout:20000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.lc-tile img')].some(i=>i.complete&&i.naturalWidth>0),null,{timeout:25000}).catch(()=>{});
  await page.waitForTimeout(1500);
  const n=await loaded(),total=await page.locator('.lc-tile').count(),foot=await page.locator('.lc-foot').innerText();
  report[name]={provider,tiles:total,loaded:n};check(n>0,name+': no camera picture loaded');check(/licen|©|Powered|Source|Caltrans|courtesy/i.test(foot),name+': no attribution');
  await page.screenshot({path:'e2e/screenshots/live-cameras-'+provider+'-'+name.replace(/ /g,'-')+'.png'});
 }
 // Full-size viewer, keyboard next, close.
 await page.locator('.lc-thumb').first().click();await page.waitForSelector('.lc-big');
 await page.waitForFunction(()=>{const i=document.querySelector('.lc-big');return i?.complete&&i.naturalWidth>0;},null,{timeout:20000});
 await page.screenshot({path:'e2e/screenshots/live-cameras-viewer.png'});
 const before=await page.locator('.lc-stage h3').innerText();await page.keyboard.press('ArrowRight');await page.waitForTimeout(300);check(await page.locator('.lc-stage h3').innerText()!==before,'ArrowRight did not move to the next camera');
 await page.keyboard.press('Escape');check(await page.locator('.lc-stage').isHidden(),'Escape did not close viewer');
 // Camera filter and offline state.
 await page.locator('.lc-tools input').nth(1).fill('zzzz-no-such-road');check((await page.locator('.lc-note').innerText()).includes('No cameras match'),'filter message');await page.locator('.lc-tools input').nth(1).fill('');
 await page.route('**/*trafficnz.info/**',r=>r.abort());await page.locator('.lc-tools input').first().fill('Auckland');await button('Auckland').click();await page.waitForTimeout(2500);
 check(await page.locator('.lc-tile.off').count()>0,'offline state not shown when images are blocked');await page.screenshot({path:'e2e/screenshots/live-cameras-offline.png'});
 // Mobile layout.
 for(const [w,hh] of [[390,844],[844,390]]){await page.setViewportSize({width:w,height:hh});await page.waitForTimeout(200);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow '+w);await page.screenshot({path:'e2e/screenshots/live-cameras-'+w+'.png'});}
 await page.keyboard.press('Escape');check(await page.locator('.lc-wrap').count()===0,'Escape did not close the wall');
 check(!errors.length,errors.join(' | '));console.log('PASS',JSON.stringify(report));
}catch(e){console.error('FAIL',e.message);await page.screenshot({path:'e2e/screenshots/live-cameras-fail.png'}).catch(()=>{});process.exitCode=1;}
await browser.close();
