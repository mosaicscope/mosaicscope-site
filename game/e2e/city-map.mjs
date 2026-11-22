import {chromium} from 'playwright-core';
import {createServer} from 'vite';
const server=await createServer({configLoader:'runner',cacheDir:'../.vite-cache-map',logLevel:'silent',server:{host:'127.0.0.1',port:5225,strictPort:false,hmr:false}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const check=(v,m)=>{if(!v)throw Error(m);};
try{
 const page=await browser.newPage({viewport:{width:1254,height:930}}),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));await page.goto('http://127.0.0.1:'+server.config.server.port+'/world/');
 for(const name of ['Start new game','Start my story','Skip']){const b=page.getByRole('button',{name,exact:true});if(await b.isVisible())await b.click();}
 await page.waitForFunction(()=>window.__mosaics?.sim?.tick>2);
 console.log('mapped world:',await page.evaluate(()=>!!window.__mosaics.sim.world.mapped));
 await page.evaluate(()=>{const g=window.__mosaics;g.setSpeed(0);g.minimap.toggle(true);});await page.waitForTimeout(800);
 await page.screenshot({path:'e2e/screenshots/map-0.png'});
 const cv=page.locator('.bigmap canvas'),box=await cv.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-400);await page.waitForTimeout(300);
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.4,{steps:8});await page.mouse.up();await page.waitForTimeout(300);
 await page.mouse.click(box.x+box.width*.4,box.y+box.height*.5);await page.waitForTimeout(400);
 await page.screenshot({path:'e2e/screenshots/map-1.png'});
 console.log('foot:',await page.locator('.bigmap-foot').textContent());
 await page.getByRole('button',{name:'Recentre'}).click();await page.waitForTimeout(300);console.log('after recentre:',(await page.locator('.bigmap-foot').textContent()).slice(0,40));
 check(errors.length===0,errors.join(' | '));console.log('MAP_OK');
}finally{await browser.close();await server.close();}
