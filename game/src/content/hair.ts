export const HAIR_FAMILIES = [
  'Close crop', 'Taper fade', 'High fade', 'Flat top', 'Textured crop',
  'Quiff', 'Side part', 'Slick back', 'Undercut', 'Finger waves',
  'Tight coils', 'Afro', 'Twist out', 'Locs', 'Cornrows',
  'Box braids', 'Feed-in braids', 'Twists', 'Bob', 'Long straight',
  'Long waves', 'High ponytail', 'Twin tails', 'High bun', 'Double buns',
] as const;
export interface HairVariant { id: `hair-${number}`; label: string; family: number; variation: number; length: number; volume: number; part: number; strands: number }
/** 25 silhouettes × 20 cuts. Geometry varies independently of skin, gender and behaviour. */
export const HAIR_VARIANTS: readonly HairVariant[] = HAIR_FAMILIES.flatMap((family, f) => Array.from({ length: 20 }, (_, v) => ({
  id: `hair-${f * 20 + v}` as const, label: `${family} · ${v + 1}`, family: f, variation: v,
  length: .18 + (v % 5) * .17, volume: .12 + Math.floor(v / 5) * .12,
  part: (Math.floor(v / 5) - 1.5) * .22, strands: 5 + v % 5 + Math.floor(v / 5) * 2,
})));
export function hairVariant(id: string): HairVariant | null {
  const match = /^hair-(\d{1,3})$/.exec(id);
  return match ? HAIR_VARIANTS[+match[1]] ?? null : null;
}
