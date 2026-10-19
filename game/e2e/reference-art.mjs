import { chromium } from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',r=>r.fulfill({json:{weather:'clear',isDay:true,temp:14,wind:10,hour:12}}));
await page.goto(process.argv[2]||'http://127.0.0.1:5173/world/');
await page.getByRole("button",{name:"Start new game",exact:true}).click();await page.getByRole("button",{name:"Start my story",exact:true}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();await page.waitForFunction(()=>window.__mosaics?.sim?.tick>2);
await page.evaluate(()=>{const a=window.__mosaics;a.setSpeed(0);a.sim.player.cash=20000;a.casino.show();});
fs.mkdirSync('e2e/screenshots',{recursive:true});
await page.waitForTimeout(300);await page.screenshot({path:'e2e/screenshots/reference-casino-interior.png'});
const clickScene=async(x,y)=>{const b=await page.locator('.play-scene:visible').boundingBox();await page.mouse.click(b.x+x*b.width/960,b.y+y*b.height/600);};
for(const [x,y,title]of[[546,358,'Roulette'],[355,290,'Blackjack'],[515,171,'Kiwi Gold'],[757,292,'Video poker'],[702,393,'Cashier']]){
 await clickScene(x,y);await page.getByRole('tab',{name:title,exact:true}).evaluate(e=>{if(e.getAttribute('aria-selected')!=='true')throw Error('Canvas station did not open '+e.textContent);});await page.getByRole('tab',{name:'Lobby',exact:true}).click();
}
await page.getByRole('button',{name:'Casino exterior',exact:true}).click();await page.waitForTimeout(250);await page.screenshot({path:'e2e/screenshots/reference-casino-exterior.png'});await clickScene(500,350);await page.locator('canvas[aria-label^="Interactive isometric casino"]').waitFor();
await page.getByRole('button',{name:'Leave the casino'}).click();
await page.evaluate(()=>{const a=window.__mosaics,s=a.sim.expansion;s.farm=2;s.animals={'Dairy cattle':2,'Sheep':3,'Pigs':2,'Goats':2,'Chickens':3,'Ducks':2,'Deer':1,'Alpacas':1,'Farm horses':1,'Working dogs':1,'Beehives':1};s.feed=100;s.machines=['Tractor'];a.activities.show('Farm');});await page.waitForTimeout(200);await page.screenshot({path:'e2e/screenshots/reference-farm.png'});
await page.getByRole('button',{name:'UC',exact:true}).click();await page.getByRole('button',{name:'Enrol',exact:true}).first().click();
// The cafe building hotspot applies the saved gameplay effect, not just a scene change.
const before=await page.evaluate(()=>window.__mosaics.sim.player.cash);await clickScene(480,450);if(await page.evaluate(()=>window.__mosaics.sim.player.cash)!==before-5)throw Error('Campus cafe hotspot did not charge and apply its action');await page.screenshot({path:'e2e/screenshots/reference-campus.png'});
await page.getByRole('button',{name:'Racing',exact:true}).click();await page.getByRole('button',{name:'Buy horse · $800'}).click();await page.getByRole('button',{name:'Race rivals · $40'}).click();await page.getByRole('button',{name:'Course camera',exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(200);await page.screenshot({path:'e2e/screenshots/reference-racecourse.png'});
await page.getByRole('button',{name:'Trackside camera',exact:true}).click();await page.waitForTimeout(200);await page.screenshot({path:'e2e/screenshots/reference-trackside.png'});
await page.getByRole('button',{name:'Close',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__mosaics.casino.show());if(await page.locator('.cas-frame').evaluate(e=>e.scrollWidth>e.clientWidth+2))throw Error('Casino overflows on mobile');await page.screenshot({path:'e2e/screenshots/reference-casino-mobile.png'});
if(errors.length)throw Error(errors.join('\n'));console.log('PASS: all five casino station hotspots, exterior/interior, farm species, campus action, race cameras, mobile and runtime checks');await browser.close();
