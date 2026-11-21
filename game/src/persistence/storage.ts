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

/**
 * Saves that never say "Browser full". localStorage holds about 5 MB, which a big city save can pass; IndexedDB holds hundreds.
 * Everything stays synchronous for the game: values live in memory (loaded once at start by init()), are written to IndexedDB in
 * the background, and are also mirrored to localStorage when they fit. Old localStorage saves are picked up and moved over.
 */
const DB_NAME = "mosaics-world-db", DB_STORE = "kv";
export class HybridStorageProvider implements StorageProvider {
  private m = new Map<string, string>();
  private db: IDBDatabase | null = null;
  private local = new LocalStorageProvider();

  async init(): Promise<void> {
    try {
      this.db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(DB_STORE);
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error("blocked"));
      });
      await new Promise<void>((res) => {
        const tx = this.db!.transaction(DB_STORE, "readonly"), req = tx.objectStore(DB_STORE).openCursor();
        req.onsuccess = () => { const c = req.result; if (c) { if (typeof c.value === "string") this.m.set(String(c.key), c.value); c.continue(); } else res(); };
        req.onerror = () => res();
      });
    } catch { this.db = null; }
    // anything saved the old way is picked up (and copied into IndexedDB so it survives future quota trouble)
    for (const k of this.local.keys(NS)) { if (!this.m.has(k)) { const v = this.local.get(k); if (v !== null) { this.m.set(k, v); this.put(k, v); } } }
  }
  private put(key: string, value: string): void {
    if (!this.db) return;
    try { const tx = this.db.transaction(DB_STORE, "readwrite"); tx.objectStore(DB_STORE).put(value, key); tx.onerror = () => { /* the in-memory copy and localStorage still hold it */ }; } catch { /* ignore */ }
  }
  get(key: string): string | null { return this.m.get(key) ?? this.local.get(key); }
  set(key: string, value: string): boolean {
    this.m.set(key, value); this.put(key, value);
    const mirrored = this.local.set(key, value);
    if (!mirrored) this.local.remove(key);          // too big for localStorage: drop the stale copy so it can't be read back instead of the new save
    return mirrored || !!this.db;                   // only a failure when there is nowhere at all to keep it
  }
  remove(key: string): void {
    this.m.delete(key); this.local.remove(key);
    if (this.db) { try { this.db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).delete(key); } catch { /* ignore */ } }
  }
  keys(prefix: string): string[] { return [...new Set([...this.m.keys(), ...this.local.keys(prefix)])].filter((k) => k.startsWith(prefix)); }
}
export const appStorage = new HybridStorageProvider();
