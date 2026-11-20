import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const assert=(v,m)=>{if(!v)throw Error(m);};
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Offline fixture'}}));await page.goto(process.argv[2]||'http://127.0.0.1:4175/world/');
 for(const name of ['Start new game','Start my story','Skip'])await page.getByRole('button',{name,exact:true}).click();
 await page.evaluate(()=>{const g=window.__mosaics,s=g.sim;g.setSpeed(0);g.keys.clear();g.moveTarget=null;s.world.tiles.fill(16);s.world.blocked.fill(0);s.env.rain=0;const v=s.vehicles[0];s.vehicles=[v];v.id=0;v.cls='super';v.state='free';v.driver=s.playerId;v.x=v.px=40;v.y=v.py=42;v.heading=0;v.speed=0;v.vx=v.vy=0;v.damage=0;v.engineDamage=0;v.parkingBrake=false;v.components=undefined;v.driveMode='road';v.lifeMods=[];s.chars.forEach(c=>{c.inCar=-1;c.x=c.px=2;c.y=c.py=2;});s.player.inCar=0;s.rebuildHash();g.touch.update();});
 const center=async name=>{const b=await page.getByRole('button',{name,exact:true}).boundingBox();assert(b&&b.width>=44&&b.height>=44&&b.x>=0&&b.y>=0&&b.x+b.width<=390&&b.y+b.height<=844,name+' touch target missing');return{x:b.x+b.width/2,y:b.y+b.height/2};};
 const gas=await center('Gas'),brake=await center('Brake'),hand=await center('Handbrake'),cdp=await page.context().newCDPSession(page);
 const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
 const step=seconds=>page.evaluate(seconds=>{const g=window.__mosaics,s=g.sim;for(let i=0;i<seconds*60;i++){const v=s.vehicles[0];v.x=v.px=40;v.y=v.py=42;g.touch.update();g.controlPlayer();s.step();}return s.vehicles[0].speed;},seconds);
 await touch('touchStart',[{...gas,id:1}]);const moving=await step(1);assert(moving>2,'Gas failed to accelerate');
 await touch('touchStart',[{...gas,id:1},{...brake,id:2}]);const stopped=await step(3);assert(Math.abs(stopped)<.04,'Brake failed to override gas and stop');assert(await page.evaluate(()=>!window.__mosaics.touchHandbrake),'Normal brake activated handbrake');
 await touch('touchEnd',[]);await touch('touchStart',[{...hand,id:3}]);assert(await page.evaluate(()=>window.__mosaics.touchHandbrake),'Handbrake did not engage');
 await touch('touchCancel',[]);assert(await page.evaluate(()=>!window.__mosaics.touchHandbrake&&!window.__mosaics.touchBrake),'Brake stuck after touch cancellation');
 await touch('touchStart',[{...hand,id:4}]);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert(await page.evaluate(()=>!window.__mosaics.touchHandbrake&&!window.__mosaics.touchBrake),'Brake stuck on focus loss');await touch('touchEnd',[]);
 assert(!errors.length,errors.join('\n'));console.log('PASS mobile gas, service brake priority, separate handbrake, cancellation and focus reset',JSON.stringify({moving,stopped}));
}finally{await browser.close();}
