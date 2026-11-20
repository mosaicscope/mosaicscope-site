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
  const drawCanvas=()=>{ctx.clearRect(0,0,W,H);for(const {points,color} of polys){ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.closePath();ctx.fillStyle=color;ctx.fill();}};
  const drawGPU=()=>{ctx.clearRect(0,0,W,H);gpu.begin(W,H);for(const {points,color} of polys)gpu.polygon(points,color,W,H);gpu.finish(ctx,W,H);};
  drawCanvas();const reference=ctx.getImageData(0,0,W,H).data;drawGPU();const actual=ctx.getImageData(0,0,W,H).data;let compared=0,different=0;for(let y=1;y<H-1;y+=8)for(let x=1;x<W-1;x+=8){const i=(y*W+x)*4;compared++;if(Math.abs(reference[i]-actual[i])+Math.abs(reference[i+1]-actual[i+1])+Math.abs(reference[i+2]-actual[i+2])>100)different++;}
  const measure=fn=>{const samples=[];for(let i=0;i<55;i++){const t=performance.now();fn();if(i>=10)samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);return {medianMs:samples[Math.floor(samples.length/2)],p95Ms:samples[Math.floor(samples.length*.95)]};};
  return {available:true,renderer,polygons:polys.length,largePixelDifferenceRatio:different/compared,canvas:measure(drawCanvas),gpu:measure(drawGPU)};
 });console.log(JSON.stringify(result));if(!result.available||result.polygons<10)throw Error('GPU experiment unavailable or insufficient mapped geometry');
}finally{await browser.close();await server.close();}
