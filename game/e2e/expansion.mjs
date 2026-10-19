// CHROMIUM=/path/to/chrome node e2e/expansion.mjs
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5187"],{stdio:"pipe"});
let browser;
try {
  for(let i=0;i<60;i++){try{if((await fetch("http://127.0.0.1:5187/world/")).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM||"/opt/pw-browsers/chromium",args:["--no-sandbox","--disable-dev-shm-usage"]});
  for(const mobile of [false,true]) {
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1400,height:860},isMobile:mobile,hasTouch:mobile,reducedMotion:"reduce"});
    const page=await context.newPage(), errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.addInitScript(()=>localStorage.setItem("mosaics-world:settings",JSON.stringify({tutorialDone:true,density:0,sound:false})));
    await page.goto("http://127.0.0.1:5187/world/");
await page.getByRole("button",{name:"Start new game",exact:true}).click();await page.getByRole("button",{name:"Start my story",exact:true}).click();
    if(mobile) await page.locator("header.bar").getByRole("button",{name:"Menu",exact:true}).click();
    await page.locator("header.bar").getByRole("button",{name:"UC",exact:true}).click();
    await page.getByRole("dialog",{name:"University of Canterbury · game campus"}).waitFor();
    await page.locator(".activities button.x").click();
    // Exercise real UI modules with an isolated, funded simulation.
    await page.evaluate(async()=>{
      const {Simulation}=await import("/world/src/sim/Simulation.ts");
      const {ModalHost}=await import("/world/src/ui/Modals.ts");
      const {Activities}=await import("/world/src/ui/Activities.ts");
      const sim=new Simulation({seed:7,midCount:0,backgroundCount:0});sim.player.cash=50000;
      const modal=new ModalHost();document.querySelector("#ui").append(modal.el);
      const ui=new Activities(()=>sim,modal,()=>{});window.fixture={sim,ui};ui.show("Farm");
    });
    const box=page.locator(".activities");
    await box.getByRole("button",{name:"Buy lifestyle block · $1,500",exact:true}).click();
    const card=name=>box.locator(".ax-card").filter({has:page.getByRole("heading",{name,exact:true})});
    await card("Chickens · 0").getByRole("button",{name:"Buy",exact:true}).click();
    await card("Hen house").getByRole("button",{name:"Buy",exact:true}).click();
    await box.getByRole("button",{name:"Buy 50 feed · $30",exact:true}).click();
    await box.getByRole("button",{name:"Care for stock",exact:true}).click();
    assert.equal(await page.evaluate(()=>window.fixture.sim.expansion.animals.Chickens),1);
    await box.getByRole("button",{name:"UC",exact:true}).click();
    await card("Science").getByRole("button",{name:"Enrol",exact:true}).click();
    const answers=["0°C","One variable at a time","Photosynthesis"];
    for(let i=0;i<9;i++){
      await box.getByRole("button",{name:"Study / mock test",exact:true}).click();
      await box.getByRole("button",{name:answers[i%3],exact:true}).click();
    }
    await box.getByRole("button",{name:"Graduate at Christchurch Town Hall",exact:true}).click();
    assert.equal(await page.evaluate(()=>window.fixture.sim.expansion.level),1);
    await box.getByRole("button",{name:"Racing",exact:true}).click();
    await box.getByRole("button",{name:"Buy horse · $800",exact:true}).click();
    await box.getByRole("button",{name:"Train · $25",exact:true}).click();
    assert.equal(await page.evaluate(()=>window.fixture.sim.expansion.horse.skill),23);
    assert.equal(await box.getByRole("button",{name:"Train · $25",exact:true}).isDisabled(),true);
    await box.getByRole("button",{name:"Betting",exact:true}).click();
    await card("Baccarat").getByRole("button",{name:"Player",exact:true}).click();
    for (const number of [1,2,3,4,5]) await box.locator(".ax-numbers").getByRole("button",{name:String(number),exact:true}).click();
    assert.ok(await box.evaluate(el=>el.scrollTop)>0,"number picks preserve scroll position");
    await box.getByRole("button",{name:"Draw balls",exact:true}).click();
    await box.getByRole("button",{name:"Bet and race",exact:true}).click();
    await box.locator(".ax-race").waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"page overflow");
    assert.equal(await box.evaluate(el=>el.scrollWidth>el.clientWidth+2),false,"panel overflow");
    await page.screenshot({path:`${process.env.E2E_OUT || "/tmp"}/expansion-${mobile?"mobile":"desktop"}.png`});
    assert.deepEqual(errors,[]);
    console.log(`${mobile?"mobile":"desktop"}: farm purchase, animal production setup, nine courses, graduation, horse training/cooldown, baccarat, race and layout passed`);
    await context.close();
  }
} finally { await browser?.close();server.kill(); }
