import { chromium } from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1254,height:930}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',r=>r.fulfill({json:{weather:'clear',isDay:true,temp:14,wind:10,hour:12}}));
await page.goto(process.argv[2]||'http://127.0.0.1:5173/world/');await page.getByRole('button',{name:'Skip',exact:true}).click();await page.waitForFunction(()=>window.__mosaics?.sim?.tick>2);
await page.evaluate(()=>{const a=window.__mosaics;a.setSpeed(0);a.sim.player.cash=20000;a.activities.show('Betting');});
await page.getByRole('button',{name:'Buy scratchcard',exact:true}).click();
const cv=page.locator('.play-scene'),box=await cv.boundingBox();
for(let i=0;i<3;i++){await page.mouse.move(box.x+(154+i*230)*box.width/960,box.y+182*box.height/480);await page.mouse.down();for(let row=0;row<7;row++){const y=box.y+(186+row*23)*box.height/480;await page.mouse.move(box.x+(150+i*230)*box.width/960,y);await page.mouse.move(box.x+(330+i*230)*box.width/960,y,{steps:12});}await page.mouse.up();}
if(!await page.evaluate(()=>window.__mosaics.sim.expansion.casino.scratch.paid))throw Error('Dragging failed to reveal scratchcard');
fs.mkdirSync('e2e/screenshots',{recursive:true});await page.screenshot({path:'e2e/screenshots/scratch-revealed.png'});
for(const [game,button]of [['Baccarat','Player'],['Craps','Come-out roll'],['Big wheel','Spin'],['Crash','Launch']]){await page.getByRole('button',{name:game,exact:true}).click();await page.getByRole('button',{name:button,exact:true}).click();await page.waitForTimeout(100);}
await page.getByRole('button',{name:'Tournament',exact:true}).click();await page.getByRole('button',{name:'Enter tournament · $25',exact:true}).click();await page.getByRole('button',{name:'Deal tournament hand',exact:true}).click();
await page.evaluate(()=>{const a=window.__mosaics;a.sim.expansion.farm=1;a.sim.expansion.animals={'Sheep':4,'Dairy cattle':2,'Chickens':3};a.activities.show('Farm');});await page.waitForTimeout(300);await page.screenshot({path:'e2e/screenshots/farm-graphical.png'});
await page.getByRole('button',{name:'Racing',exact:true}).click();await page.getByRole('button',{name:'Buy horse · $800'}).click();await page.getByRole('button',{name:'Train · $25'}).click();if(!await page.evaluate(()=>window.__mosaics.sim.expansion.horse.skill===23))throw Error('Horse training failed');
await page.getByRole('button',{name:'UC',exact:true}).click();await page.getByRole('button',{name:'Enrol',exact:true}).first().click();await page.getByRole('button',{name:'Study / mock test'}).click();await page.screenshot({path:'e2e/screenshots/campus-graphical.png'});
await page.getByRole('button',{name:'Close',exact:true}).click();
await page.evaluate(()=>{const a=window.__mosaics;a.sim.env.startHour=12;const b=a.sim.world.buildings.find(b=>b.kind==='cafe');a.interior.show(b);});
await page.evaluate(()=>{const a=window.__mosaics,p=a.sim.player;p.wounds=[{part:'head',kind:'cut',severity:2,bandaged:false,tick:a.sim.tick}];p.bleed=.3;const toy=a.sim.toys.find(t=>t.def==='bandage');if(!toy)throw Error('Bandage fixture missing');toy.holder=p.id;toy.state='held';p.bag.push(toy.id);});await page.waitForFunction(()=>document.querySelector('.iv-want')?.textContent.includes('Bleeding'));await page.keyboard.press('b');if(!await page.evaluate(()=>window.__mosaics.sim.player.wounds[0].bandaged))throw Error('Interior bandage failed');await page.locator('.iv-action-list button').filter({hasText:'Window couch'}).click();await page.waitForFunction(()=>window.__mosaics.interior.actionUntil>0,{},{timeout:20000});await page.screenshot({path:'e2e/screenshots/interior-actions.png'});
await page.evaluate(()=>window.__mosaics.interior.close());await page.evaluate(()=>{const a=window.__mosaics,v=a.sim.vehicles[0];v.owner=a.sim.playerId;v.damage=.5;v.glassDamage=.8;v.flatLeft=true;a.lifePhone.show('Garage');});await page.waitForTimeout(500);await page.screenshot({path:'e2e/screenshots/garage-graphical.png'});await page.getByRole('button',{name:'Close',exact:true}).click();
await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__mosaics.activities.show('Betting'));await page.getByRole('button',{name:'Scratchies',exact:true}).click();
if(await page.locator('.activities').evaluate(e=>e.scrollWidth>e.clientWidth+2))throw Error('Mobile activity overflow');await page.screenshot({path:'e2e/screenshots/scratch-mobile.png'});
if(errors.length)throw Error(errors.join('\n'));console.log('PASS: scratch drag, casino tables, tournament, farm, horse, campus, interior actions, mobile, no runtime errors');await browser.close();
