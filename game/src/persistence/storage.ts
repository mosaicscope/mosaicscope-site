/** Storage provider interface so saves can later move to IndexedDB or a server without touching game code. */
export interface StorageProvider {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
  keys(prefix: string): string[];
}

/** localStorage wrapper: every access guarded (private mode, blocked storage, quota). */
export class LocalStorageProvider implements StorageProvider {
  get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
  set(key: string, value: string): boolean { try { localStorage.setItem(key, value); return true; } catch { return false; } }
  remove(key: string): void { try { localStorage.removeItem(key); } catch { /* ignore */ } }
  keys(prefix: string): string[] {
    try { const out: string[] = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefix)) out.push(k); } return out; } catch { return []; }
  }
}

/** In-memory provider (tests, or when browser storage is unavailable). */
export class MemoryStorageProvider implements StorageProvider {
  private m = new Map<string, string>();
  get(key: string) { return this.m.get(key) ?? null; }
  set(key: string, value: string) { this.m.set(key, value); return true; }
  remove(key: string) { this.m.delete(key); }
  keys(prefix: string) { return [...this.m.keys()].filter((k) => k.startsWith(prefix)); }
}

/** All keys are namespaced so the game never touches the main site's storage. */
export const NS = "mosaics-world:";
