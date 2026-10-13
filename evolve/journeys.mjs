// Synthetic user journeys: the things a visitor actually does, replayed in a real browser.
// Deterministic, no real user data, nothing is ever submitted. Each step either passes or explains why not.
// A journey whose starting element doesn't exist (e.g. no gallery tiles yet) is "skipped", not failed.

export const JOURNEYS = [
  {
    id: "nav-to-rates", name: "Header link jumps to Rates", page: "/",
    async run(page) {
      const link = page.locator('nav a[href="#rates"]').first();
      if (!(await link.count())) return skip("no Rates link");
      await link.click();
      await page.waitForTimeout(900);
      const top = await page.evaluate(() => document.getElementById("rates")?.getBoundingClientRect().top ?? 9999);
      return top < (await page.evaluate(() => innerHeight)) / 2 ? pass() : fail(`#rates ended ${Math.round(top)}px down the screen`);
    },
  },
  {
    id: "quote-builder", name: "Quote builder updates the total", page: "/",
    async run(page) {
      const opt = page.locator('#qb input[type=radio][name=photo]:not([value=none])').first();
      if (!(await opt.count())) return skip("no quote options");
      const before = await page.locator("#qb-sum").textContent();
      await opt.check({ force: true });
      await page.waitForTimeout(250);
      const after = await page.locator("#qb-sum").textContent();
      return after !== before ? pass() : fail(`total stayed "${before?.trim()}"`);
    },
  },
  {
    id: "contact-validation", name: "Enquiry form refuses an empty send", page: "/",
    async run(page) {
      const send = page.locator("#f-send");
      if (!(await send.count())) return skip("no enquiry form");
      let navigated = false;
      page.once("framenavigated", () => { navigated = true; });
      const requests = [];
      const onReq = (r) => { if (r.method() === "POST") requests.push(r.url()); };
      page.on("request", onReq);
      await send.click();
      await page.waitForTimeout(400);
      page.off("request", onReq);
      const invalid = await page.evaluate(() => [...document.querySelectorAll("#form :invalid")].length);
      if (requests.length) return fail("an empty form was sent");
      return invalid > 0 && !navigated ? pass() : fail("no validation shown");
    },
  },
  {
    id: "faq-opens", name: "An FAQ answer opens", page: "/",
    async run(page) {
      const s = page.locator("#faq-list details:not([open]) summary").first(); // a closed one (the first starts open)
      if (!(await s.count())) return skip("no closed FAQ items");
      const before = await page.evaluate(() => document.querySelectorAll("#faq-list details[open]").length);
      await s.click();
      await page.waitForTimeout(200);
      return (await page.evaluate(() => document.querySelectorAll("#faq-list details[open]").length)) > before ? pass() : fail("didn't open");
    },
  },
  {
    id: "work-viewer", name: "A work tile opens and closes", page: "/",
    async run(page) {
      const tile = page.locator("#gallery .tile").first();
      if (!(await tile.count()) || !(await tile.isVisible())) return skip("no work tiles");
      await tile.click();
      await page.waitForTimeout(400);
      const open = await page.evaluate(() => [...document.querySelectorAll("#viewer, #lb")].some((x) => !x.hidden));
      if (!open) return fail("viewer didn't open");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      const closed = await page.evaluate(() => [...document.querySelectorAll("#viewer, #lb")].every((x) => x.hidden));
      return closed ? pass() : fail("Escape didn't close the viewer");
    },
  },
  {
    id: "lost-visitor", name: "404 page leads back home", page: "/404.html",
    async run(page) {
      const home = await page.evaluate(() => [...document.querySelectorAll("a[href]")].some((a) => new URL(a.href).pathname === "/"));
      return home ? pass() : fail("no link back to the home page");
    },
  },
];

const pass = () => ({ status: "pass" });
const fail = (why) => ({ status: "fail", why });
const skip = (why) => ({ status: "skip", why });

/** Run every journey on a fresh page each, at one width. */
export async function runJourneys(browser, base, [w, h], { offline = false } = {}) {
  const out = [];
  for (const j of JOURNEYS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const origin = new URL(base).origin;
    if (offline) await page.route((u) => !u.href.startsWith(origin) && !u.href.startsWith("data:"), (r) => r.abort("blockedbyclient"));
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const t = Date.now();
    let r;
    try {
      await page.goto(base + j.page, { waitUntil: "load", timeout: 20000 });
      await page.waitForTimeout(800);
      r = await j.run(page);
    } catch (e) { r = fail(String(e.message).split("\n")[0].slice(0, 120)); }
    if (r.status === "pass" && errors.length) r = fail("page error: " + errors[0].slice(0, 100));
    out.push({ id: j.id, name: j.name, width: w, ms: Date.now() - t, ...r });
    await ctx.close();
  }
  return out;
}
