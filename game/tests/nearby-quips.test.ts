import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {chooseQuip,quipSignature,quipsSimilar,updateNearbyQuips,interruptNearbyQuip} from '../src/sim/NearbyQuips';
import type {Simulation} from '../src/sim/Simulation';
import {restoreWorldFun} from '../src/sim/WorldFun';

afterEach(()=>vi.unstubAllGlobals());
describe('nearby sayings',()=>{
 it('keeps all 60,000 supplied sayings as separate entries',()=>{
  for(let i=1;i<=6;i++){const bank=JSON.parse(readFileSync(new URL('../public/quips/kiwi-'+i+'.json',import.meta.url),'utf8'));expect(bank).toHaveLength(10000);expect(bank.every((x:unknown)=>typeof x==='string'&&x.length>0&&!x.includes('|'))).toBe(true);}
 });
 it('rejects exact and closely related recent lines and chooses a different option',()=>{
  const recent=[quipSignature('The council banned jandals in court again.')];
  expect(quipsSimilar(recent[0],quipSignature('The council banned jandals in court again!'))).toBe(true);
  expect(quipsSimilar(recent[0],quipSignature('The council banned jandals in court yesterday.'))).toBe(true);
  let i=0;const values=[0,.4,.8];const choice=chooseQuip(['The council banned jandals in court again!','The council banned jandals in court yesterday.','That pie has vanished from the kitchen.'],recent,()=>values[i++],3);
  expect(choice?.text).toBe('That pie has vanished from the kitchen.');
  expect(chooseQuip(['Already spoken'],[],()=>0,2,new Set(['Already spoken']))).toBeNull();
 });
 it('restores a bounded history so recent lines remain suppressed after loading',()=>{const restored=restoreWorldFun({recentQuips:Array.from({length:110},(_,i)=>'Saying '+i)});expect(restored.recentQuips).toHaveLength(100);expect(restored.recentQuips?.[0]).toBe('Saying 10');});
 it('waits for nearby speech, speaks once nearby, and yields to a new conversation',async()=>{
  vi.stubGlobal('window',{});vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>['A completely different pie joke.']})));
  const player:any={id:0,x:0,y:0,inside:-1,inCar:-1,talkWith:-1,bubble:null},speaker:any={id:1,x:1,y:0,inside:-1,inCar:-1,talkWith:-1,bubble:null,phys:0,stunUntil:0},other:any={id:2,x:1.5,y:0,inside:-1,inCar:-1,talkWith:-1,bubble:{text:'Existing talk',kind:'say',until:500},phys:0,stunUntil:0};
  const s={tick:60,worldFun:{},playerId:0,player,vehicles:[],chars:[player,speaker,other],charHash:{query:(_x:number,_y:number,_r:number,out:number[])=>{out.push(0,1,2);return 3;}},rng:{pick:<T>(a:T[])=>a[0],next:()=>0,int:()=>120},say(this:any,c:any,text:string,kind:string,secs:number){c.bubble={text,kind,until:this.tick+secs*60};}} as unknown as Simulation;
  updateNearbyQuips(s);await new Promise(r=>setTimeout(r,0));s.tick=240;updateNearbyQuips(s);expect(speaker.bubble).toBeNull();other.bubble=null;s.tick=300;updateNearbyQuips(s);expect(speaker.bubble?.text).toBe('A completely different pie joke.');expect(speaker.bubble!.until-s.tick).toBeGreaterThanOrEqual(300);
  interruptNearbyQuip(s,other as any);expect(speaker.bubble).toBeNull();s.tick=360;updateNearbyQuips(s);expect(speaker.bubble).toBeNull();
 });
});

