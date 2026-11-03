import {chromium} from 'playwright-core';
import {createServer} from 'vite';
const server=await createServer({configLoader:'runner',cacheDir:'../.vite-cache-two-camera',server:{host:'127.0.0.1',port:5193,strictPort:true,hmr:false}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const page=await browser.newPage({viewport:{width:1254,height:930}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Offline test'}}));await page.goto('http://127.0.0.1:5193/world/');
for(const name of ['Start new game','Start my story','Skip']){const b=page.getByRole('button',{name,exact:true});if(await b.isVisible())await b.click();}await page.waitForFunction(()=>window.__mosaics?.sim?.tick>2);const btn=page.getByRole('button',{name:'Toggle driving camera'});
for(const [label,active] of [['Camera: third person',true],['Camera: city view',false],['Camera: third person',true],['Camera: city view',false]]){await btn.click();if(await btn.textContent()!==label||await page.evaluate(()=>window.__mosaics.renderer.drivingViewEnabled)!==active)throw Error('Camera cycle mismatch');}
await page.keyboard.press('v');if(!(await page.evaluate(()=>window.__mosaics.renderer.drivingViewEnabled)))throw Error('Keyboard camera toggle failed');await page.keyboard.press('v');if(await page.evaluate(()=>window.__mosaics.renderer.drivingViewEnabled))throw Error('Keyboard toggle failed to return');
if(await page.locator('#world + canvas[aria-hidden=true]').count())throw Error('Experimental canvas still present');if(errors.length)throw Error(errors.join('\n'));console.log('PASS: city / third-person button and keyboard camera toggle');
}finally{await browser.close();await server.close();}

