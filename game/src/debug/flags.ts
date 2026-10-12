export interface DebugFlags {
  collision: boolean; hitboxes: boolean; perception: boolean; paths: boolean; grid: boolean; tiers: boolean;
  labels: boolean; social: boolean; events: boolean; velocity: boolean; contacts: boolean;
}
export const DEBUG_LABELS: Record<keyof DebugFlags, string> = {
  collision: "Collision shapes", hitboxes: "Hitboxes", perception: "Perception radii", paths: "Navigation paths", grid: "Spatial grid",
  tiers: "Simulation tiers", labels: "AI state labels", social: "Social links", events: "Event origins", velocity: "Velocity vectors", contacts: "Contact points",
};
export const newDebugFlags = (): DebugFlags => ({ collision: false, hitboxes: false, perception: false, paths: false, grid: false, tiers: false, labels: false, social: false, events: false, velocity: false, contacts: false });
