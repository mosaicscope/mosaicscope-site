/**
 * Street litter. Cans and bottles are redeemable at the recycling centre; wrappers and cups are
 * just the mess a real city leaves behind. Fictional, brand-free: drinks are drawn as plain colour bands.
 */
export type LitterKind = "can" | "bottle" | "wrapper" | "cup";
export type Recyclable = "can" | "bottle";

export interface LitterDef { kind: LitterKind; name: string; plural: string; value: number; tones: string[]; weight: number }

export const LITTER: Record<LitterKind, LitterDef> = {
  can: { kind: "can", name: "empty can", plural: "cans", value: 0.1, tones: ["#d8b24a", "#4fa05a", "#c4453a", "#5a8fc4", "#b8bcc2"], weight: 40 },
  bottle: { kind: "bottle", name: "glass bottle", plural: "bottles", value: 0.2, tones: ["#5a3a1c", "#2f7d4a", "#9fd0c8"], weight: 22 },
  wrapper: { kind: "wrapper", name: "wrapper", plural: "wrappers", value: 0, tones: ["#eee4d3", "#f6b62c", "#ec2a1c"], weight: 22 },
  cup: { kind: "cup", name: "takeaway cup", plural: "cups", value: 0, tones: ["#eee4d3", "#c08040"], weight: 16 },
};
export const LITTER_KINDS = Object.keys(LITTER) as LitterKind[];
export const isRecyclable = (k: LitterKind): k is Recyclable => LITTER[k].value > 0;

/** Most pieces one person can carry in a sack. */
export const SACK_CAP = 60;
/** Cash in this many pieces at once and the centre adds a tidy-up bonus. */
export const BULK_MIN = 20;
export const BULK_BONUS = 0.25;
