// Local checks (no AI) and the small, reversible fixes each one allows.
// A rule finds problems in the site's files; each remedy is a deterministic edit the agents can pick.
// Agents never write code: they only choose a finding and a remedy from these lists.
//
// Remedy meta is scored 0..3: benefit (to visitors), perf, a11y, rel (reliability/SEO/robustness),
// complexity (cost to review), risk (chance of a visible regression).

import { scanTags, addAttr, setAttr, lineOf, hash, textContent, innerOf } from "./html.js";

const SITE = "https://mosaicscope.pages.dev";
const isHtml = (p) => p.endsWith(".html");
const humanise = (s) => String(s).replace(/\.[a-z0-9]+$/i, "").replace(/^.*\//, "").replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
const isNoindex = (text) => scanTags(text).some((t) => t.name === "meta" && (t.attrs.name || "").toLowerCase() === "robots" && /noindex/i.test(t.attrs.content || ""));

// A tag's identity survives the fixes made to it (adding alt, loading, rel...), so fingerprints stay stable.
const ident = (t) => `${t.name}:${t.attrs.id || t.attrs.src || t.attrs.href || t.attrs.name || ""}`;

function tagFinding(kind, path, text, tag, all, data = {}) {
  const id = ident(tag);
  const occ = all.filter((t) => ident(t) === id && t.start < tag.start).length;
  return { kind, path, line: lineOf(text, tag.start), fp: `${kind}|${path}|${hash(id)}|${occ}`, data: { id, occ, ...data } };
}

/** Find the tag a finding points at in (possibly changed) text. */
function locate(text, f) {
  let seen = 0;
  for (const t of scanTags(text)) if (ident(t) === f.data.id && seen++ === f.data.occ) return t;
  return null;
}
function editTag(files, f, fn) {
  const text = files[f.path];
  const t = text == null ? null : locate(text, f);
  if (!t) return null;
  const next = fn(t);
  if (!next || next === t.raw) return null;
  return { path: f.path, text: text.slice(0, t.start) + next + text.slice(t.end) };
}
function insertInHead(files, path, snippet) {
  const text = files[path];
  if (text == null) return null;
  const tags = scanTags(text);
  const anchor = tags.find((t) => t.name === "meta" && (t.attrs.name || "") === "viewport") || tags.find((t) => t.name === "meta" && "charset" in t.attrs) || tags.find((t) => t.name === "head");
  if (!anchor) return null;
  const indent = (text.slice(text.lastIndexOf("\n", anchor.start) + 1, anchor.start).match(/^\s*/) || [""])[0];
  return { path, text: text.slice(0, anchor.end) + "\n" + indent + snippet + text.slice(anchor.end) };
}
const headFinding = (kind, path, text, data = {}) => {
  const head = scanTags(text).find((t) => t.name === "head");
  return { kind, path, line: head ? lineOf(text, head.start) : 1, fp: `${kind}|${path}`, data };
};

export const RULES = [
  {
    kind: "img-alt", area: "a11y", weight: 3, label: "image has no alt text",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p)) {
        const tags = scanTags(text);
        for (const t of tags) if (t.name === "img" && !("alt" in t.attrs)) out.push(tagFinding(this.kind, p, text, t, tags));
      }
      return out;
    },
    remedies: [
      { id: "a", label: 'alt="" (decorative)', meta: { benefit: 2, perf: 0, a11y: 2, rel: 1, complexity: 0, risk: 0 }, apply: (fs, f) => editTag(fs, f, (t) => addAttr(t.raw, "alt", "")) },
      { id: "b", label: "alt from file name", meta: { benefit: 2, perf: 0, a11y: 3, rel: 1, complexity: 1, risk: 1 }, apply: (fs, f) => editTag(fs, f, (t) => t.attrs.src && humanise(t.attrs.src) ? addAttr(t.raw, "alt", humanise(t.attrs.src)) : null) },
    ],
  },
  {
    kind: "img-lazy", area: "perf", weight: 2, label: "image below the first loads eagerly",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p)) {
        const tags = scanTags(text);
        const imgs = tags.filter((t) => t.name === "img");
        imgs.slice(1).forEach((t) => { if (!("loading" in t.attrs) && !("fetchpriority" in t.attrs)) out.push(tagFinding(this.kind, p, text, t, tags)); });
      }
      return out;
    },
    remedies: [
      { id: "a", label: 'loading="lazy"', meta: { benefit: 1, perf: 2, a11y: 0, rel: 0, complexity: 0, risk: 1 }, apply: (fs, f) => editTag(fs, f, (t) => addAttr(t.raw, "loading", "lazy")) },
      { id: "b", label: 'loading="lazy" decoding="async"', meta: { benefit: 1, perf: 3, a11y: 0, rel: 0, complexity: 1, risk: 1 }, apply: (fs, f) => editTag(fs, f, (t) => addAttr(addAttr(t.raw, "loading", "lazy"), "decoding", "async")) },
    ],
  },
  {
    kind: "blank-rel", area: "rel", weight: 2, label: "new-tab link without rel=noopener",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p)) {
        const tags = scanTags(text);
        for (const t of tags) if (t.name === "a" && (t.attrs.target || "").toLowerCase() === "_blank" && !/noopener/i.test(t.attrs.rel || "")) out.push(tagFinding(this.kind, p, text, t, tags));
      }
      return out;
    },
    remedies: [
      { id: "a", label: 'rel="noopener"', meta: { benefit: 1, perf: 0, a11y: 0, rel: 2, complexity: 0, risk: 0 }, apply: (fs, f) => editTag(fs, f, (t) => setAttr(t.raw, "rel", ((t.attrs.rel || "") + " noopener").trim())) },
      { id: "b", label: 'rel="noopener noreferrer"', meta: { benefit: 1, perf: 0, a11y: 0, rel: 3, complexity: 0, risk: 1 }, apply: (fs, f) => editTag(fs, f, (t) => setAttr(t.raw, "rel", ((t.attrs.rel || "") + " noopener noreferrer").trim())) },
    ],
  },
  {
    kind: "html-lang", area: "a11y", weight: 3, label: "page has no language",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p)) {
        const tags = scanTags(text);
        const h = tags.find((t) => t.name === "html");
        if (h && !h.attrs.lang) out.push(tagFinding(this.kind, p, text, h, tags));
      }
      return out;
    },
    remedies: [
      { id: "a", label: 'lang="en"', meta: { benefit: 2, perf: 0, a11y: 3, rel: 1, complexity: 0, risk: 0 }, apply: (fs, f) => editTag(fs, f, (t) => setAttr(t.raw, "lang", "en")) },
      { id: "b", label: 'lang="en-NZ"', meta: { benefit: 2, perf: 0, a11y: 3, rel: 1, complexity: 0, risk: 0 }, apply: (fs, f) => editTag(fs, f, (t) => setAttr(t.raw, "lang", "en-NZ")) },
    ],
  },
  {
    kind: "viewport", area: "ux", weight: 3, label: "page has no mobile viewport",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p) && /<head\b/i.test(text) && !scanTags(text).some((t) => t.name === "meta" && (t.attrs.name || "") === "viewport")) out.push(headFinding(this.kind, p, text));
      return out;
    },
    remedies: [
      { id: "a", label: "width=device-width viewport", meta: { benefit: 3, perf: 0, a11y: 1, rel: 1, complexity: 0, risk: 1 }, apply: (fs, f) => insertInHead(fs, f.path, '<meta name="viewport" content="width=device-width, initial-scale=1">') },
    ],
  },
  {
    kind: "meta-desc", area: "seo", weight: 1, label: "indexable page has no description",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p) && p !== "404.html" && /<head\b/i.test(text) && !isNoindex(text)) {
        const tags = scanTags(text);
        if (tags.some((t) => t.name === "meta" && (t.attrs.name || "").toLowerCase() === "description")) continue;
        const title = tags.find((t) => t.name === "title");
        const words = title ? textContent(innerOf(text, title)) : "";
        if (words) out.push(headFinding(this.kind, p, text, { title: words }));
      }
      return out;
    },
    remedies: [
      { id: "a", label: "description from the title", meta: { benefit: 1, perf: 0, a11y: 0, rel: 2, complexity: 1, risk: 0 }, apply: (fs, f) => insertInHead(fs, f.path, `<meta name="description" content="${f.data.title.replace(/"/g, "&quot;")} by MosaicScope, Christchurch.">`) },
    ],
  },
  {
    kind: "btn-name", area: "a11y", weight: 3, label: "button has no accessible name",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p)) {
        const tags = scanTags(text);
        for (const t of tags) if (t.name === "button" && !t.attrs["aria-label"] && !t.attrs["aria-labelledby"] && !textContent(innerOf(text, t).replace(/<[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/[a-z]+>/gi, ""))) {
          const source = t.attrs.title || (t.attrs.id ? humanise(t.attrs.id) : "");
          if (source) out.push(tagFinding(this.kind, p, text, t, tags, { title: t.attrs.title || "", id: t.attrs.id || "" }));
        }
      }
      return out;
    },
    remedies: [
      { id: "a", label: "aria-label from title", meta: { benefit: 2, perf: 0, a11y: 3, rel: 0, complexity: 0, risk: 0 }, apply: (fs, f) => f.data.title ? editTag(fs, f, (t) => addAttr(t.raw, "aria-label", f.data.title)) : null },
      { id: "b", label: "aria-label from id", meta: { benefit: 1, perf: 0, a11y: 2, rel: 0, complexity: 0, risk: 1 }, apply: (fs, f) => f.data.id ? editTag(fs, f, (t) => addAttr(t.raw, "aria-label", humanise(f.data.id))) : null },
    ],
  },
  {
    kind: "field-name", area: "a11y", weight: 3, label: "form field has no label",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p)) {
        const tags = scanTags(text);
        const fors = new Set(tags.filter((t) => t.name === "label" && t.attrs.for).map((t) => t.attrs.for));
        for (const t of tags) {
          if (!["input", "select", "textarea"].includes(t.name)) continue;
          if (["hidden", "submit", "button", "reset", "image"].includes((t.attrs.type || "").toLowerCase())) continue;
          if (t.attrs["aria-label"] || t.attrs["aria-labelledby"] || t.attrs["aria-hidden"] === "true" || t.attrs.tabindex === "-1") continue;
          if (t.attrs.id && fors.has(t.attrs.id)) continue;
          const before = text.slice(0, t.start);
          if (before.lastIndexOf("<label") > before.lastIndexOf("</label")) continue; // wrapped in a label
          const source = t.attrs.placeholder || (t.attrs.name ? humanise(t.attrs.name) : "");
          if (source) out.push(tagFinding(this.kind, p, text, t, tags, { placeholder: t.attrs.placeholder || "", name: t.attrs.name || "" }));
        }
      }
      return out;
    },
    remedies: [
      { id: "a", label: "aria-label from placeholder", meta: { benefit: 2, perf: 0, a11y: 3, rel: 0, complexity: 0, risk: 0 }, apply: (fs, f) => f.data.placeholder ? editTag(fs, f, (t) => addAttr(t.raw, "aria-label", f.data.placeholder)) : null },
      { id: "b", label: "aria-label from field name", meta: { benefit: 1, perf: 0, a11y: 2, rel: 0, complexity: 0, risk: 1 }, apply: (fs, f) => f.data.name ? editTag(fs, f, (t) => addAttr(t.raw, "aria-label", humanise(f.data.name))) : null },
    ],
  },
  {
    kind: "iframe-title", area: "a11y", weight: 2, label: "iframe has no title",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p)) {
        const tags = scanTags(text);
        for (const t of tags) if (t.name === "iframe" && !t.attrs.title && t.attrs.src) out.push(tagFinding(this.kind, p, text, t, tags));
      }
      return out;
    },
    remedies: [
      { id: "a", label: "title from the embed's site", meta: { benefit: 1, perf: 0, a11y: 2, rel: 0, complexity: 0, risk: 0 }, apply: (fs, f) => editTag(fs, f, (t) => { try { return addAttr(t.raw, "title", "Embedded content from " + new URL(t.attrs.src, SITE).hostname.replace(/^www\./, "")); } catch { return null; } }) },
    ],
  },
  {
    kind: "theme-color", area: "ux", weight: 1, label: "page has no theme colour for the phone browser bar",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p) && /<head\b/i.test(text) && !scanTags(text).some((t) => t.name === "meta" && (t.attrs.name || "") === "theme-color")) out.push(headFinding(this.kind, p, text));
      return out;
    },
    remedies: [
      { id: "a", label: "theme colour from the manifest", meta: { benefit: 1, perf: 0, a11y: 0, rel: 1, complexity: 0, risk: 0 }, apply: (fs, f) => {
        let c = "#0e0b0a";
        try { c = JSON.parse(fs["manifest.webmanifest"] || "{}").theme_color || c; } catch { /* keep the default */ }
        return /^#[0-9a-f]{3,8}$/i.test(c) ? insertInHead(fs, f.path, `<meta name="theme-color" content="${c}">`) : null;
      } },
    ],
  },
  {
    kind: "sitemap-page", area: "seo", weight: 1, label: "public page missing from the sitemap",
    detect(files) {
      const map = files["sitemap.xml"];
      if (map == null) return [];
      const out = [];
      for (const [p, text] of Object.entries(files)) {
        if (!/^(?:[a-z0-9-]+\/)?index\.html$/.test(p) || isNoindex(text)) continue;
        const url = `${SITE}/${p.replace(/index\.html$/, "")}`;
        if (!map.includes(`<loc>${url}</loc>`)) out.push({ kind: this.kind, path: "sitemap.xml", line: 1, fp: `${this.kind}|${url}`, data: { url } });
      }
      return out;
    },
    remedies: [
      { id: "a", label: "add, monthly, priority 0.5", meta: { benefit: 1, perf: 0, a11y: 0, rel: 2, complexity: 0, risk: 0 }, apply: (fs, f) => addToSitemap(fs, f.data.url, "monthly", "0.5") },
      { id: "b", label: "add, weekly, priority 0.8", meta: { benefit: 1, perf: 0, a11y: 0, rel: 2, complexity: 0, risk: 1 }, apply: (fs, f) => addToSitemap(fs, f.data.url, "weekly", "0.8") },
    ],
  },
  {
    kind: "script-defer", area: "perf", weight: 2, label: "script in <head> blocks rendering",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p)) {
        const headEnd = text.search(/<\/head\s*>/i);
        const tags = scanTags(text);
        for (const t of tags) if (t.name === "script" && t.attrs.src && t.start < headEnd && !("defer" in t.attrs) && !("async" in t.attrs) && (t.attrs.type || "") !== "module") out.push(tagFinding(this.kind, p, text, t, tags));
      }
      return out;
    },
    remedies: [
      { id: "a", label: "defer", meta: { benefit: 2, perf: 3, a11y: 0, rel: 0, complexity: 1, risk: 2 }, apply: (fs, f) => editTag(fs, f, (t) => t.raw.replace(/<script\b/i, "<script defer")) },
    ],
  },
  {
    kind: "charset", area: "rel", weight: 3, label: "page doesn't declare its character set",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p) && /<head\b/i.test(text) && !scanTags(text).some((t) => t.name === "meta" && ("charset" in t.attrs || /content-type/i.test(t.attrs["http-equiv"] || "")))) out.push(headFinding(this.kind, p, text));
      return out;
    },
    remedies: [
      { id: "a", label: "utf-8 charset", meta: { benefit: 2, perf: 0, a11y: 1, rel: 3, complexity: 0, risk: 0 }, apply: (fs, f) => {
        const text = fs[f.path], head = scanTags(text).find((t) => t.name === "head");
        return head ? { path: f.path, text: text.slice(0, head.end) + '\n<meta charset="utf-8">' + text.slice(head.end) } : null;
      } },
    ],
  },
  {
    kind: "link-name", area: "a11y", weight: 3, label: "link has no accessible name",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p)) {
        const tags = scanTags(text);
        for (const t of tags) {
          if (t.name !== "a" || !t.attrs.href || "hidden" in t.attrs || t.attrs["aria-label"] || t.attrs["aria-labelledby"] || t.attrs["aria-hidden"] === "true") continue;
          const inner = innerOf(text, t);
          if (textContent(inner.replace(/<[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/[a-z]+>/gi, "")) || /<img\b[^>]*\balt="[^"]+"/i.test(inner)) continue;
          let host = "";
          try { host = new URL(t.attrs.href, SITE).hostname.replace(/^www\./, ""); } catch { /* bad href */ }
          if (t.attrs.title || host) out.push(tagFinding(this.kind, p, text, t, tags, { title: t.attrs.title || "", host }));
        }
      }
      return out;
    },
    remedies: [
      { id: "a", label: "aria-label from title", meta: { benefit: 2, perf: 0, a11y: 3, rel: 0, complexity: 0, risk: 0 }, apply: (fs, f) => f.data.title ? editTag(fs, f, (t) => addAttr(t.raw, "aria-label", f.data.title)) : null },
      { id: "b", label: "aria-label from the link's site", meta: { benefit: 1, perf: 0, a11y: 2, rel: 0, complexity: 0, risk: 1 }, apply: (fs, f) => f.data.host ? editTag(fs, f, (t) => addAttr(t.raw, "aria-label", f.data.host === "mosaicscope.pages.dev" ? "MosaicScope" : f.data.host)) : null },
    ],
  },
  {
    kind: "og-title", area: "ux", weight: 1, label: "indexable page has no share title",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p) && p !== "404.html" && /<head\b/i.test(text) && !isNoindex(text)) {
        const tags = scanTags(text);
        if (tags.some((t) => t.name === "meta" && (t.attrs.property || "") === "og:title")) continue;
        const title = tags.find((t) => t.name === "title");
        const words = title ? textContent(innerOf(text, title)) : "";
        if (words) out.push(headFinding(this.kind, p, text, { title: words }));
      }
      return out;
    },
    remedies: [
      { id: "a", label: "og:title from the title", meta: { benefit: 2, perf: 0, a11y: 0, rel: 1, complexity: 0, risk: 0 }, apply: (fs, f) => insertInHead(fs, f.path, `<meta property="og:title" content="${f.data.title.replace(/"/g, "&quot;")}">`) },
    ],
  },
  {
    kind: "og-image", area: "ux", weight: 1, label: "shareable page has no share image",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p) && p !== "404.html" && /<head\b/i.test(text) && !isNoindex(text)) {
        const tags = scanTags(text);
        if (!tags.some((t) => t.name === "meta" && (t.attrs.property || "") === "og:image")) out.push(headFinding(this.kind, p, text));
      }
      return out;
    },
    remedies: [
      { id: "a", label: "the site's og.jpg", meta: { benefit: 2, perf: 0, a11y: 0, rel: 1, complexity: 0, risk: 0 }, apply: (fs, f) => insertInHead(fs, f.path, `<meta property="og:image" content="${SITE}/og.jpg">`) },
    ],
  },
  {
    kind: "css-focus", area: "a11y", weight: 3, label: "stylesheet has no visible keyboard focus style",
    detect(files) {
      return Object.entries(files).filter(([p, t]) => p.endsWith(".css") && !/:focus-visible|:focus\b/.test(t))
        .map(([p]) => ({ kind: this.kind, path: p, line: 1, fp: `css-focus|${p}`, data: {} }));
    },
    remedies: [
      { id: "a", label: "outline on :focus-visible", meta: { benefit: 2, perf: 0, a11y: 3, rel: 0, complexity: 1, risk: 1 }, apply: (fs, f) => appendCss(fs, f.path, ":focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }") },
    ],
  },
  {
    kind: "css-motion", area: "a11y", weight: 2, label: "animations ignore the reduced-motion setting",
    detect(files) {
      return Object.entries(files).filter(([p, t]) => p.endsWith(".css") && /@keyframes|animation\s*:/.test(t) && !/prefers-reduced-motion/.test(t))
        .map(([p]) => ({ kind: this.kind, path: p, line: 1, fp: `css-motion|${p}`, data: {} }));
    },
    remedies: [
      { id: "a", label: "calm animations when reduced motion is on", meta: { benefit: 2, perf: 1, a11y: 3, rel: 0, complexity: 1, risk: 1 }, apply: (fs, f) => appendCss(fs, f.path, "@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; } }") },
    ],
  },
];

