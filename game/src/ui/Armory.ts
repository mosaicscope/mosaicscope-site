import {h} from './dom';
import type {Simulation} from '../sim/Simulation';
import type {ModalHost} from './Modals';
import {TOYS} from '../content/toys';
import {UNARMED,AMMO_PACKS,type UnarmedStyle} from '../content/combat';
import {equip,carried} from '../inventory/Inventory';
import {makeVehicle} from '../sim/Traffic';
import {canvasStage,roundBox,sceneText} from './CanvasStage';
import {drawToy} from '../render/ToyArt';
export class Armory{
 constructor(private sim:()=>Simulation,private modal:ModalHost,private toast:(text:string)=>void){}
 show(){
  const sim=this.sim(),p=sim.player,c=p.combat??={style:'jab',xp:0,ammo:{},vest:0,helmet:0};
  c.load??='standard';
  const button=(text:string,fn:()=>void,disabled=false)=>h('button.btn',{text,disabled,onclick:()=>{fn();this.show();}});
  const pay=(n:number)=>{if(p.cash<n)return false;p.cash-=n;return true;};
  const weapons=['baton','mace','pistol','revolver','shotgun','smg','rifle'];
  const weaponCards=weapons.map(id=>{const d=TOYS[id],w=d.weapon!,owned=carried(p).find(n=>sim.toys[n].def===id);return h('article.ax-card',null,[h('h3',{text:d.name}),h('p',{text:`$${d.value} · ${w.gun?(w.mode??'semi')+' · '+w.mag+' round magazine':'Melee'} · power ${w.damage} · reach ${w.reach} · ${w.rate}s between strikes`}),button(owned!==undefined?'Equip':'Buy and equip',()=>{if(owned!==undefined){equip(p,owned);return;}if(!pay(d.value))return;const t=sim.spawnToy(id,p.x,p.y);if(!t){p.cash+=d.value;return;}const result=sim.pickupToy(p,t);if(result==='full'){p.cash+=d.value;t.state='broken';return;}equip(p,t.id);if(w.gun)c.ammo[id]=(c.ammo[id]??0)+(w.mag??12)*2;},owned===undefined&&(p.cash<d.value||p.hand>=0&&p.bag.length>=p.bagMax))]);});
  const art=canvasStage(g=>{g.fillStyle='#193239';g.fillRect(0,0,960,230);roundBox(g,25,22,910,186,12,'#263e3c','#a5ac7a60');for(let i=0;i<weapons.length;i++){const x=95+i*125;drawToy(g,weapons[i],x,102,2,0,TOYS[weapons[i]].color);sceneText(g,TOYS[weapons[i]].name,x,175,13,'#e8d8b1');}},{height:230,label:'Moorhouse armory weapon racks with batons, maces, pistols and long guns'});
  const styles=h('article.ax-card',null,[h('h3',{text:`Unarmed training · Level ${1+Math.floor(c.xp/8)} · ${c.xp} XP`}),h('p',{text:'Space / Attack uses the selected style. F / Fire shoots a held gun. Hold F for an automatic weapon. Click a nearby person to aim; hits have injuries, witnesses and police consequences.'}),h('div.ax-actions',null,Object.entries(UNARMED).map(([id,m])=>button(`${m.name}${c.style===id?' ✓':''}${c.xp<m.xp?' · '+m.xp+' XP':''}`,()=>{c.style=id as UnarmedStyle;},c.xp<m.xp))),button('Training session · $25',()=>{if(pay(25))c.xp+=8;},p.cash<25),button('Empty hands',()=>{while(p.hand>=0)sim.dropHeld(p);})]);
  const protection=h('article.ax-card',null,[h('h3',{text:'Armour and protection'}),h('p',{text:`Vest ${c.vest}% · Helmet ${c.helmet}%. Reduces impacts and covered wounds; armour wears down when hit.`}),button('Fit / repair vest · $250',()=>{if(pay(250))c.vest=100;},p.cash<250||c.vest===100),button('Fit / repair helmet · $120',()=>{if(pay(120))c.helmet=100;},p.cash<120||c.helmet===100)]);
  const ammo=h('article.ax-card',null,[h('h3',{text:'Ammunition'}),h('div.ax-actions',null,(['rubber','standard','heavy'] as const).map(load=>button(load+(c.load===load?' ✓':''),()=>{c.load=load;}))),h('p',{text:'Rubber: low impact. Standard: balanced. Heavy: more injury and recoil. Each load uses its own purchased reserve.'}),...AMMO_PACKS.map(a=>button(`${a.name} · ${c.ammo[(c.load??'standard')==='standard'?a.id:a.id+':'+c.load]??0} carried · +${a.rounds} for $${a.price}`,()=>{if(pay(a.price)){const key=(c.load??'standard')==='standard'?a.id:a.id+':'+c.load;c.ammo[key]=(c.ammo[key]??0)+a.rounds;}},p.cash<a.price))]);
  const heavy=h('article.ax-card',null,[h('h3',{text:'Heavy vehicle yard'}),h('p',{text:'Tracked Mosaic Heavy Tank · $85,000. Heavy collision mass, slow acceleration and steering. F fires a shell, E enters or exits. Delivered beside the armory.'}),button('Buy tank · $85,000',()=>{if(!pay(85000))return;const b=sim.world.buildings.find(b=>b.name==='Moorhouse Armory'),spot=sim.world.nearestWalkable(b?b.x1+3:p.x+3,b?b.y1+3:p.y+3);const v=makeVehicle(sim,'tank',spot.x,spot.y,0,'parked');v.owner=p.id;v.cannonRounds=12;this.toast('Tank delivered to the armory yard. Press E beside it.');},p.cash<85000),button('Refill tank · 12 shells · $300',()=>{const tank=sim.vehicles.find(v=>v.cls==='tank'&&v.owner===p.id);if(tank&&pay(300))tank.cannonRounds=12;},p.cash<300||!sim.vehicles.some(v=>v.cls==='tank'&&v.owner===p.id))]);
  this.modal.show('Moorhouse Armory · gun store and equipment',[h('p.ax-status',{text:`$${p.cash.toLocaleString()} · Equipped: ${p.hand>=0?TOYS[sim.toys[p.hand].def].name:'unarmed'}`}),h('div.ax-grid',null,[art,styles,protection,ammo,...weaponCards,heavy])],'activities');
 }
}
