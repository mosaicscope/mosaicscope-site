import { addTopics, type TalkCtx } from "../dialogue/playerTalk";
import { dealerInfo, hireDecision, playerBuy, playerHire, workerInfo } from "./Underworld";
import { isInfected, isPsychotic, supportNpc } from "./Health";
import { impairment } from "./Substances";

/**
 * What you can say to people in the street economy. Each answer is decided once (the reply is built before the effect
 * runs) and the effect carries it out, so the words and the outcome always agree. A "no" is always respected.
 */
const decided = new WeakMap<TalkCtx, boolean>();

addTopics([
  { id: "t_buy", labels: () => ["Got anything for me?", "I'm looking to buy.", "You selling?"],
    score: (t) => (dealerInfo(t.sim, t.npc.id) && t.p.cash >= dealerInfo(t.sim, t.npc.id)!.price && t.hostile < 0.4 ? 0.7 : 0),
    reply: (t) => {
      const info = dealerInfo(t.sim, t.npc.id)!, wary = t.stranger && t.sim.rng.next() < 0.5;   // dealers are careful with faces they don't know
      decided.set(t, !wary && !t.sim.world.areaAt(t.npc.x, t.npc.y)?.name?.includes("Police"));
      return decided.get(t) ? [`Sure. ${info.price}. Keep it quiet.`, "Here you go. You didn't get it from me."] : ["Don't know you. Walk on.", "Not today."];
    },
    effect: (t) => { if (decided.get(t)) playerBuy(t.sim, t.npc); } },
  { id: "t_hire", labels: () => ["Are you available for hire?", "Could I take you out, my treat?"],
    score: (t) => (workerInfo(t.sim, t.npc.id) && t.p.cash >= workerInfo(t.sim, t.npc.id)!.price && t.hostile < 0.5 ? 0.6 : 0),
    reply: (t) => {
      const ok = hireDecision(t.sim, t.npc); decided.set(t, ok);
      if (ok) return ["All right. Somewhere private, then.", "Okay. You pay, and we go. No funny business."];
      return impairment(t.p) >= 0.4 ? ["Not like this. Come back when you're sober."] : ["No. That's my answer.", "Not interested."];   // a no is final
    },
    effect: (t) => { if (decided.get(t)) playerHire(t.sim, t.npc); } },
  { id: "t_sit", labels: (t) => [isPsychotic(t.sim, t.npc.id) ? "Hey. I'm here. Take your time." : "You don't look well. Want to sit a minute?", "Sit with them and listen"],
    score: (t) => (isPsychotic(t.sim, t.npc.id) || isInfected(t.sim, t.npc.id) ? 0.9 : 0),
    reply: (t) => isPsychotic(t.sim, t.npc.id) ? ["Thank you. It's so loud in my head. Stay a bit?", "I thought everyone was against me. You're not, are you?"] : ["I've felt rotten for days. Thanks for asking.", "Yeah... I don't think I'm okay."],
    effect: (t) => supportNpc(t.sim, t.npc, false), follow: ["t_see_someone"] },
  { id: "t_see_someone", labels: () => ["Maybe you should see someone about it.", "There's a clinic. I'll point you there."], score: () => 0,
    reply: (t) => t.npc.pers.kindness > 0.2 ? ["...Yeah. Maybe. I'll go.", "Okay. Okay, I'll try."] : ["I'll think about it."],
    effect: (t) => supportNpc(t.sim, t.npc, true) },
]);
