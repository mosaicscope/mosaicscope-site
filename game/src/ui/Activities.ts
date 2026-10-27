import {farmPlot} from '../sim/FarmPlot';
import {SCRATCHCARDS} from '../content/scratchcards';
import {AIRCRAFT} from '../content/aircraft';
import { newHorseRace } from "../sim/HorseRace";
import { raceRoster, raceOrder, raceReturn } from "../sim/RaceBook";
import { raceScene } from "./VenueArt";
import { countryside, casinoArt, scratchArt } from "./ActivityArt";
import { makeScratch, revealScratch, dealBaccarat } from "../sim/Arcade";
import { h } from "./dom";
import type { Simulation } from "../sim/Simulation";
import { ANIMALS, MACHINES, DEGREES, QUESTIONS, HOUR, DAY, farmCapacity, cropYield, passCourse, titleOf, settleRace } from "../sim/Expansion";
import type { ModalHost } from "./Modals";
import "./activities.css";

const cash = (n: number) => "$" + n.toLocaleString("en-NZ", { maximumFractionDigits: 2 });
const pick = (n: number) => Math.floor(Math.random() * n);
type Tab = "Farm" | "UC" | "Racing" | "Betting" | "Explore";
/** All transactions use the current simulation, including after loading another slot. */
export class Activities {
  onMissions?:()=>void;
  onCityLife?:()=>void;
  onFun?: (kind:"roast"|"burger")=>void;
  private page=0; private design=0; private aircraft=0;
  onVisitFarm?:()=>void;
  private message = "";
  private game = "Scratchies";
  private record(game:string,values:number[],result:string,payout=0) { this.s.casino.result={game,values,labels:[],stake:this.stake,payout,result,at:this.sim().tick}; }
  private stake = 10;
  private racer = 0;
  private betType = "Win";
  private betSport = "Horse";
  private keno = new Set<number>();
  private get point() { return this.s.casino.point; }
  private set point(n:number) { this.s.casino.point=n; }
  private get pointStake() { return this.s.casino.pointStake; }
  private set pointStake(n:number) { this.s.casino.pointStake=n; }
  private get crash() { return this.s.casino.crash; }
  private set crash(v:import('../sim/Expansion').CasinoState['crash']) { this.s.casino.crash=v; }
  private get race() { return this.s.casino.race; }
  private set race(v:import('../sim/Expansion').CasinoState['race']) { this.s.casino.race=v; }
  private home: Tab = "Betting";
  constructor(private sim: () => Simulation, private modal: ModalHost, private toast: (s: string) => void) {}
  private get s() { return this.sim().expansion; }
  private pay(n: number): boolean {
    if (!Number.isFinite(n) || n < 0 || this.sim().player.cash < n) { this.message = "Not enough cash."; return false; }
    this.sim().player.cash = Math.round((this.sim().player.cash - n) * 100) / 100; return true;
  }
  private credit(n: number) { this.sim().player.cash = Math.round((this.sim().player.cash + n) * 100) / 100; }
  private btn(text: string, fn: () => void, disabled = false): HTMLElement { return h("button.btn", { text, disabled, onclick: () => { fn(); this.show(this.home); } }); }
  private card(title: string, text: string, buttons: HTMLElement[] = []): HTMLElement { return h("article.ax-card", null, [h("h3", { text: title }), h("p", { text }), h("div.ax-actions", null, buttons)]); }
  show(tab: Tab): void {
    document.querySelector("header.bar.open")?.classList.remove("open");
    document.querySelector("header.bar .menu-toggle")?.setAttribute("aria-expanded", "false");
    this.home = tab;
    const nav = (["Explore", "Betting", "Racing", "Farm", "UC"] as Tab[]).map(t => this.btn(t, () => { this.page=0;this.home = t; this.message = ""; }));
    let body = tab === "Farm" ? this.farm() : tab === "UC" ? this.uni() : tab === "Racing" ? this.stable() : tab === "Explore" ? this.explore() : this.betting();
    const stage=body.find(el=>el.classList.contains('play-stage')),options=body.filter(el=>el!==stage);
    if(tab!=='Betting'){
      const pages=Math.max(1,options.length);this.page=Math.min(this.page,pages-1);
      body=[...(stage?[stage]:[]),h('section.ax-deck',null,[options[this.page],h('nav.ax-pages',{'aria-label':'Activity pages'},[this.btn('← Previous',()=>{this.page--;},this.page===0),h('span',{text:`${this.page+1} / ${pages}`}),this.btn('Next →',()=>{this.page++;},this.page>=pages-1)])])];
    }
    this.modal.show(tab === "UC" ? "University of Canterbury · game campus" : tab === "Betting" ? "Pocket Tessera · play-money betting" : tab === "Racing" ? "Horncastle Arena · racing club" : tab === "Farm" ? "Canterbury farming" : "Around town", [
      h("nav.ax-nav", { "aria-label": "Activities" }, nav),
      h("p.ax-status", { role: "status", text: `${cash(this.sim().player.cash)} · ${this.message || "Choose your next chapter."}` }),
      h("div.ax-grid", null, body),
    ], "activities");
    const panel = this.modal.el.querySelector<HTMLElement>(".activities");
    if (panel) panel.scrollTop = 0;
  }
  encounter(): void { this.show("Explore"); }
  private explore(): HTMLElement[] {
    return [this.card('City missions','Take a real route through the city: collect parcels, make deliveries and drive marked streets.',[h('button.btn.acid',{text:'Open city missions',onclick:()=>this.onMissions?.()})]),this.card('Daily life','Meet the neighbourhood and choose everyday activities.',[h('button.btn',{text:'Open daily life',onclick:()=>this.onCityLife?.()})])];
  }
  private farm(): HTMLElement[] {
    const s = this.s, sim = this.sim(), day = Math.floor(sim.tick / DAY), count = Object.values(s.animals).reduce((a, b) => a + b, 0);
    const season = ["Spring", "Summer", "Autumn", "Winter"][Math.floor(sim.tick / (DAY * 7)) % 4];
    const result = [countryside(s,"farm",undefined,sim.chars),this.card(["Start a farming career", "Lifestyle block", "Family farm", "Mixed operation"][s.farm], `${season} · ${sim.env.weather} · ${count}/${farmCapacity(s)} animals · ${s.feed} feed · lifetime net ${cash(s.farmProfit)}. Next settlement in ${Math.max(0, Math.ceil((DAY - (sim.tick - s.lastFarm)) / HOUR))} game hours. Every game day: produce sells, feed is used and running costs are charged.`, [
      this.btn(s.farm ? `Expand · ${cash((s.farm + 1) * 1500)}` : "Buy lifestyle block · $1,500", () => { if(!farmPlot(sim.world)){this.message="No clear farm plot in this map.";return;} if (s.farm < 3 && this.pay((s.farm + 1) * 1500)) { s.farm++; s.lastFarm = sim.tick; this.message = "New land ready. Add animals, feed and their required equipment."; } }, s.farm >= 3),
    ])];
    if(s.farm)result.push(this.card("Your plot in town","Your animals and purchased equipment live on a fenced plot in the city. Visit the gate to see your upgrades.",[h("button.btn",{text:"Visit farm plot",onclick:()=>{this.modal.close();this.onVisitFarm?.();}})]));
    if (!s.farm) return result;
    result.push(this.card("Daily farm work", "Care for stock each day for full production. Crop jobs require equipment, and can each run once per game day.", [
      this.btn("Care for stock", () => { s.farmCare = day; this.message = "Water troughs, fences and stock checked. Care is recorded for today."; }, s.farmCare === day),
      this.btn("Buy 50 feed · $30", () => { if (this.pay(30)) s.feed += 50; }),
      this.btn("Make hay", () => { const n = cropYield(s, true, sim.env.raining); if (!n) { this.message = "Hay needs a tractor and mower."; return; } if (s.hayAt === day || !this.pay(8 * s.farm)) return; s.hayAt = day; s.feed += n; this.message = `Stored ${n} feed after fuel costs.`; }, s.hayAt === day),
      this.btn("Harvest grain", () => { const n = cropYield(s, false, sim.env.raining); if (!n) { this.message = "Grain needs a tractor, plough and seed drill."; return; } if (s.cropAt === day || !this.pay(20 * s.farm)) return; s.cropAt = day; this.credit(n); this.message = `Harvest sold for ${cash(n)} after paying fuel and seed.`; }, s.cropAt === day),
    ]));
    for (const [name, price, yieldCash, kind, need] of ANIMALS) result.push(this.card(`${name} · ${s.animals[name] ?? 0}`, `Buy ${cash(price)} · daily ${kind} up to ${cash(yieldCash)} each. Requires ${need}, feed and daily care.`, [
      this.btn("Buy", () => { if (count >= farmCapacity(s)) { this.message = "Stocking limit reached. Expand or add fencing and yards."; return; } if (this.pay(price)) s.animals[name] = (s.animals[name] ?? 0) + 1; }, count >= farmCapacity(s)),
      this.btn(`Sell · ${cash(price * 0.7)}`, () => { if ((s.animals[name] ?? 0) > 0) { s.animals[name]--; this.credit(price * 0.7); } }, !(s.animals[name] > 0)),
    ]));
    for (const [name, price, purpose] of MACHINES) result.push(this.card(name, `${purpose}. ${cash(price)} · owned equipment adds daily upkeep.`, [this.btn(s.machines.includes(name) ? "Owned" : "Buy", () => { if (!s.machines.includes(name) && this.pay(price)) s.machines.push(name); }, s.machines.includes(name))]));
    return result;
  }
  private uni(): HTMLElement[] {
    const s = this.s;
    const out = [countryside(s,"campus",(x)=>{ if(!s.degree){ this.message="Choose a qualification below to enrol."; } else if(x<700){s.quiz=s.credits%3;this.message=x<280?"Library notes ready. Read the study hint, then take your mock test.":"Your next course is ready in the exam studio.";}else if(this.pay(5)){this.sim().player.hunger=Math.min(1,this.sim().player.hunger+.2);this.sim().player.needs.social=Math.min(1,this.sim().player.needs.social+.1);this.message="Coffee and a catch-up with your study group.";} this.show("UC"); },this.sim().chars),this.card("Your degree arc", `${titleOf(s) || "Prospective student"} · completed: ${s.graduated.join(", ") || "none"}. Easy mock tests, free retries and a 20% wage boost per qualification level. This is fictional game progression.`)];
    if (!s.degree) {
      if (s.level >= 3) { out.push(this.card("Doctoral journey complete", "Your doctorate and wage boost are permanent in this saved game.")); return out; }
      for (const degree of DEGREES) out.push(this.card(degree, "Three game years, three short courses each year. Tuition $150. Correct answers earn credits; no timer.", [this.btn("Enrol", () => { if (this.pay(150)) { s.degree = degree; s.credits = 0; s.quiz = -1; } })]));
      return out;
    }
    const target = s.level === 0 ? 9 : s.level === 1 ? 6 : 9;
    const qualification = s.level === 0 ? "Bachelor" : s.level === 1 ? "Master" : "Doctorate";
    out.push(this.card(`${qualification} of ${s.degree}`, `Year ${Math.min(Math.floor(s.credits / 3) + 1, Math.ceil(target / 3))} · course credits ${s.credits}/${target}. Read the hint before answering.`, [
      this.btn("Study / mock test", () => { if (s.credits < target) s.quiz = s.credits % 3; }, s.credits >= target),
      this.btn("Graduate at Christchurch Town Hall", () => { if (s.credits < target) return; s.level = Math.min(3, s.level + 1); s.graduated.push(`${qualification} of ${s.degree}`); this.message = `Graduated! Your wage multiplier is now ${(1 + s.level * 0.2).toFixed(1)}×. Your title appears on the HUD.`; s.credits = 0; s.quiz = -1; if (s.level >= 3) s.degree = null; }, s.credits < target || s.level >= 3),
      this.btn("Campus cafe · $5", () => { if (this.pay(5)) { this.sim().player.hunger = Math.min(1, this.sim().player.hunger + 0.2); this.sim().player.reputation++; this.message = "A study group shares notes over coffee on the Ilam campus."; } }),
      this.btn("Withdraw", () => { s.degree = null; s.credits = 0; s.quiz = -1; this.message = "Withdrawn. Completed qualifications stay with you."; }),
    ]));
    if (s.quiz >= 0 && s.credits < target) {
      const [q, answers, correct] = QUESTIONS[s.degree][s.quiz];
      out.push(this.card(q, `Study hint: ${answers[correct]}. Choose the matching answer.`, answers.map((a, i) => this.btn(a, () => { this.message = passCourse(s, i) ? "Passed! One course completed." : "Try again. Read the study hint; there is no penalty."; }))));
    }
    return out;
  }
  private stable(): HTMLElement[] {
    const s = this.s, sim = this.sim(), horse = s.horse;
    if (!horse) return [countryside(s,"horse",undefined,sim.chars),this.card("Your own racehorse", "Buy a horse, build its fitness and earn wins against rival trainers. Championships take place at the fictional Horncastle Arena racing meet.", [this.btn("Buy horse · $800", () => { if (this.pay(800)) s.horse = { name: "Nor'wester", skill: 15, fitness: 60, wins: 0, tier: 0, trained: -HOUR, raced: -HOUR }; })])];
    const nameInput = h("input", { value: horse.name, maxlength: 30, "aria-label": "Horse name", onchange: (e: Event) => { horse.name = (e.target as HTMLInputElement).value.trim().slice(0, 30) || "Nor'wester"; } });
    return [countryside(s,"horse",undefined,sim.chars),nameInput, this.card(horse.name, `Skill ${horse.skill}/100 · fitness ${horse.fitness}/100 · ${horse.wins} wins · Form ${(horse.history??[]).slice(-5).map(r=>r.position).join("–")||"unraced"} · ${["Club", "Regional", "Championship", "Champion"][horse.tier]}. Training and racing each have a one-hour game cooldown.`, [
      this.btn("Train · $25", () => { if (sim.tick - horse.trained < HOUR || !this.pay(25)) return; horse.trained = sim.tick; horse.skill = Math.min(100, horse.skill + 8); horse.fitness = Math.max(0, horse.fitness - 8); this.message = "Trackwork improves your horse's skill. Remember to rest."; }, sim.tick - horse.trained < HOUR),
      this.btn("Feed and rest · $15", () => { if (this.pay(15)) horse.fitness = Math.min(100, horse.fitness + 20); }, horse.fitness >= 100),
      this.btn("Race rivals · $40", () => {
        if (sim.tick - horse.raced < HOUR || horse.fitness < 30 || this.race&&!this.race.settled || !this.pay(40)) return;
        if(this.race&&!this.race.settled){this.message="Finish the current race first.";return;}
        horse.raced = sim.tick;
        const field=raceRoster(horse);
        this.race={sport:"Trainer race",order:[0,1,2,3,4,5],duration:2700,until:sim.tick+2700,names:field.map(r=>r.name),owned:0,selected:0,skills:field.map(r=>r.skill),fitness:field.map(r=>r.fitness),stake:40,payout:0,settled:false,trainer:true,physics:newHorseRace(field,sim.tick,Math.random,sim.env.raining)};
        this.message="At the starting gates. Acceleration, stamina and race tactics decide the result; your prize is paid after the finish.";
      }, sim.tick - horse.raced < HOUR || horse.fitness < 30),
    ]), ...this.raceView()];
  }
  private raceView(): HTMLElement[] {
    return [raceScene(this.race,()=>this.sim().tick,this.game==='Chook fighting'?'Chook':this.betSport,this.sim().chars,raceRoster(this.s.horse,this.betSport))];
  }

