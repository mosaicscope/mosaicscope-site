import {chromium} from 'playwright-core';
import {createServer} from 'vite';
const server=await createServer({configLoader:'runner',cacheDir:'../.vite-cache-casino',logLevel:'silent',server:{host:'127.0.0.1',port:5209,strictPort:false,hmr:false}});await server.listen();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const check=(v,m)=>{if(!v)throw Error(m);};
try{
 const page=await browser.newPage({viewport:{width:1254,height:930}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/503|402/.test(m.text()))errors.push('console: '+m.text());});await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));await page.goto('http://127.0.0.1:'+server.config.server.port+'/world/');
 for(const name of ['Start new game','Start my story','Skip']){const b=page.getByRole('button',{name,exact:true});if(await b.isVisible())await b.click();}
 await page.waitForFunction(()=>window.__mosaics?.sim?.tick>2);await page.evaluate(()=>{const g=window.__mosaics;g.setSpeed(0);g.sim.player.cash=5000;g.casino.show();g.casino.chips=5000;});
 await page.getByRole('tab',{name:'Physics arcade',exact:true}).click();await page.waitForSelector('.ar-primary:not([disabled])',{timeout:90000});await page.waitForTimeout(1500);
 const chips=()=>page.evaluate(()=>window.__mosaics.casino.chips);
 // drive the physics directly: software rendering is far slower than real time
 const run=(n)=>page.evaluate(async(n)=>{const a=window.__mosaics.casino.arcade,g=a.game;let i=0;while(g.busy()&&i<n){g.update(1/60,1/60,i/60);i++;}return{steps:i,busy:g.busy(),say:a.ui.say.textContent};},n);
 const results=[];
 for(const [tab,shot] of [['Plinko','plinko'],['Pachinko','pachinko'],['Dice','dice'],['Coin flip','coin']]){
  await page.locator('.ar-tab',{hasText:tab}).click();await page.waitForSelector('.ar-primary:not([disabled])',{timeout:90000});
  const before=await chips();await page.locator('.ar-bet',{hasText:'$100'}).click();await page.locator('.ar-primary').click();
  check(await chips()===before-100,tab+' stake not spent');
  await page.screenshot({path:'e2e/screenshots/arcade-'+shot+'-a.png'});
  const r=await run(20000);check(!r.busy,tab+' never settled ('+r.steps+' steps)');
  const after=await chips();results.push(tab+': '+before+' -> '+after+' in '+r.steps+' steps | '+r.say);
  await page.waitForTimeout(600);await page.screenshot({path:'e2e/screenshots/arcade-'+shot+'-b.png'});
 }
 console.log(results.join('\n'));
 check(errors.length===0,errors.join(' | '));console.log('ARCADE_OK');
}finally{await browser.close();await server.close();}
