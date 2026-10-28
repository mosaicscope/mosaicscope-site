import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{for(const mobile of [false,true]){
 const ctx=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:800}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Offline fixture'}}));
 await page.goto(process.argv[2]||'http://127.0.0.1:4173/world/');for(const name of ['Start new game','Start my story','Skip'])await page.getByRole('button',{name,exact:true}).click();
 await page.evaluate(()=>{const g=window.__mosaics,s=g.sim,v=structuredClone(s.vehicles.find(v=>v.state==='parked'));g.setSpeed(0);s.world.mapped=undefined;s.world.tiles.fill(16);s.world.blocked.fill(0);Object.assign(v,{id:0,cls:'hatch',x:40,y:42,px:40,py:42,heading:0,state:'free',driver:s.playerId,owner:s.playerId,speed:0,vx:0,vy:0,damage:0,engineDamage:0,components:undefined,lifeMods:[],parkingBrake:false,manualTransmission:false,assistMode:'auto',powertrain:undefined,telemetry:undefined});s.vehicles=[v];for(const c of s.chars)Object.assign(c,{x:2,y:2,px:2,py:2,inCar:-1});Object.assign(s.player,{x:40,y:42,px:40,py:42,inCar:0,inside:-1,phys:0,stunUntil:0,wounds:[],blood:1});s.rebuildHash();g.setSpeed(1);});
 const car=()=>page.evaluate(()=>{const v=window.__mosaics.sim.vehicles[0];return{manual:v.manualTransmission,gear:v.powertrain?.gear,aids:v.assistMode,telemetry:!!v.telemetry};});
 await page.getByRole('button',{name:'Toggle manual transmission'}).click();if(!(await car()).manual)throw Error('Manual transmission not enabled');
 await page.getByRole('button',{name:'Shift up'}).click();if((await car()).gear!==2)throw Error('Manual upshift failed '+JSON.stringify(await car()));
 await page.waitForTimeout(300);await page.getByRole('button',{name:'Shift down'}).click();if((await car()).gear!==1)throw Error('Manual downshift failed '+JSON.stringify(await car()));
 await page.getByRole('button',{name:'Change driver aids'}).click();if((await car()).aids!=='on')throw Error('Driver aid preset failed');
 await page.getByRole('button',{name:'Toggle driving data'}).click();await page.getByText(/Trip .*peak/).waitFor();
 if(!mobile){await page.waitForTimeout(300);await page.keyboard.press(']');if((await car()).gear!==2)throw Error('Keyboard shift failed');}
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS driving controls '+(mobile?'mobile':'desktop'),JSON.stringify(await car()));await ctx.close();
}}finally{await browser.close();}