// Weaknesses the engine reports but never fixes on its own (they need a person).
export const REPORT_ONLY = [
  {
    kind: "dead-anchor", label: "in-page link points at a missing id",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p)) {
        const tags = scanTags(text);
        const ids = new Set(tags.filter((t) => t.attrs.id).map((t) => t.attrs.id));
        for (const t of tags) {
          const m = t.name === "a" && /^#([\w-]+)$/.exec(t.attrs.href || "");
          if (m && m[1] !== "top" && !ids.has(m[1]) && !text.includes(`id="${m[1]}"`)) out.push({ kind: this.kind, path: p, line: lineOf(text, t.start), fp: `dead-anchor|${p}|${m[1]}`, data: { href: "#" + m[1] } });
        }
      }
      return out;
    },
  },
  {
    kind: "heading-skip", label: "heading level skipped",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p)) {
        let prev = 0;
        for (const t of scanTags(text)) {
          const m = /^h([1-6])$/.exec(t.name);
          if (!m) continue;
          const n = Number(m[1]);
          if (prev && n > prev + 1) { out.push({ kind: this.kind, path: p, line: lineOf(text, t.start), fp: `heading-skip|${p}|${prev}-${n}`, data: { from: "h" + prev, to: "h" + n } }); }
          prev = n;
        }
      }
      return out;
    },
  },
  {
    kind: "dup-id", label: "duplicate id",
    detect(files) {
      const out = [];
      for (const [p, text] of Object.entries(files)) if (isHtml(p)) {
        const seen = new Map();
        for (const t of scanTags(text)) if (t.attrs.id) seen.set(t.attrs.id, (seen.get(t.attrs.id) || 0) + 1);
        for (const [id, n] of seen) if (n > 1) out.push({ kind: this.kind, path: p, line: 1, fp: `dup-id|${p}|${id}`, data: { id, n } });
      }
      return out;
    },
  },
  {
    kind: "no-h1", label: "page has no h1",
    detect(files) {
      return Object.entries(files).filter(([p, t]) => isHtml(p) && /<body\b/i.test(t) && !isNoindex(t) && !scanTags(t).some((x) => x.name === "h1"))
        .map(([p]) => ({ kind: this.kind, path: p, line: 1, fp: `no-h1|${p}`, data: {} }));
    },
  },
  {
    kind: "heavy-file", label: "page file over 150 KB",
    detect(files) {
      return Object.entries(files).filter(([p, t]) => isHtml(p) && t.length > 150_000)
        .map(([p, t]) => ({ kind: this.kind, path: p, line: 1, fp: `heavy-file|${p}`, data: { kb: Math.round(t.length / 1024) } }));
    },
  },
];

function appendCss(files, path, rule) {
  const text = files[path];
  if (text == null || text.includes(rule)) return null;
  return { path, text: text.replace(/\s*$/, "") + "\n\n/* added by the evolution engine */\n" + rule + "\n" };
}

function addToSitemap(files, url, freq, prio) {
  const text = files["sitemap.xml"];
  if (text == null || text.includes(`<loc>${url}</loc>`) || !text.includes("</urlset>")) return null;
  const line = `  <url><loc>${url}</loc><changefreq>${freq}</changefreq><priority>${prio}</priority></url>\n`;
  return { path: "sitemap.xml", text: text.replace("</urlset>", line + "</urlset>") };
}

export const ruleByKind = (k) => RULES.find((r) => r.kind === k);

/** Run every check. Returns { findings, weaknesses } sorted by path and line. */
export function runChecks(files) {
  const sort = (a, b) => a.path.localeCompare(b.path) || a.line - b.line;
  return {
    findings: RULES.flatMap((r) => r.detect(files)).sort(sort),
    weaknesses: REPORT_ONLY.flatMap((r) => r.detect(files)).sort(sort),
  };
}
