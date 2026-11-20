import {describe,it,expect} from 'vitest';
import {recordCasinoRound,restoreCasinoRecord} from '../src/casino/CasinoRecord';
import {newCityPlay,restoreCityPlay} from '../src/sim/CityPlay';
describe('saved casino record',()=>{
 it('tracks each settled game, wins, losses, net and streaks through a save',()=>{
  const p=newCityPlay(),s=p.casino;recordCasinoRound(s,'Flight',25,100);recordCasinoRound(s,'Blackjack',40,101);recordCasinoRound(s,'Flight',-10,102);
  expect(s.record).toMatchObject({played:3,wins:2,losses:1,net:55,best:40,worst:-10,streak:0,bestStreak:2});
  expect(s.record?.games.Flight).toMatchObject({played:2,wins:1,losses:1,net:15});
  const restored=restoreCityPlay(p);expect(restored.casino.record).toEqual(s.record);
 });
 it('bounds history and rejects malformed saved counters',()=>{
  const s=newCityPlay().casino;for(let i=0;i<55;i++)recordCasinoRound(s,'Flight',i%2?1:-1,i);expect(s.record?.recent).toHaveLength(40);
  expect(restoreCasinoRecord({played:Infinity,net:NaN,recent:[]}).played).toBe(0);
 });
});

