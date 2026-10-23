// Run against Vite dev: node e2e/facade-damage.mjs [url]. Exercises real canvas/glow compositing.
import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:680}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(process.argv[2]||'http://127.0.0.1:5193/world/e2e/building-life.html');
  const result=await page.evaluate(async()=>{
    const [{World},{drawBuildingTile,GLOW},{drawFacadeDamage},{facadeResponse},{MappedFacadeDamage},{drawMappedFacadeDamage}]=await Promise.all([
      import('../src/world/World.ts'),import('../src/render/Buildings.ts'),import('../src/render/CivicArt.ts'),import('../src/sim/FacadeImpact.ts'),import('../src/sim/MappedFacadeDamage.ts'),import('../src/render/MappedFacadeArt.ts')]);
    // Freeze the unrelated gallery's RAF and use an independent canvas.
    window.drawLife=()=>{};const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=680;document.body.replaceChildren(canvas);const g=canvas.getContext('2d'),materials=['glass','timber','brick','metal','concrete','stone'];
    const world=new World(8),b={id:0,kind:'office',name:'',x0:3,y0:3,x1:3,y1:3,floors:2,height:2.7,color:'#9ca99c',roof:'#687369',sign:'#d5bd8e',door:{x:3,y:4,face:'s'},area:0,billboard:false};world.buildings=[b];world.buildingOf.fill(-1);world.buildingOf[3*8+3]=0;
    g.fillStyle='#24313a';g.fillRect(0,0,1440,680);
    let masked=0,visible=0;
    for(let row=0;row<2;row++)for(const [i,material]of materials.entries()){
      g.save();g.translate(i*240,row*340);const response=facadeResponse(material,8,1.3);
      b.facadeMaterial=material;const d={key:'b:0:3:3',kind:'building',building:0,tx:3,ty:3,x:3.5,y:4.5,face:'s',impactU:.55,material,severity:response.severity,at:0,repairBy:180,phase:row?'working':'reported',repairProgress:row?.35:0,variant:i};world.civicDamage={[d.key]:d};
      GLOW.length=0;drawBuildingTile(g,world,b,3,3,120,248,2.8,30,.8,1,new Map());drawFacadeDamage(g,world,0,3,3,120,248,2.8);
      g.fillStyle='rgba(4,8,18,.28)';g.fillRect(0,0,240,340);
      const light=document.createElement('canvas');light.width=240;light.height=340;const lg=light.getContext('2d');
      for(const glow of GLOW)glow(lg);
      g.drawImage(light,0,0);
      g.fillStyle='#efdfb9';g.font='14px system-ui';g.textAlign='center';g.fillText(`${material} · ${row?'repairing':'impact'}`,120,314);
      const pixels=g.getImageData(i*240,row*340,240,300).data;if(pixels.some((v,n)=>n%4!==3&&v>120))visible++;
      if(GLOW.length>0)masked++;g.restore();
    }
    // The mapped artist must also paint and survive all material families and repair phases.
    const damage=new MappedFacadeDamage();for(const [i,material]of materials.entries())damage.restore([...damage.snapshot(),{key:'mapped:'+i,kind:'building',buildingId:i,edge:0,a:[0,0],b:[2,0],normal:[0,-1],units:1,x:1,y:.7,tx:0,ty:0,material,severity:.8,at:0,repairBy:100,phase:'working',repairProgress:.4}]);
    const scratch=document.createElement('canvas');scratch.width=400;scratch.height=300;const sg=scratch.getContext('2d');
    drawMappedFacadeDamage(sg,damage,(x,y,h=0)=>[150+(x-y)*50,180+(x+y)*25-h*60],4,40);
    const drawn=sg.getImageData(0,0,400,300).data.some((v,i)=>i%4===3&&v>0);
    return {visibleCells:visible,glowPasses:masked,mappedArtDrawn:drawn};
  });
  fs.mkdirSync('e2e/screenshots',{recursive:true});await page.screenshot({path:'e2e/screenshots/facade-damage.png'});
  if(errors.length||result.visibleCells!==12||!result.mappedArtDrawn)throw Error(JSON.stringify({errors,...result}));
  console.log(JSON.stringify({errors,...result}));
}finally{await browser.close();}
