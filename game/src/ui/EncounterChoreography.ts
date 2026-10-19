/** One prop/action pairing per authored choice. Resolved scenes play once, then hold the actual outcome. */
export const CHOICE_ITEMS:Record<string,readonly [string,string]>={
 dog:['lead','snack'],wedding:['camera','phone'],water:['barrier','phone'],magpie:['shield','map'],quake:['hand','shelf'],wallet:['wallet','evidence'],bus:['coins','coins'],wind:['sheet','rack'],bike:['parcel','chain'],market:['brace','mug'],keys:['hook','keys'],busker:['coins','hands'],cake:['icing','cake'],duck:['ducks','stop'],interview:['notes','coffee'],power:['crate','icecream'],ring:['ring','torch'],cone:['cone','phone'],flood:['sandbag','cover'],tourist:['map','notes'],piano:['keys','bag'],soup:['bowl','vegetables'],skater:['bandage','helmet'],poster:['poster','cat'],parcel:['parcel','phone'],protest:['cups','mug'],tram:['camera','stop'],memorial:['flowers','tea'],puppet:['curtain','hands'],trolley:['trolley','stop'],seed:['seedlings','seedlings'],film:['sandwich','reflector'],bee:['phone','barrier'],mural:['brush','paint'],flat:['sofa','trolley'],choir:['coins','collection'],hail:['cover','apples'],book:['books','towels'],referee:['whistle','chalk'],farewell:['box','card']
};
export function choiceMotion(id:string,choice:number,time:number,reduced=false){
 const item=CHOICE_ITEMS[id]?.[choice];if(!item)throw Error('Unstaged encounter choice: '+id+'/'+choice);
 const hold=['phone','torch','notes','map','camera','stop','reflector','barrier'].includes(item),carry=['parcel','crate','sofa','trolley','seedlings','cake','box','books','cover','sheet','rack'].includes(item);
 const target=hold?[.1,1.9]:[.45,1.55],start=[-1.1,2.1],end=carry?[2,2.1]:[1.1,1.9],t=reduced?8:Math.max(0,time);
 const leg=(a:number[],b:number[],u:number)=>({x:a[0]+(b[0]-a[0])*u,y:a[1]+(b[1]-a[1])*u});
 if(t<2){return {...leg(start,target,t/2),pose:'walk',phase:t*2.4,stage:'approach',item};}
 if(t<4.5)return {x:target[0],y:target[1],pose:hold?(item==='phone'?'phone':item==='camera'?'photo':'read'):carry?'carry':item==='hands'?'cheer':'craft',phase:0,stage:'action',item};
 if(t<6.5)return {...leg(target,end,(t-4.5)/2),pose:carry?'carry':'walk',phase:(t-4.5)*2.4,stage:'finish',item};
 return{x:end[0],y:end[1],pose:hold?'read':carry?'carry':'talk',phase:0,stage:'complete',item};
}
/** Hand props are drawn at the solved hand joint, so they follow the same skeleton as the street characters. */
export function choiceProp(g:CanvasRenderingContext2D,item:string,x:number,y:number,size=1){
 g.save();g.translate(x,y);g.scale(size,size);g.lineWidth=1.5;g.strokeStyle='#242826';g.fillStyle='#ae8965';
 const rect=(x:number,y:number,w:number,h:number,col:string)=>{g.fillStyle=col;g.fillRect(x,y,w,h);g.strokeRect(x,y,w,h);};
 if(['phone','torch','camera','reflector'].includes(item)){rect(-6,-9,item==='reflector'?22:12,item==='reflector'?22:16,item==='reflector'?'#e3ddca':'#34444b');if(item==='camera'){g.fillStyle='#84b1b4';g.beginPath();g.arc(0,-1,4,0,7);g.fill();}else if(item==='phone')rect(-4,-6,8,10,'#9bc6c7');}
 else if(['coins','collection','ring','keys','whistle'].includes(item)){g.fillStyle='#d6b96b';for(let i=0;i<(item==='coins'?3:1);i++){g.beginPath();g.ellipse(i*4-3,-3-i*2,4,2.5,0,0,7);g.fill();g.stroke();}if(item==='keys'){g.beginPath();g.moveTo(1,-3);g.lineTo(10,-3);g.lineTo(10,1);g.stroke();}}
 else if(['tea','coffee','mug','cups','bowl','icecream','snack','sandwich','apples','vegetables'].includes(item)){rect(-6,-5,12,9,item==='vegetables'?'#7f9c59':item==='apples'?'#b67050':'#e5d5af');g.strokeStyle='#76563b';g.beginPath();g.arc(7,-1,3,0,7);g.stroke();if(item==='tea'||item==='coffee'){g.strokeStyle='#e5e0cf88';g.beginPath();g.moveTo(-2,-7);g.quadraticCurveTo(-5,-12,0,-16);g.stroke();}}
 else if(['notes','map','poster','card','evidence','towels','books'].includes(item)){rect(-9,-11,18,20,item==='books'?'#9a6451':'#ded8be');g.strokeStyle='#668583';for(let i=0;i<3;i++){g.beginPath();g.moveTo(-6,-6+i*4);g.lineTo(6,-6+i*4);g.stroke();}}
 else if(['paint','icing','brush','chalk','hook','chain'].includes(item)){g.strokeStyle=item==='brush'?'#8caa75':'#c9b385';g.lineWidth=3;g.beginPath();g.moveTo(-6,8);g.lineTo(5,-12);g.stroke();rect(1,-14,8,5,'#83a1a0');}
 else if(item==='helmet'){g.fillStyle='#bb7960';g.beginPath();g.arc(0,-2,10,Math.PI,0);g.closePath();g.fill();g.stroke();}
 else if(item==='seedlings'||item==='flowers'){rect(-9,0,18,8,'#8c7052');for(let i=0;i<3;i++){g.strokeStyle='#75965b';g.beginPath();g.moveTo(i*6-6,0);g.lineTo(i*6-6,-10);g.stroke();g.fillStyle=item==='flowers'?'#ce9690':'#6c965b';g.beginPath();g.ellipse(i*6-6,-10,4,3,.4,0,7);g.fill();}}
 else if(!['hand','hands','ducks'].includes(item)){rect(-10,-8,20,15,item==='bandage'?'#e5dfcf':item==='cover'||item==='sheet'||item==='curtain'?'#9baab1':item==='wallet'?'#8c6547':'#ae8965');if(item==='parcel'||item==='box'){rect(-2,-8,4,15,'#d7c395');}}
 g.restore();
}
