// Standalone: node e2e/driving.mjs (or supply an existing Vite URL).
import { chromium } from "playwright-core";
import { createServer } from "vite";
import fs from "node:fs";
const server=process.argv[2]?null:await createServer({server:{host:"127.0.0.1",port:5182,strictPort:true,hmr:false}});
await server?.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage({viewport:{width:1280,height:800}}), errors=[];
  page.on("pageerror",e=>{errors.push(e.message);console.error("Browser error:",e.message);});
  await page.route("**/api/**",r=>r.fulfill({json:{weather:"clear",isDay:true,temp:14,wind:10,hour:12,posts:[]}}));
  await page.goto(process.argv[2] || "http://127.0.0.1:5182/world/");
  await page.getByRole("button",{name:"Start new game",exact:true}).click();
  await page.getByRole("button",{name:"Start my story",exact:true}).click();
  await page.getByRole("button",{name:"Skip",exact:true}).click();
  await page.waitForFunction(()=>window.__mosaics?.sim?.tick>2);
  const result = await page.evaluate(async()=>{
    const {makeVehicle,seat,updateVehicles,playerInput}=await import("/world/src/sim/Traffic.ts");
    const {components}=await import("/world/src/sim/VehicleDamage.ts");
    const g=window.__mosaics,s=g.sim;g.setSpeed(0);s.vehicles.length=0;s.world.tiles.fill(16);s.world.blocked.fill(0);s.env.rain=0;
    for(const c of s.chars){c.x=c.px=2;c.y=c.py=2;}s.rebuildHash();
    const v=makeVehicle(s,"muscle",30,42,0,"parked");seat(s,s.player,v);v.state="free";v.speed=9;v.vx=9;v.vy=0;v.dynT=s.tick;v.tyreHeat=1;
    const fx={smoke:0,skid:0};s.bus.on("fx",f=>{if(f.kind==="tyre_smoke")fx.smoke++;if(f.kind==="skid")fx.skid++;});
    Object.assign(playerInput,{throttle:0,steer:1,brake:true});
    let maxSlip=0;
    for(let i=0;i<24;i++){s.tick++;updateVehicles(s,1/60);maxSlip=Math.max(maxSlip,Math.abs(v.slip??0));}
    Object.assign(playerInput,{throttle:0,steer:0,brake:false});
    // Render a damaged suspension with the same physical steering and tyre state.
    components(v).wheels[0].suspension=.6;
    g.renderer.cam.follow=-1;g.renderer.cam.worldSize=s.world.size;g.renderer.cam.lookAt(v.x,v.y,true);g.renderer.cam.zoom=g.renderer.cam.targetZoom=5;
    return {...fx,maxSlip,speed:v.speed,roll:v.bodyRoll,pitch:v.bodyPitch};
  });
  if(result.smoke===0||result.skid===0||result.maxSlip<.5)throw new Error("Missing drift feedback: "+JSON.stringify(result));
  await page.waitForTimeout(600);
  await page.getByRole("button",{name:"Change driving mode",exact:true}).click();
  const mode=await page.evaluate(()=>window.__mosaics.sim.vehicles[0].driveMode);
  if(mode!=="sport")throw new Error("Dashboard did not switch the physical drive mode");
  fs.mkdirSync("e2e/screenshots",{recursive:true});
  await page.screenshot({path:"e2e/screenshots/driving-drift.png"});
  if(errors.length)throw new Error(errors.join("\n"));
  console.log("Driving browser check passed:",JSON.stringify(result));
} finally {await browser.close();await server?.close();}
