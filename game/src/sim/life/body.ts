export const BODY_UPGRADES = [
  { id: "basic", name: "Basic gym", cost: 60, effect: "10% more fitness per workout" },
  { id: "pro", name: "Pro gym", cost: 180, effect: "25% more fitness per workout" },
  { id: "iron", name: "Iron Pukeko gym", cost: 400, effect: "50% more fitness per workout" },
  { id: "shoes", name: "Running shoes", cost: 80, effect: "40% less sprint fatigue" },
  { id: "brace", name: "Posture brace", cost: 65, effect: "Faster recovery from stumbles while carrying toys" },
  { id: "reflex", name: "Skate park reflex training", cost: 90, effect: "30% faster stumble recovery" },
  { id: "ice", name: "Ice pack kit", cost: 35, effect: "Twice as fast sprain recovery" },
  { id: "vitamins", name: "Vitamin subscription", cost: 120, effect: "Small hourly energy boost; prepaid lifetime supply" },
  { id: "earplugs", name: "Club earplugs", cost: 20, effect: "Protect hearing at parties" },
  { id: "mouthguard", name: "Mouthguard", cost: 30, effect: "Less severe blunt head injuries" },
  { id: "sunnies", name: "Sunnies", cost: 45, effect: "Reduce daytime glare slowdown" },
  { id: "jacket", name: "Rain jacket", cost: 70, effect: "Reduce rain slowdown" },
  { id: "stick", name: "Fake walking stick", cost: 25, effect: "Nearby rivals feel intimidated" },
] as const;
export type BodyUpgrade = typeof BODY_UPGRADES[number]["id"];
export interface BodyState { owned: BodyUpgrade[]; hearing: number }
export const newBody = (): BodyState => ({ owned: [], hearing: 1 });
export const hasBody = (body: BodyState, id: BodyUpgrade): boolean => body.owned.includes(id);
export function gymMultiplier(body: BodyState): number {
  return hasBody(body, "iron") ? 1.5 : hasBody(body, "pro") ? 1.25 : hasBody(body, "basic") ? 1.1 : 1;
}
export function bodyPace(body: BodyState, rain: boolean, daylight: number): number {
  return (rain ? hasBody(body, "jacket") ? 0.98 : 0.88 : 1) *
    (daylight > 0.8 ? hasBody(body, "sunnies") ? 1 : 0.96 : 1);
}
