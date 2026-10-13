/** Client for visitor notes (functions/api/notes.js). Failures are silent: the game never depends on the network. */
export interface VisitorNote { id: string; name: string; text: string; t: number }

export async function fetchVisitorNotes(): Promise<VisitorNote[]> {
  try {
    const res = await fetch("/api/notes", { cache: "no-cache" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.notes) ? data.notes : [];
  } catch { return []; }
}

export async function postVisitorNote(text: string, name: string): Promise<boolean> {
  try {
    const res = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, name }) });
    return res.status === 201;
  } catch { return false; }
}
