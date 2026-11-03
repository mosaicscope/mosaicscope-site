import {chromium} from 'playwright-core';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:5186,strictPort:true,hmr:false}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:960,height:640}});await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'offline fixture'}}));await page.goto('http://127.0.0.1:5186/world/');
 for(const name of ['Start new game','Start my story','Skip']){const b=page.getByRole('button',{name,exact:true});if(await b.isVisible())await b.click();}
 await page.waitForFunction(()=>window.__mosaics?.sim?.world?.mapped);
 const result=await page.evaluate(async()=>{
  const {PerspectiveGroundGPU}=await import('/world/src/render/PerspectiveGroundGPU.ts'),w=window.__mosaics.sim.world,p=window.__mosaics.sim.player,W=960,H=640;
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d',{willReadFrequently:true}),gpu=new PerspectiveGroundGPU(true);if(!ctx||!gpu.available)return {available:false};
  const renderer=gpu.gl.getParameter(gpu.gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL??gpu.gl.RENDERER);
  const project=(x,y)=>({x:W/2+(x-p.x)*1.6,y:H/2+(y-p.y)*1.6}),polys=[];
  for(const b of w.buildings){const points=[project(b.x0,b.y0),project(b.x1+1,b.y0),project(b.x1+1,b.y1+1),project(b.x0,b.y1+1)];if(points[2].x<0||points[0].x>W||points[2].y<0||points[0].y>H)continue;polys.push({points,color:b.color});if(polys.length===1400)break;}
  for(const r of w.mapped.streetSegments){const a=project(r.x,r.y),b=project(r.x+r.dx*r.length,r.y+r.dy*r.length),offset=r.half*1.6;polys.push({points:[{x:a.x-r.dy*offset,y:a.y+r.dx*offset},{x:b.x-r.dy*offset,y:b.y+r.dx*offset},{x:b.x+r.dy*offset,y:b.y-r.dx*offset},{x:a.x+r.dy*offset,y:a.y-r.dx*offset}],color:'#1b1918'});if(polys.length===2400)break;}
  // Verify both material shaders draw opaque textured pixels with depth-aware coordinates.
  const verify=document.createElement('canvas');verify.width=160;verify.height=100;const vg=verify.getContext('2d',{willReadFrequently:true});gpu.begin(160,100);gpu.polygon([{x:0,y:0,depth:1,u:0,v:0},{x:80,y:0,depth:2,u:1,v:0},{x:80,y:100,depth:2,u:1,v:1},{x:0,y:100,depth:1,u:0,v:1}],'#1b1918',160,100,1);gpu.polygon([{x:80,y:0,depth:1,u:0,v:0},{x:160,y:0,depth:1,u:1,v:0},{x:160,y:100,depth:1,u:1,v:1},{x:80,y:100,depth:1,u:0,v:1}],'#4a4238',160,100,2);gpu.polygon([{x:130,y:0,depth:1,u:0,v:0},{x:160,y:0,depth:1,u:1,v:0},{x:160,y:100,depth:1,u:1,v:1},{x:130,y:100,depth:1,u:0,v:1}],'#1f3d1c',160,100,3);gpu.finish(vg,160,100);const test=vg.getImageData(0,0,160,100).data;for(const x of [20,100,145])if(test[(50*160+x)*4+3]!==255)throw Error('GPU material did not render an opaque surface');const colors=new Set();for(let y=10;y<90;y+=2)for(let x=135;x<155;x+=2){const i=(y*160+x)*4;colors.add(test[i]+','+test[i+1]+','+test[i+2]);}if(colors.size<4)throw Error('GPU grass texture missing');
  const drawCanvas=()=>{ctx.clearRect(0,0,W,H);for(const {points,color} of polys){ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.closePath();ctx.fillStyle=color;ctx.fill();}};
  const drawGPU=()=>{ctx.clearRect(0,0,W,H);gpu.begin(W,H);for(const {points,color} of polys)gpu.polygon(points,color,W,H);gpu.finish(ctx,W,H);};
  drawCanvas();const reference=ctx.getImageData(0,0,W,H).data;drawGPU();const actual=ctx.getImageData(0,0,W,H).data;let compared=0,different=0;for(let y=1;y<H-1;y+=8)for(let x=1;x<W-1;x+=8){const i=(y*W+x)*4;compared++;if(Math.abs(reference[i]-actual[i])+Math.abs(reference[i+1]-actual[i+1])+Math.abs(reference[i+2]-actual[i+2])>100)different++;}
  const measure=fn=>{const samples=[];for(let i=0;i<55;i++){const t=performance.now();fn();if(i>=10)samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);return {medianMs:samples[Math.floor(samples.length/2)],p95Ms:samples[Math.floor(samples.length*.95)]};};
  return {available:true,renderer,polygons:polys.length,largePixelDifferenceRatio:different/compared,canvas:measure(drawCanvas),gpu:measure(drawGPU)};
 });console.log(JSON.stringify(result));if(!result.available||result.polygons<10)throw Error('GPU experiment unavailable or insufficient mapped geometry');
}finally{await browser.close();await server.close();}
