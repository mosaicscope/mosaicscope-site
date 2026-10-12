/** Collision layers (what I am) and masks (what I collide with). */
export const LAYER = { CHAR: 1, TOY: 2, PROJECTILE: 4, HEAVY: 8, WORLD: 16 } as const;
export const MASK = {
  CHAR: LAYER.TOY | LAYER.PROJECTILE | LAYER.HEAVY | LAYER.WORLD | LAYER.CHAR,
  TOY: LAYER.CHAR | LAYER.TOY | LAYER.HEAVY | LAYER.WORLD,
  /** darts hit people and the world, never each other */
  PROJECTILE: LAYER.CHAR | LAYER.HEAVY | LAYER.WORLD,
  HEAVY: LAYER.CHAR | LAYER.TOY | LAYER.PROJECTILE | LAYER.HEAVY | LAYER.WORLD,
} as const;

export function canCollide(aLayer: number, aMask: number, bLayer: number, bMask: number): boolean {
  return (aMask & bLayer) !== 0 && (bMask & aLayer) !== 0;
}
