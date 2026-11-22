import {chromium} from 'playwright-core';
import {createServer} from 'vite';
const server=await createServer({configLoader:'runner',cacheDir:'../.vite-cache-casino',logLevel:'silent',server:{host:'127.0.0.1',port:5223,strictPort:false,hmr:false}});await server.listen();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1254,height:930}}),errors=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));await page.goto('http://127.0.0.1:'+server.config.server.port+'/world/');
 for(const name of ['Start new game','Start my story','Skip']){const b=page.getByRole('button',{name,exact:true});if(await b.isVisible())await b.click();}
 await page.waitForFunction(()=>window.__mosaics?.sim?.tick>2);await page.evaluate(()=>{const g=window.__mosaics;g.setSpeed(0);g.casino.show();});
 await page.waitForFunction(()=>window.__lobby,null,{timeout:60000});await page.waitForTimeout(1500);
 const r=await page.evaluate(()=>{const l=window.__lobby,seq=[];for(const id of ['blackjack','roulette','pokies','arcade','flight','cashier']){l.activate(id);const a=l.armed&&l.armed.station;l.activate(id);seq.push([id,a,window.__mosaics.casino.tab]);if(window.__mosaics.casino.tab==='floor')continue;window.__mosaics.casino.go('floor');}return seq;});
 console.log(JSON.stringify(r));
 // clicking a Mosaic: pick one agent and click its screen position
 const hit=await page.evaluate(()=>{const l=window.__lobby;l.controls.update();const a=l.agents.find(x=>x.fig.role==='dealer'),p=a.fig.root.position.clone();p.y=1.2;p.project(l.camera);const r=l.renderer.domElement.getBoundingClientRect();return{x:r.left+(p.x*.5+.5)*r.width,y:r.top+(-p.y*.5+.5)*r.height,st:a.station};});
 console.log('dealer at',JSON.stringify(hit));
 await page.mouse.click(hit.x,hit.y);await page.waitForTimeout(300);console.log('armed after first click:',await page.evaluate(()=>window.__lobby.armed&&window.__lobby.armed.station));
 await page.mouse.click(hit.x,hit.y);await page.waitForTimeout(500);console.log('tab after second click:',await page.evaluate(()=>window.__mosaics.casino.tab));
 console.log('errors',errors.length?errors:'none');
}finally{await browser.close();await server.close();}
