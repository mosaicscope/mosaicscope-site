import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const assert=(v,m)=>{if(!v)throw Error(m);};
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Offline fixture'}}));
 await page.goto(process.argv[2]||'http://127.0.0.1:4175/world/');
 for(const name of ['Start new game','Start my story','Skip'])await page.getByRole('button',{name,exact:true}).click();
 const result=await page.evaluate(()=>{
  const g=window.__mosaics,p=g.sim.player;g.setSpeed(0);g.moveTarget=null;g.pendingTalk=null;p.x=p.px=-3000;p.y=p.py=-3000;p.phys=0;p.inCar=-1;p.needs.energy=1;
  const run=sprint=>{g.keys.clear();g.running.reset();g.keys.add('w');if(sprint)g.keys.add('shift');let early=0;for(let i=0;i<180;i++){g.controlPlayer();if(i===15)early=Math.hypot(p.vx,p.vy);}return{early,top:Math.hypot(p.vx,p.vy)};};
  const walk=run(false),sprint=run(true);g.keys.clear();g.controlPlayer();return{walk,sprint,stopped:Math.hypot(p.vx,p.vy)};
 });
 assert(result.sprint.top>result.walk.top*1.9,'Sprint too slow');assert(result.sprint.top>result.sprint.early,'Sprint does not build');assert(result.stopped===0,'Movement stuck');
 const zone=await page.locator('.tc-zone').boundingBox();assert(zone,'Touch joystick missing');const cdp=await page.context().newCDPSession(page),x=zone.x+zone.width*.5,y=zone.y+zone.height*.5;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-65}]});await page.waitForTimeout(100);
 assert(await page.evaluate(()=>window.__mosaics.touch.sprintHeld),'Full joystick push does not sprint');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(100);assert(await page.evaluate(()=>!window.__mosaics.touch.sprintHeld),'Touch sprint stuck');
 assert(!errors.length,errors.join('\n'));console.log('PASS progressive sprint, instant stop and mobile sprint/release',JSON.stringify(result));
}finally{await browser.close();}
