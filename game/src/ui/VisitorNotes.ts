import { h } from "./dom";
import type { ModalHost } from "./Modals";
import { fetchVisitorNotes, postVisitorNote, type VisitorNote } from "../social/Visitors";

/** Visitor notes panel: read what earlier visitors left, and leave one of your own. Loaded on demand. */
export function openVisitorNotes(modal: ModalHost): void {
  const list = h("div.notes-list", null, [h("p", { text: "Loading notes…" })]);
  const status = h("p.notes-status", { role: "status" });
  const input = h("input", { type: "text", maxlength: "140", placeholder: "Leave a note for the next visitor", "aria-label": "Your note" }) as HTMLInputElement;
  const nameIn = h("input", { type: "text", maxlength: "24", placeholder: "Name (optional)", "aria-label": "Your name" }) as HTMLInputElement;

  const render = (notes: VisitorNote[]) => {
    list.replaceChildren(...(notes.length
      ? notes.map((n) => h("div.note", null, [h("b", { text: n.name }), " ", h("span", { text: n.text })]))
      : [h("p", { text: "No notes yet. Be the first." })]));
  };
  const load = () => fetchVisitorNotes().then(render);

  const send = h("button.btn", {
    text: "Post",
    onclick: async () => {
      const text = input.value.trim();
      if (!text) return;
      status.textContent = "Posting…";
      const ok = await postVisitorNote(text, nameIn.value.trim());
      status.textContent = ok ? "Posted. Thanks!" : "Couldn't post right now. Try again later.";
      if (ok) { input.value = ""; void load(); }
    },
  });

  modal.show("Visitor notes", [h("div.notes", null, [list, h("div.notes-form", null, [nameIn, input, send]), status])], "notes");
  void load();
}
