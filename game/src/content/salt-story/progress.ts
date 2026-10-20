export interface SaltProgress { position: number; furthest: number }
export const newSaltProgress = (): SaltProgress => ({ position: 0, furthest: 0 });
export function restoreSaltProgress(value: unknown): SaltProgress {
  const v = value as Partial<SaltProgress> | null;
  const safe = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? Math.min(100000, n) : 0;
  const furthest = safe(v?.furthest);
  return { position: Math.min(safe(v?.position), furthest), furthest };
}
