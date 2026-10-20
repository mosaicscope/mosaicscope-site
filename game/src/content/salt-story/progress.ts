export interface SaltProgress { position: number; furthest: number; decisions?:Record<string,number> }
export const newSaltProgress = (): SaltProgress => ({ position: 0, furthest: 0 });
export function restoreSaltProgress(value: unknown): SaltProgress {
  const v = value as Partial<SaltProgress> | null;
  const safe = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? Math.min(100000, n) : 0;
  const furthest = safe(v?.furthest);
  const decisions=Object.fromEntries(Object.entries(v?.decisions??{}).filter(([k,n])=>/^\d{1,3}$/.test(k)&&[0,1,2].includes(n)).slice(0,100));
  return { ...(Object.keys(decisions).length?{decisions}:{}), position: Math.min(safe(v?.position), furthest), furthest };
}