  private settle(stake: number, payout: number, text: string) {
    this.credit(payout); this.s.loyalty++; this.s.jackpot += Math.round(stake * 0.02 * 100) / 100;
    this.message = `${text}. Return ${cash(payout)} · net ${cash(payout - stake)}.`;
  }
  private wager(fn: (n: number) => { payout: number; text: string }) {
    const n = this.stake; if (!this.pay(n)) return;
    const r = fn(n); this.settle(n, r.payout, r.text);
  }
  private casinoFloor():HTMLElement {
    const t=this.s.casino.tournament;
    return h("article.ax-card.ax-floor",null,[h("h3",{text:"Tessera tournament floor"}),casinoArt("Tournament",()=>({game:"Tournament",values:this.s.casino.tournamentCards??[],labels:[],stake:25,payout:0,result:t?`Score ${t.score} · round ${t.round}/3`:"Enter the dealer challenge",at:0}),()=>this.s,()=>this.sim().tick),h("p",{text:t?`Three-round dealer challenge · round ${Math.min(3,t.round)}/3 · score ${t.score}. Beat 21 points for a $100 prize. Play is saved with your slot.`:"Dealers are running a three-round, play-money high-card tournament. Entry $25; beat 21 points for a $100 return."}),this.btn(!t||t.paid?"Enter tournament · $25":"Deal tournament hand",()=>{
      if(!t||t.paid){if(this.pay(25)){this.s.casino.tournament={round:0,score:0,paid:false};this.s.casino.tournamentCards=[];}return;}
      const card=1+pick(13);(this.s.casino.tournamentCards??=[]).push(card);t.round++;t.score+=card;this.message=`Dealer draws ${card}. Score ${t.score}.`;
      if(t.round>=3){t.paid=true;const prize=t.score>21?100:0;this.settle(25,prize,`Tournament complete: ${t.score} points`);}
    })]);
  }
  private betting(): HTMLElement[] {
    this.credit(settleRace(this.s,this.sim().tick));
    const amount = h("input", { type: "number", min: 1, max: 500, step: 1, value: this.stake, "aria-label": "Stake in game dollars", onchange: (e: Event) => { this.stake = Math.max(1, Math.min(500, Math.floor(+(e.target as HTMLInputElement).value || 1))); } });
    const out = [h("label", null, ["Stake · $1–$500 in fictional game money", amount]), this.card("Pocket Tessera", `Play anywhere. Loyalty ${this.s.loyalty} · scratch jackpot ${cash(this.s.jackpot)}. Outcomes are random and losses are possible.`, [this.btn("Claim loyalty perk · 25 points", () => { if (this.s.loyalty >= 25) { this.s.loyalty -= 25; this.credit(10); this.message = "$10 loyalty credit collected."; } }, this.s.loyalty < 25)]),
      this.card("Baccarat", "Player pays 1:1, Banker 0.95:1, Tie 8:1. Non-tie bets push on a tie. Standard third-card rules.", ["Player", "Banker", "Tie"].map(side => this.btn(side, () => this.wager(n => { const d=dealBaccarat(),winner=d.p===d.b?"Tie":d.p>d.b?"Player":"Banker",payout=winner===side?n*(side==="Tie"?9:side==="Banker"?1.95:2):winner==="Tie"&&side!=="Tie"?n:0,text=`Player ${d.p} · Banker ${d.b} · ${winner}`; this.record("Baccarat",[d.player.length,...d.player,...d.banker],text,payout);return {payout,text}; })))),
      this.card("Craps · pass line", this.point ? `Point is ${this.point}. Original stake ${cash(this.pointStake)} stays on the table; make the point before a 7.` : "Come-out 7/11 wins, 2/3/12 loses. Otherwise establish a point, then roll it before 7. Pays 1:1.", [this.btn(this.point ? "Roll point" : "Come-out roll", () => {
        if (!this.point) { if (!this.pay(this.stake)) return; this.pointStake = this.stake; }
        const d1=1+pick(6),d2=1+pick(6),roll=d1+d2,n=this.pointStake;this.record("Craps",[d1,d2],`Rolled ${roll}`);
        if (!this.point && [7,11].includes(roll) || this.point && roll === this.point) { this.point = 0; this.settle(n, n*2, `Rolled ${roll}, pass wins`); }
        else if (!this.point && [2,3,12].includes(roll) || this.point && roll === 7) { this.point = 0; this.settle(n, 0, `Rolled ${roll}, pass loses`); }
        else { this.point ||= roll; this.message = `Rolled ${roll}. Point ${this.point} is still live.`; }
      })]),
      this.card("Big wheel", "24 equal sectors: 12 blanks, 6 ×2, 3 ×3, 2 ×5 and one ×8. Multipliers include your stake.", [this.btn("Spin", () => this.wager(n => { const r = pick(24), m = r < 12 ? 0 : r < 18 ? 2 : r < 21 ? 3 : r < 23 ? 5 : 8; this.record("Big wheel",[r],`Wheel ×${m}`,n*m);return { payout: n*m, text: `Wheel ×${m}` }; }))]),
      this.card("Scratchies", "Rub all three silver panels to reveal a matching trio. Prizes include the stake. Jackpot odds 1 in 1000; other prizes ×2–×20.", [this.btn(this.s.casino.scratch&&!this.s.casino.scratch.paid?"Ticket in progress":"Buy scratchcard", () => {const old=this.s.casino.scratch;if(old&&!old.paid)return;if(this.pay(this.stake)){this.s.casino.scratch=makeScratch(this.stake,this.s.jackpot,Math.random,this.design);if(this.s.casino.scratch.symbols[0]===0&&this.s.casino.scratch.payout){this.s.jackpot=1000;}this.message="Ticket ready. Scratch the three panels below.";}},!!this.s.casino.scratch&&!this.s.casino.scratch.paid)]),
    ];
    out.push(this.card("Chook fighting · cartoon arena", "Two rival roosters square off in a slapstick, non-graphic bout. Back red or blue. A win returns ×1.9 including stake; a loss returns zero.", [0,1].map(side => this.btn(side === 0 ? "Back red chook" : "Back blue chook", () => this.wager(n => {
      const winner=pick(2); if(!this.race||this.race.settled)this.race={sport:"Chook", order:[winner,1-winner], duration:1800,until:this.sim().tick+1800, names:["Red Rooster","Blue Bandit"],stake:n,payout:0,settled:true};
      return {payout:winner===side?n*1.9:0,text:`${winner===0?"Red Rooster":"Blue Bandit"} wins the chook bout`};
    })))));
    const numbers = Array.from({length:40},(_,i)=>i+1).map(i => this.btn((this.keno.has(i) ? "✓ " : "") + i, () => { if (this.keno.has(i)) this.keno.delete(i); else if (this.keno.size < 5) this.keno.add(i); }));
    out.push(this.card("Keno · pick five", "Select 5 from 40. Ten balls drawn. 3 matches ×2, 4 ×10, 5 ×50. All other results lose.", [this.btn("Draw balls", () => this.wager(n => { const balls = Array.from({length:40},(_,i)=>i+1); for (let i=39;i>0;i--) { const j=pick(i+1); [balls[i],balls[j]]=[balls[j],balls[i]]; } const draw=balls.slice(0,10), hits=draw.filter(x=>this.keno.has(x)).length; this.record("Keno",draw,`${hits} matching balls`);return { payout:n*([0,0,0,2,10,50][hits]), text:`Balls ${draw.join(", ")} · ${hits} matches` }; }), this.keno.size !== 5)]), h("div.ax-numbers", null, numbers));
    const active = this.crash && !this.crash.paid;
    out.push(this.card("Crash", "Buy a flight, then cash out before it crashes. ×1.49 at 2s, ×2.23 at 4s, ×3.32 at 6s of running simulation. Pausing also pauses the flight. Closing the panel never refunds a flight.", [
      this.btn("Launch", () => { if (active || !this.pay(this.stake)) return; this.crash = { stake:this.stake, start:this.sim().tick, bust:Math.max(1,0.96/(1-Math.random())), paid:false }; this.message="Flight launched. Choose a cash-out time."; }, !!active),
      ...[0].map(seconds => this.btn("Cash out now", () => {
        const flight=this.crash; if (!flight || flight.paid) return;
        const elapsed=(this.sim().tick-flight.start)/60;
        if (elapsed<seconds) { this.message=`Flight still climbing: ${elapsed.toFixed(1)}s. Wait until ${seconds}s, then tap again.`; return; }
        flight.paid=true; const m=Math.exp(elapsed*0.2),payout=m<flight.bust?Math.floor(flight.stake*m*100)/100:0,text=m<flight.bust?`Cashed out ×${m.toFixed(2)}`:`Crashed at ×${flight.bust.toFixed(2)}`; this.record("Crash",[Math.min(m,flight.bust)],text,payout);this.settle(flight.stake,payout,text);
      }, !active)),
      this.btn("Abandon flight", () => { const f=this.crash; if (f && !f.paid) { f.paid=true; this.settle(f.stake,0,"Flight abandoned"); } }, !active),
    ]));
    const select = (label: string, values: string[], current: string, set: (v:string)=>void) => h("label", null, [label,h("select", {onchange:(e:Event)=>set((e.target as HTMLSelectElement).value)}, values.map(v=>h("option",{value:v,selected:v===current,text:v})))]);
    const roster=raceRoster(this.s.horse,this.betSport);
    out.push(select("Race",["Horse","Greyhound","Chook"],this.betSport,v=>this.betSport=v),select("Bet",["Win","Place","Exacta"],this.betType,v=>this.betType=v),select("Runner",roster.map((r,i)=>`${i+1} · ${r.name}${r.owned?" · YOUR HORSE":""}`),`${this.racer+1} · ${roster[this.racer].name}${roster[this.racer].owned?" · YOUR HORSE":""}`,v=>this.racer=parseInt(v)-1));

    out.push(this.card("Race book", `Fitness and skill determine each runner’s chance. Your selected ${this.betType.toLowerCase()} return is ×${raceReturn(roster,this.racer,this.betType)} including stake. Exacta: selected runner first, next number second. Race progress and your bet are saved.`, [this.btn("Bet and race", () => {
      if(this.race&&!this.race.settled){this.message="Your current race must finish first.";return;}
      const n=this.stake;if(!this.pay(n))return;
      const order=raceOrder(roster);
      const win=this.betType==="Win" ? order[0]===this.racer : this.betType==="Place" ? order.slice(0,2).includes(this.racer) : order[0]===this.racer && order[1]===(this.racer+1)%6;
      this.race={sport:this.betSport,order,duration:1800,until:this.sim().tick+1800,names:roster.map(r=>r.name),owned:roster.findIndex(r=>r.owned),selected:this.racer,skills:roster.map(r=>r.skill),fitness:roster.map(r=>r.fitness),stake:n,payout:win?Math.round(n*raceReturn(roster,this.racer,this.betType)*100)/100:0,settled:false,...(this.betSport==='Horse'?{physics:newHorseRace(roster,this.sim().tick,Math.random,this.sim().env.raining),betType:this.betType,returnMultiplier:raceReturn(roster,this.racer,this.betType),payout:0,duration:2700,until:this.sim().tick+2700}:{})};
      this.message="They're off! Your bet and race progress are saved, even if you close the phone.";
    },!!this.race&&!this.race.settled)]),...this.raceView());
    const games=["Scratchies","Baccarat","Craps","Big wheel","Keno","Crash","Race book","Chook fighting","Tournament"];
    const nav=h('label.ax-game-select',null,['Game',h('select',{'aria-label':'Choose a game',onchange:(e:Event)=>{this.game=(e.target as HTMLSelectElement).value;this.show(this.home);}},games.map(name=>h('option',{value:name,selected:name===this.game,text:name})))]);
    const selected=out.filter(el=>el.querySelector("h3")?.textContent?.startsWith(this.game));
    const scene=this.game==="Scratchies" ? (this.s.casino.scratch?scratchArt(this.s.casino.scratch,i=>{const ticket=this.s.casino.scratch!;const was=ticket.paid,payout=revealScratch(ticket,i);if(!was&&ticket.paid){this.settle(ticket.stake,payout,payout?"Matching trio!":"No matching trio");this.toast(this.message);const status=this.modal.el.querySelector(".ax-status");if(status)status.textContent=cash(this.sim().player.cash)+" · "+this.message;const next=this.btn("Buy another scratchcard",()=>{if(this.pay(this.stake)){this.s.casino.scratch=makeScratch(this.stake,this.s.jackpot,Math.random,this.design);if(this.s.casino.scratch.symbols[0]===0&&this.s.casino.scratch.payout)this.s.jackpot=1000;}});const actions=this.modal.el.querySelector(".ax-card .ax-actions");actions?.replaceChildren(next);}}):casinoArt("Scratchies",()=>undefined,()=>this.s,()=>this.sim().tick,this.aircraft)) : ["Race book","Chook fighting"].includes(this.game)?null:casinoArt(this.game,()=>this.s.casino.result,()=>this.s,()=>this.sim().tick,this.aircraft);
    const extra=this.game==='Scratchies'?h('label',null,['Ticket design',h('select',{'aria-label':'Scratchcard design',onchange:(e:Event)=>{this.design=+(e.target as HTMLSelectElement).value;}},SCRATCHCARDS.map(d=>h('option',{value:d.id,selected:d.id===this.design,text:d.name})))]):this.game==='Crash'?h('label',null,['Aircraft & route',h('select',{'aria-label':'Crash aircraft',disabled:!!active,onchange:(e:Event)=>{this.aircraft=+(e.target as HTMLSelectElement).value;this.show(this.home);}},AIRCRAFT.map((a,i)=>h('option',{value:i,selected:i===this.aircraft,text:a.name+' · '+a.type})))]):null;
    const controls=h('section.ax-deck',null,[out[0],nav,extra,...(this.game==='Tournament'?[]:selected),...(this.game==='Keno'?out.filter(el=>el.classList.contains('ax-numbers')):[]),...(this.game==='Race book'?out.filter(el=>el.tagName==='LABEL').slice(1):[])]);
    return [this.game==='Tournament'?this.casinoFloor():scene??this.raceView()[0],controls];
  }
}
