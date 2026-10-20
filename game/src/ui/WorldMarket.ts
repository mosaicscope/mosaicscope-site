import {aircraftForSku,aircraftStock,AIR_STOCK_MS} from '../content/aircraft';
import {drawAircraft} from '../render/Aircraft';
import {drawBoat} from '../render/Boats';
import {h} from './dom';
const fmtCash=(n:number)=>"$"+Math.round(n).toLocaleString("en-NZ");
import type {Simulation} from '../sim/Simulation';
import {MARKET,buyMarket,createCompany,deliverySite,type MarketItem} from '../sim/Commerce';
import {drawCar} from '../render/Cars';
import {Camera} from '../render/Camera';
import {VEHICLES} from '../content/vehicles';
import type {Vehicle} from '../entities/types';
import './market.css';
export interface MarketHost {sim():Simulation;show(title:string,body:HTMLElement[]):void;close():void;visit(building:number):void;sail(order:number):void;fly():void;collection():void;target(order:number):void;hangar?(order:number):void;toast(text:string):void}
export class WorldMarket {
 private refreshTimer=0;private page=0;private tab='Cars'; private search='';private site=-1;
 constructor(private host:MarketHost){}
 show():void {const s=this.host.sim();if(!s.world.buildings[this.site])this.site=deliverySite(s,'car:');this.render();}
 private render():void {
  const s=this.host.sim(),select=h('select',{'aria-label':'Delivery address',onchange:(e:Event)=>this.site=+(e.target as HTMLSelectElement).value},s.world.buildings.map(b=>h('option',{value:b.id,selected:b.id===this.site,text:`${b.name} · ${s.world.streetName(b.door.x,b.door.y)}`})));
  const categories=['Cars','Marine','Aircraft','Home','Property','Experiences','Armory','Companies','My assets'];
  const nav=h('nav.mk-tabs',{'aria-label':'Marketplace categories'},categories.map(cat=>h('button.btn',{text:cat,'aria-pressed':cat===this.tab,onclick:()=>{this.tab=cat;this.page=0;this.search='';this.site=deliverySite(s,cat==='Aircraft'?'air:':cat==='Cars'?'car:':'property:');this.render();}})));
  const find=h('input',{type:'search',placeholder:'Search stock','aria-label':'Search marketplace',value:this.search,onchange:(e:Event)=>{this.page=0;this.search=(e.target as HTMLInputElement).value;this.render();}});
  const stock=new Set(aircraftStock().map(a=>'air:'+a.id));
  const items=MARKET.filter(i=>i.category===this.tab&&(this.tab!=='Aircraft'||stock.has(i.id)||['air:propeller','air:private-jet'].includes(i.id))&&(`${i.name} ${i.detail}`).toLowerCase().includes(this.search.toLowerCase()));
  const count=window.innerWidth<640?1:window.innerHeight<720?2:3,pages=Math.max(1,Math.ceil(items.length/count));this.page=Math.min(this.page,pages-1);
  const pager=h('div.mk-pager',null,[h('button.btn',{text:'← Previous',disabled:this.page===0,onclick:()=>{this.page--;this.render();}}),h('span',{text:`${this.page+1} / ${pages}${this.tab==='Aircraft'?' · Stock refresh in '+Math.ceil((AIR_STOCK_MS-Date.now()%AIR_STOCK_MS)/60000)+' min':''}`}),h('button.btn',{text:'Next →',disabled:this.page>=pages-1,onclick:()=>{this.page++;this.render();}})]);
  const body=this.tab==='Companies'?this.companies():this.tab==='My assets'?this.assets():h('section.mk-stock',null,[h('div.mk-grid',null,items.slice(this.page*count,(this.page+1)*count).map(i=>this.card(i))),pager]);
  clearTimeout(this.refreshTimer);if(this.tab==='Aircraft')this.refreshTimer=window.setTimeout(()=>{if(body.isConnected&&this.tab==='Aircraft')this.render();},AIR_STOCK_MS-Date.now()%AIR_STOCK_MS+50);
  this.host.show('Mosaic Market', [h('section.mk',null,[h('header.mk-head',null,[h('div',null,[h('small',{text:'CITY DEALERS · LOCAL DELIVERIES'}),h('h2',{text:'City marketplace'})]),h('b',{text:fmtCash(s.player.cash)})]),nav,h('div.mk-tools',null,[select,find]),body,h('div.mk-footer',null,[h('button.btn',{text:'Collection & zoo',onclick:()=>{this.host.close();this.host.collection();}}),h('p',{text:'Purchases use game currency. Delivery addresses, vehicle ownership, furnishings and companies are saved with your game.'})])])]);
 }
 private card(item:MarketItem):HTMLElement {
  const s=this.host.sim(),preview=h('canvas',{width:520,height:250,role:'img','aria-label':item.name}) as HTMLCanvasElement,g=preview.getContext('2d')!;g.fillStyle='#292e2c';g.fillRect(0,0,520,250);
  if(item.vehicle){const camera=new Camera();camera.viewW=520;camera.viewH=250;camera.zoom=3;camera.lookAt(0,0,true);const v={id:1,cls:item.vehicle,x:0,y:0,px:0,py:0,heading:0,damage:0,speed:0,color:VEHICLES[item.vehicle].colors[0],plate:'MOSAIC',state:'parked',siren:false} as Vehicle;drawCar(g,camera,v,1,0,0,false);}
  else {g.strokeStyle='#a79b7e';g.fillStyle='#d4c6a9';g.lineWidth=3;const marine=item.category==='Marine';g.beginPath();if(marine){drawBoat(g,260,145,0,item,Math.min(1.5,450/Math.max(36,Math.min(420,(item.length??8)*12))));}
   else if(item.category==='Aircraft'){const a=aircraftForSku(item.id);drawAircraft(g,a,260,140,Math.min(2.8,430/(a.length*5)));}
   else {g.fillStyle='#6b675a';g.fillRect(155,125,210,65);g.strokeRect(155,125,210,65);g.fillStyle='#a09378';g.fillRect(165,100,190,45);g.fillRect(165,195,12,18);g.fillRect(342,195,12,18);}}
  return h('article.mk-card',null,[preview,h('div.mk-copy',null,[h('small',{text:item.category}),h('h3',{text:item.name}),h('p',{text:item.detail}),h('div.mk-price',null,[h('b',{text:fmtCash(item.price)}),h('button.btn',{text:'Buy & deliver',disabled:s.player.cash<item.price,onclick:()=>{this.host.toast(buyMarket(s,item.id,this.site));this.render();}})])])]);
 }
 private assets():HTMLElement {const s=this.host.sim();return h('div.mk-orders',null,[...s.commerce.purchases.slice().reverse().map(o=>{const b=s.world.buildings[o.building];return h('article.mk-order',null,[h('div',null,[h('b',{text:o.name}),h('p',{text:b?`${b.name} · ${s.world.streetName(b.door.x,b.door.y)}`:'Marina delivery'})]),...(o.sku.startsWith('air:')&&o.bay?[h('button.btn',{text:'Visit hangar',onclick:()=>{this.host.close();this.host.hangar?.(o.id);}})]:[]),h('button.btn',{text:o.sku.startsWith('boat:')?'Board vessel':o.sku.startsWith('air:')?'Private departure':o.sku==='defense:launcher'?'Aim on map':'Visit delivery',onclick:()=>{this.host.close();if(o.sku.startsWith('boat:'))this.host.sail(o.id);else if(o.sku.startsWith('air:'))this.host.fly();else if(o.sku==='defense:launcher')this.host.target(o.id);else this.host.visit(o.building);}})]);}),!s.commerce.purchases.length?h('p',{text:'Your saved deliveries will appear here.'}):null]);}
 private companies():HTMLElement {const s=this.host.sim(),name=h('input',{'aria-label':'Company name',maxlength:48,placeholder:'Name your company'}) as HTMLInputElement,kind=h('select',{'aria-label':'Company type'},['retail','food','media','transport','services'].map(v=>h('option',{value:v,text:v}))) as HTMLSelectElement;
 return h('section.mk-companies',null,[h('h3',{text:'Create a company'}),h('p',{text:'Registration and premises deposit: $1,500. Choose an address above. Your company appears on the city map and pays through the existing daily business ledger.'}),name,kind,h('button.btn',{text:'Register company · $1,500',onclick:()=>{this.host.toast(createCompany(s,name.value,kind.value,this.site));this.render();}}),...s.life.businesses.map(b=>h('article.mk-order',null,[h('div',null,[h('b',{text:b.name}),h('p',{text:`${b.kind} · level ${b.level} · daily takings active`})]),h('button.btn',{text:'Visit premises',disabled:b.id<0,onclick:()=>{this.host.close();this.host.visit(b.id);}})]))]);}
}
