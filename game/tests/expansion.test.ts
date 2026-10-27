import { describe, it, expect } from "vitest";
import { newExpansion, encounterAt, farmDay, DAY, HOUR, cropYield, passCourse, QUESTIONS, DEGREES, wageBoost, baccarat } from "../src/sim/Expansion";
import { damageTick, damageParts, repairVehicle } from "../src/sim/VehicleDamage";
import type { Vehicle } from "../src/entities/types";
import { serialize, restore } from "../src/persistence/SaveSystem";
import { small } from "./helpers";

describe('retired random encounters',()=>{it('never offers random choice cards even after movement and clears legacy pending events',()=>{const s=newExpansion();s.pending='wallet';for(let i=0;i<50;i++)expect(encounterAt(s,(i+1)*HOUR,25,.5)).toBeNull();expect(s.pending).toBeNull();});});
describe("farming transactions", () => {
  it("requires production equipment and feed, charges upkeep and settles only once", () => {
    const s=newExpansion(); s.farm=1; s.animals={Chickens:10};s.feed=50;s.farmCare=0;
    const noShed=farmDay(s,DAY,false)!; expect(noShed.gross).toBe(0);expect(noShed.costs).toBeGreaterThan(0);
    expect(farmDay(s,DAY,false)).toBeNull();
    s.machines.push("Hen house");s.farmCare=1;
    const fed=farmDay(s,2*DAY,false)!;expect(fed.gross).toBeGreaterThan(0);expect(s.feed).toBe(30);
    s.feed=0;
    const hungry=farmDay(s,3*DAY,false)!;expect(hungry.gross).toBe(0);expect(hungry.net).toBeLessThan(0);
  });
  it("connects farm implements to output rather than permitting free harvests", () => {
    const s=newExpansion();s.farm=1;
    expect(cropYield(s,false,false)).toBe(0);
    s.machines.push("Tractor","Plough","Seed drill");
    const base=cropYield(s,false,false);expect(base).toBeGreaterThan(0);
    s.machines.push("Combine harvester","Irrigator");
    expect(cropYield(s,false,false)).toBeGreaterThan(base);
    expect(cropYield(s,true,false)).toBe(0);s.machines.push("Mower");expect(cropYield(s,true,false)).toBeGreaterThan(0);
  });
});
describe("degree courses", () => {
  it("has courses for eight degrees and consumes each passed question once", () => {
    expect(DEGREES).toHaveLength(8);
    for(const degree of DEGREES) {
      const s=newExpansion();s.degree=degree;s.quiz=0;
      const correct=QUESTIONS[degree][0][2];
      expect(passCourse(s,(correct+1)%3)).toBe(false);expect(s.credits).toBe(0);
      expect(passCourse(s,correct)).toBe(true);expect(s.credits).toBe(1);
      expect(passCourse(s,correct)).toBe(false);expect(s.credits).toBe(1);
    }
    const s=newExpansion();s.level=3;expect(wageBoost(s)).toBeCloseTo(1.6);
  });
});
describe("baccarat rules", () => {
  it("pays a tie and pushes non-tie stakes on natural ties", () => {
    expect(baccarat(10,"Tie",()=>0)).toEqual({payout:90,text:"Player 3 · Banker 3 · Tie"});
    expect(baccarat(10,"Banker",()=>0).payout).toBe(10);
  });
  it("uses the banker commission and natural stopping rule", () => {
    const cards=[1,1,4,4];const rng=()=>((cards.shift()??1)-0.5)/13;
    expect(baccarat(10,"Banker",rng)).toEqual({payout:19.5,text:"Player 2 · Banker 8 · Banker"});
  });
});
describe("vehicle component damage", () => {
  it("separates rear glass damage from engine damage and repairs every component", () => {
    const v={dmgR:1,damage:0.7,driver:0,speed:10} as Vehicle;
    damageParts(v);expect(v.glassDamage).toBeGreaterThan(0.8);expect(v.engineDamage).toBe(0);
    v.dmgF=1;v.dmgL=1;damageParts(v);expect(v.flatLeft).toBe(true);expect(v.flatRight).toBeFalsy();
    for(let i=0;i<100;i++) damageTick(v,1);
    expect(v.burnt).toBe(true);expect(v.speed).toBe(0);
    repairVehicle(v);damageTick(v,1);expect(v.burnt).toBe(false);expect(v.flatLeft).toBe(false);expect(v.engineDamage).toBe(0);expect(v.glassDamage).toBe(0);expect(v.leak).toBe(0);
  });
  it("allows a stopped engine to cool before a fire", () => {
    const v={dmgF:0.9,damage:0.8,driver:0,speed:0,heat:0.9} as Vehicle;
    for(let i=0;i<60;i++) damageTick(v,1);
    expect(v.heat).toBe(0);expect(v.burning).toBeFalsy();
  });
});
describe("expansion saves", () => {
  it("keeps progress isolated by slot and supports older saves", () => {
    const sim=small(7);sim.expansion.farm=2;sim.expansion.animals.Chickens=4;sim.expansion.seen=["dog"];sim.expansion.level=1;
    const data=serialize(sim); const loaded=restore(data);
    expect(loaded.expansion).toEqual(sim.expansion);
    loaded.expansion.seen.push("wallet");expect(sim.expansion.seen).toEqual(["dog"]);
    delete data.expansion;expect(restore(data).expansion).toEqual(newExpansion());
    expect(loaded.wagePerHour(loaded.player)).toBeGreaterThan(restore(data).wagePerHour(sim.player));
  });
});
