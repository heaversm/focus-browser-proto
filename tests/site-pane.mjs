// Test 1 in PLAN.md: can our page show the demo's real pages in a frame, and
// can you click around inside them? Any page that fails is also loaded as a
// normal tab, to tell framing problems from automation problems.
// Usage: npm run test:site-pane [-- --headless]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch, openExtensionPage, pageUrl, poll, root, sleep } from "./lib/firefox.mjs";

const headless = process.argv.includes("--headless");
const out = join(root, "test-results");
mkdirSync(out, { recursive: true });

const { browser, close } = await launch({ headless });
try {
  const page = await browser.newPage();
  await page.setViewport?.({ width: 1600, height: 1000 }).catch(() => {});
  await openExtensionPage(page, pageUrl("site-test/index.html"));
  const { results, topStayed } = await poll(page, () => window.siteTest?.done && window.siteTest, undefined, 180_000);
  await page.screenshot({ path: join(out, "site-pane.png"), fullPage: true });

  // Control: load each failure as a normal tab.
  for (const r of results.filter((r) => !r.pass)) {
    const tab = await browser.newPage();
    await tab.goto(r.url, { waitUntil: "load", timeout: 30_000 }).catch(() => {});
    await sleep(3000);
    await tab.screenshot({ path: join(out, `control-${r.name.replace(/\W+/g, "-")}.png`) }).catch(() => {});
    await tab.close();
  }
  const tops = await page.evaluate(() => browser.runtime.sendMessage({ type: "top-probes" }));
  for (const r of results.filter((r) => !r.pass)) {
    const host = new URL(r.url).host;
    const t = tops.filter((p) => new URL(p.href).host.endsWith(host.replace(/^www\./, ""))).at(-1);
    r.control = t ? (t.textLength > 300 && !t.botWall ? "works as a tab" : t.botWall ? `bot wall as a tab: “${t.title}”` : "thin as a tab") : "no report from the tab";
  }

  writeFileSync(join(out, "site-pane.json"), JSON.stringify({ topStayed, results }, null, 2));
  const yn = (b) => (b ? "yes" : "no ");
  console.log(`\nOur page stayed put: ${topStayed ? "yes" : "NO"}\n`);
  console.log("result  shows  click  page              why it is in the test / control");
  for (const r of results) {
    const errors = r.responses.filter((x) => x.error).map((x) => x.error).join(", ");
    console.log(`${r.pass ? "PASS" : "FAIL"}    ${yn(r.rendered)}    ${yn(r.navigated)}    ${r.name.padEnd(16)}  ${r.why}${errors ? ` · error: ${errors}` : ""}${r.control ? ` · ${r.control}` : ""}`);
    if (!r.pass) console.log(`        title: “${r.title ?? "-"}”, ${r.textLength} chars${r.botWall ? ", bot wall" : ""}${r.clicked ? `, click: ${r.clicked}` : ""}`);
  }
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed} of ${results.length} pass. Screenshot: test-results/site-pane.png`);
} finally {
  await close();
}
