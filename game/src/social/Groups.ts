import { Character } from "../entities/types";
import { friendship } from "./Social";

/** Friend groups: formed from mutual affection + proximity, led by the most confident member. */
export interface Group { id: number; members: number[]; leader: number; mood: number; formed: number; activity: string }

export class GroupSystem {
  groups = new Map<number, Group>();
  private nextId = 1;

  /** Re-evaluate groups occasionally (cheap: only principal + mid characters with real edges). */
  update(chars: Character[], tick: number): void {
    // dissolve groups whose members drifted apart or fell out
    for (const g of this.groups.values()) {
      const leader = chars[g.leader];
      g.members = g.members.filter((id) => {
        const c = chars[id];
        if (!c || c.group !== g.id) return false;
        if (id === g.leader) return true;
        const keep = friendship(c.rel.get(g.leader)) > 0.12 && Math.hypot(c.x - leader.x, c.y - leader.y) < 14;
        if (!keep) c.group = -1;
        return keep;
      });
      if (g.members.length < 2) { for (const id of g.members) chars[id].group = -1; this.groups.delete(g.id); continue; }
      let mood = 0; for (const id of g.members) mood += chars[id].emo.mood; g.mood = mood / g.members.length;
      // leadership goes to the most confident
      let best = g.leader;
      for (const id of g.members) if (chars[id].emo.confidence > chars[best].emo.confidence + 0.15) best = id;
      g.leader = best;
    }
    // form: a confident, sociable character with nearby friends starts a group
    for (const c of chars) {
      if (c.group >= 0 || (c.tier !== "principal" && c.tier !== "mid") || c.pers.sociability < 0.35) continue;
      const friends: number[] = [];
      for (const [id, r] of c.rel) {
        const o = chars[id];
        if (!o || o.group >= 0 || o.tier === "background" || o.tier === "player") continue;
        if (friendship(r) > 0.25 && friendship(o.rel.get(c.id)) > 0.15 && Math.hypot(o.x - c.x, o.y - c.y) < 8) friends.push(id);
      }
      if (friends.length >= 1) {
        const g: Group = { id: this.nextId++, members: [c.id, ...friends.slice(0, 4)], leader: c.id, mood: c.emo.mood, formed: tick, activity: "hang" };
        for (const id of g.members) chars[id].group = g.id;
        this.groups.set(g.id, g);
      }
    }
  }

  get(id: number): Group | undefined { return this.groups.get(id); }
  restore(groups: Group[]): void { this.groups.clear(); for (const g of groups) { this.groups.set(g.id, g); this.nextId = Math.max(this.nextId, g.id + 1); } }
}
