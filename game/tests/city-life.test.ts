import {describe,it,expect,beforeAll,beforeEach} from 'vitest';
import {Simulation} from '../src/sim/Simulation';
import {CITY_LIFE_EVENTS,CITY_RESIDENTS} from '../src/content/cityLife';
import {newCityLife,cityLife,startLife,workLifeStep,updateLifeWork,updateCityLife,manchester,privateCompany,chatCompanion,restoreCityLife} from '../src/sim/CityLife';
import {serialize,restore} from '../src/persistence/SaveSystem';
let s:Simulation;
beforeAll(()=>{s=new Simulation({cityMap:'christchurch',midCount:0,backgroundCount:0,trafficCars:0});const a=manchester(s)!;s.player.x=a.x;s.player.y=a.y;s.focus={x:a.x,y:a.y};s.tick=120;updateCityLife(s);},30000);
beforeEach(()=>{s.cityPlay.everyday={...newCityLife(),crew:CITY_RESIDENTS.map(d=>s.chars.find(c=>c.name===d.name)!.id),dressed:true};s.tick=0;s.env.startHour=10;s.env.raining=false;s.player.cash=500;s.player.inCar=-1;s.player.inside=-1;s.player.phys=0;s.player.wanted=0;s.player.substances=undefined;});
describe('everyday life and Manchester nights',()=>{
 it('adds a diverse daily catalogue and a bounded adult cast on the actual street',()=>{expect(CITY_LIFE_EVENTS).toHaveLength(36);expect(new Set(CITY_LIFE_EVENTS.map(e=>e.id)).size).toBe(36);expect(manchester(s)?.name).toMatch(/Manchester/);expect(CITY_RESIDENTS.every(c=>c.age>=21)).toBe(true);expect(cityLife(s).crew).toHaveLength(12);expect(s.cityPlay.props.length).toBeLessThanOrEqual(144);});
 it('requires time, proximity and all delivery stops before paying once per day',()=>{
  const cash=s.player.cash;expect(startLife(s,'coffee-run')).toMatch(/started/);expect(s.player.cash).toBe(cash-12);
  const a=cityLife(s).active!;s.player.x=-999;s.player.y=-999;expect(workLifeStep(s)).toMatch(/within/);expect(a.until).toBeUndefined();
  for(const target of a.targets){s.player.x=target.x;s.player.y=target.y;expect(workLifeStep(s)).toMatch(/…/);s.tick=a.until!;updateLifeWork(s);}
  expect(cityLife(s).active).toBeUndefined();expect(s.player.cash).toBe(cash-12+28);expect(startLife(s,'coffee-run')).toMatch(/Finished today/);expect(cityLife(s).history).toHaveLength(1);
 });
 it('uses weather and game-time availability without inventing source observations',()=>{expect(startLife(s,'rain-coats')).toMatch(/raining/);s.env.raining=true;expect(startLife(s,'rain-coats')).toMatch(/started/);cityLife(s).active=undefined;expect(startLife(s,'dance-floor')).toMatch(/Available/);});
 it('does not stack jobs, overdraw supplies or retain corrupt saved objectives',()=>{s.player.cash=0;expect(startLife(s,'groceries')).toMatch(/Not enough/);s.player.cash=500;startLife(s,'groceries');expect(startLife(s,'coffee-run')).toMatch(/current/);expect(restoreCityLife({active:{id:'groceries',stage:9,targets:[]}}).active).toBeUndefined();});
 it('persists a multi-stop activity, familiarity and journal across save/load',()=>{startLife(s,'groceries');cityLife(s).affinity['Mara Vale']=2;cityLife(s).history.push({title:'A normal day',result:'Helped a neighbour',at:0});const loaded=restore(serialize(s));expect(cityLife(loaded).active?.id).toBe('groceries');expect(cityLife(loaded).affinity['Mara Vale']).toBe(2);expect(cityLife(loaded).crew).toHaveLength(12);},30000);
 it('requires mutual comfort, conversation, adult age, proximity and an evening shift for private company',()=>{
  const c=s.chars[cityLife(s).crew[0]];c.phys=0;c.inside=c.inCar=c.talkWith=-1;c.emo.fear=0;c.substances=undefined;s.player.x=c.x;s.player.y=c.y;s.env.startHour=21;
  expect(privateCompany(s,c.id).ok).toBe(false);chatCompanion(s,c.id);expect(chatCompanion(s,c.id)).toMatch(/little while/);s.tick+=1800;chatCompanion(s,c.id);expect(cityLife(s).affinity[c.name]).toBe(2);
  cityLife(s).playerAge=17;expect(privateCompany(s,c.id).ok).toBe(false);cityLife(s).playerAge=25;s.env.startHour=10;expect(privateCompany(s,c.id).ok).toBe(false);s.env.startHour=21;c.emo.fear=.8;expect(privateCompany(s,c.id).ok).toBe(false);c.emo.fear=0;
  const cash=s.player.cash,result=privateCompany(s,c.id);expect(result.ok).toBe(true);expect(result.text).toMatch(/fades to black/);expect(s.player.cash).toBe(cash-80);expect(privateCompany(s,c.id).ok).toBe(false);expect(s.player.cash).toBe(cash-80);
 });
 it('keeps repeated district updates bounded and preserves named residents',()=>{const count=s.chars.length,a=manchester(s)!;s.player.x=a.x;s.player.y=a.y;for(let i=0;i<20;i++){s.tick+=120;updateCityLife(s);}expect(s.chars.length).toBe(count);expect(cityLife(s).crew).toHaveLength(12);expect(s.cityPlay.props.length).toBeLessThanOrEqual(144);});
});
