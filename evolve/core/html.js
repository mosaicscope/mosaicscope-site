// A tiny tag scanner: enough to find and edit start tags in the site's hand-written HTML
// without a parser dependency. Skips comments, <script> and <style> bodies.

const SKIP = /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>/gi;
const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)(\s(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/g;
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/** Start tags in document order: { name, start, end, raw, attrs } (attrs keys are lower case). */
export function scanTags(text) {
  const masked = maskSkipped(text);
  const out = [];
  for (const m of masked.matchAll(TAG)) {
    const raw = text.slice(m.index, m.index + m[0].length);
    out.push({ name: m[1].toLowerCase(), start: m.index, end: m.index + m[0].length, raw, attrs: parseAttrs(m[2] || "") });
  }
  // script and style start tags themselves are still interesting (defer, async)
  for (const m of text.matchAll(/<(script|style)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)) {
    if (isInComment(text, m.index)) continue;
    out.push({ name: m[1].toLowerCase(), start: m.index, end: m.index + m[0].length, raw: m[0], attrs: parseAttrs(m[2] || "") });
  }
  return out.sort((a, b) => a.start - b.start);
}

function maskSkipped(text) {
  return text.replace(SKIP, (s) => " ".repeat(s.length));
}
function isInComment(text, i) {
  const open = text.lastIndexOf("<!--", i);
  return open !== -1 && text.indexOf("-->", open) > i;
}

export function parseAttrs(s) {
  const a = {};
  for (const m of s.matchAll(ATTR)) a[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return a;
}

/** Add an attribute to a raw start tag, before its closing > or />. */
export function addAttr(raw, name, value) {
  const esc = String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return raw.replace(/\s*(\/?)>$/, (_, slash) => ` ${name}="${esc}"${slash ? " /" : ""}>`);
}

/** Replace an attribute's value (or add it when missing). */
export function setAttr(raw, name, value) {
  const re = new RegExp(`(\\s${name}\\s*=\\s*)("[^"]*"|'[^']*'|[^\\s"'>]+)`, "i");
  return re.test(raw) ? raw.replace(re, `$1"${value}"`) : addAttr(raw, name, value);
}

/** Line number (1-based) of an index. */
export function lineOf(text, i) {
  let n = 1;
  for (let k = 0; k < i && k < text.length; k++) if (text.charCodeAt(k) === 10) n++;
  return n;
}

/** Short stable hash (FNV-1a) used for fingerprints. */
export function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/** Visible text of an element body (tags stripped, whitespace collapsed). */
export function textContent(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** The body between a start tag and its matching close tag (no nesting of the same tag assumed). */
export function innerOf(text, tag) {
  const close = text.indexOf(`</${tag.name}`, tag.end);
  return close === -1 ? "" : text.slice(tag.end, close);
}
