import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(v,m)=>{if(!v)throw Error(m);},button=name=>page.getByRole('button',{name,exact:true});
fs.mkdirSync('e2e/screenshots',{recursive:true});
try{
 await page.route('**/api/weather*',r=>r.fulfill({json:{weather:'clear',isDay:true,temp:14,wind:10,hour:12}}));
 await page.goto(process.argv[2]??'http://127.0.0.1:5199/world/');
 for(const name of['Start new game','Start my story','Skip'])await button(name).click();
 const ids=await page.evaluate(()=>{const g=window.__mosaics,s=g.sim,c=s.player,v=s.vehicles.find(v=>v.state==='parked'&&!v.forSale),p=s.cityPlay.props.find(p=>p.kind==='crate');g.setSpeed(0);c.x=c.px=v.x+.7;c.y=c.py=v.y;c.inCar=-1;c.inside=-1;c.phys=0;c.cash=5000;v.damage=.8;v.dmgF=.8;v.engineDamage=.7;v.leak=.3;v.speed=0;v.components={panels:[.8,.4,.3,.2],glass:[.8,.3,.4,.2],wheels:Array.from({length:4},(_,i)=>({puncture:i===0,missing:i===0,rim:.2,alignment:.2,suspension:.2})),lamps:[.9,0,1,0],mirrors:[.9,0],hood:0,hoodLoose:true,hoodGone:true,bumper:0,bumpers:[0,.4],bumperLoose:true,lastImpact:s.tick,debris:[{kind:'wheel',x:c.x,y:c.y,z:.02,vx:0,vy:0,vz:0,age:3,spin:0}]};p.x=c.x+.2;p.y=c.y+.2;p.health=.3;p.turn=2;p.vx=1;g.renderer.cam.lookAt(c.x,c.y,true);return{vehicle:v.id,prop:p.id};});
 await button('Menu').click();await button('Vehicle & street workshop').click();
 const dialog=page.getByRole('dialog',{name:'Vehicle & street workshop'});await dialog.waitFor();
 await page.getByLabel('Workshop vehicle',{exact:true}).selectOption(String(ids.vehicle));
 await page.getByLabel('Workshop street object',{exact:true}).selectOption(String(ids.prop));
 await page.getByLabel('Workshop paint colour',{exact:true}).fill('#bb8866');
 const groups={Inspection:['inspect','recoverWheel'],Repairs:['lamps','tyre','alignment','windscreen','glass','bonnet','bumper','panels','engine','wash','repaint'],Controls:['headlights','hazards','parkbrake','horn'],'Street furniture':['repairProp','uprightProp','paintProp']};
 for(const [group,actions]of Object.entries(groups)){await page.getByLabel('Workshop tools',{exact:true}).selectOption(group);for(const id of actions){await page.locator('[data-workshop-action="'+id+'"]').click();check(!(await dialog.getByRole('status').textContent()).match(/Walk closer|already in good|need \$|first\.|Stop the/),'Workshop action failed: '+id);}}
 check(await page.evaluate(({vehicle,prop})=>{const s=window.__mosaics.sim,v=s.vehicles[vehicle],p=s.cityPlay.props.find(p=>p.id===prop);return s.player.cash===4299&&v.components.lamps.every(n=>n===0)&&v.components.glass.every(n=>n===0)&&!v.components.wheels[0].missing&&v.components.wheels.every(w=>w.alignment===0)&&v.components.hood===1&&v.components.bumper===1&&v.engineDamage===0&&v.color==='#bb8866'&&v.cleaned&&v.parkingBrake&&v.hazards&&p.health===1&&p.turn===0&&p.colour==='#bb8866'&&s.cityPlay.workshop.spares===0;},ids),'Visible workshop actions did not update actual vehicle/prop state or cash');
 await page.getByLabel('Workshop tools',{exact:true}).selectOption('Repairs');await page.locator('[data-workshop-action="lamps"]').click();check((await dialog.getByRole('status').textContent()).includes('No charge'),'Healthy repair charged twice');
 await dialog.getByRole('button',{name:'Close',exact:true}).click();
 const cooler=await page.evaluate(({vehicle})=>{const s=window.__mosaics.sim,v=s.vehicles[vehicle],p=v.components;s.player.cash=5000;p.panels=[.8,.8,.8,.8];v.dmgF=v.dmgR=v.dmgL=v.dmgS=.8;p.lamps=[.8,.8,.8,.8];p.mirrors=[.8,.8];p.bumpers=[.2,.2];p.bumper=.2;p.glass=[.8,.8,.8,.8];p.wheels[0].puncture=true;const w=s.cityPlay.props.find(p=>p.kind==='water_cooler');w.x=s.player.x+.3;w.y=s.player.y;w.stock=0;return w.id;},ids);
 await button('Menu').click();await button('Vehicle & street workshop').click();await dialog.waitFor();await page.getByLabel('Workshop vehicle',{exact:true}).selectOption(String(ids.vehicle));await page.getByLabel('Workshop street object',{exact:true}).selectOption(String(ids.prop));
 const precision={
  'Precision repairs':['mirrors','punctures','panelFront','panelRear','panelLeft','panelRight','bumperFront','bumperRear','lampsFront','lampsRear','glassLeft','glassRight','glassRear'],
  Controls:['signalLeft','signalRight','signalOff'],
  'Street furniture':['inspectProp','secureProp','releaseProp','restockProp'],
 };
 for(const[group,actions]of Object.entries(precision)){await page.getByLabel('Workshop tools',{exact:true}).selectOption(group);for(const id of actions){if(id==='restockProp')await page.getByLabel('Workshop street object',{exact:true}).selectOption(String(cooler));await page.locator('[data-workshop-action="'+id+'"]').click();check(!(await dialog.getByRole('status').textContent()).match(/already in good|no consumable|first\.|Stop the/),'Precision action failed: '+id);}}
 check(await page.evaluate(({vehicle,cooler})=>{const s=window.__mosaics.sim,v=s.vehicles[vehicle],p=v.components;return s.player.cash===4624&&p.panels.every(n=>!n)&&p.lamps.every(n=>!n)&&p.mirrors.every(n=>!n)&&p.bumpers.every(n=>n===1)&&p.glass[0]===.8&&p.glass.slice(1).every(n=>!n)&&!v.indicator&&!v.hazards&&s.cityPlay.props.find(p=>p.id===cooler).stock===20;},{...ids,cooler}),'The extra 20 precision tools did not apply their individual changes');
 for(const[width,height]of[[1600,1000],[390,844],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(100);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Workshop viewport overflow at '+width);await page.screenshot({path:'e2e/screenshots/workshop-'+width+'.png'});}
 await dialog.getByRole('button',{name:'Close',exact:true}).click();check(await dialog.count()===0,'Workshop did not close');check(!errors.length,errors.join(' | '));
 console.log('PASS all 40 workshop functions through visible controls, actual independent part repairs, recovered spare, real prop changes/anchors/stock, exact cash accounting, no repeat healthy charge, desktop/mobile/landscape fit, no runtime errors');
}finally{await browser.close();}
