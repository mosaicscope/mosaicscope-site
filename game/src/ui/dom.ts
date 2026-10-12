/** Tiny DOM builder: h("div.panel", { onclick }, [children]). Text is always set via textContent (no HTML injection). */
type Attrs = Record<string, any>;
export function h(sel: string, attrs: Attrs | null = null, kids: (Node | string | null | undefined | false)[] = []): HTMLElement {
  const [tag, ...cls] = sel.split(".");
  const el = document.createElement(tag || "div");
  if (cls.length) el.className = cls.join(" ");
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "text") el.textContent = String(v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(typeof c === "string" ? document.createTextNode(c) : c);
  return el;
}

export function meter(label: string, v: number, invert = false): HTMLElement {
  const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
  const good = invert ? 1 - v : v;
  return h("div.meter", null, [h("span", { text: label }), h("div.track", null, [h("div.fill" + (good < 0.25 ? ".bad" : good < 0.5 ? ".warn" : ""), { style: { width: pct + "%" } })]), h("span.num", { text: String(pct) })]);
}

export function fmtHour(hour: number): string {
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
