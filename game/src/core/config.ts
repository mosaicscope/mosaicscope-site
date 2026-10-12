/** Every tunable budget in one typed place. Change these, not magic numbers in systems. */
export interface SimConfig {
  seed: number;
  worldSize: number;            // tiles per side
  midCount: number;             // tier-2 NPCs
  backgroundCount: number;      // tier-3 NPCs
  /** Max world events processed per tick (backpressure). */
  eventsPerTick: number;
  /** Max queued world events; lowest priority dropped beyond this. */
  eventQueueCap: number;
  /** Max causal chain depth (event caused by event caused by...). */
  maxCausalDepth: number;
  /** Max A* searches per tick; the rest wait in the path queue. */
  pathsPerTick: number;
  /** Max node expansions per A* search. */
  pathNodeBudget: number;
  /** Upper bound on any knockback impulse (toy-safe intensity). */
  maxImpulse: number;
  /** Distances (tiles) from the camera focus used to pick simulation LOD. */
  lodFull: number;
  lodReduced: number;
  lodGroup: number;
  lodBackground: number;
  maxParticles: number;
  maxToys: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  seed: 20251012,
  worldSize: 64,
  midCount: 80,
  backgroundCount: 420,
  eventsPerTick: 12,
  eventQueueCap: 256,
  maxCausalDepth: 5,
  pathsPerTick: 6,
  pathNodeBudget: 3000,
  maxImpulse: 9,
  lodFull: 14,
  lodReduced: 24,
  lodGroup: 36,
  lodBackground: 60,
  maxParticles: 700,
  maxToys: 160,
};

export interface FeatureFlags {
  weather: boolean;
  powerOutages: boolean;
  crafting: boolean;
  rumours: boolean;
  adaptiveQuality: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  weather: true, powerOutages: true, crafting: true, rumours: true, adaptiveQuality: true,
};
