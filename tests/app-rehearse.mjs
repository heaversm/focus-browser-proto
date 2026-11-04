// Walks the whole flow with scripted answers (no AI, no cost): intent,
// agreement, explore, compare, send, done. Screenshots each screen into
// test-results/app/. Usage: npm run test:app [-- --headless]
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { launch, openExtensionPage, pageUrl, poll, root, sleep } from "./lib/firefox.mjs";

const headless = process.argv.includes("--headless");
const out = join(root, "test-results/app");
mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, ["server/index.mjs", "--rehearse"], { cwd: root, stdio: "ignore" });
await sleep(800);
const { browser, close } = await launch({ headless });
const results = [];
const check = (name, ok) => { results.push([name, ok]); console.log(`${ok ? "ok " : "BAD"} ${name}`); };
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 }).catch(() => {});
  await openExtensionPage(page, pageUrl("app/index.html"));
  const shot = async (n) => { await sleep(600); await page.screenshot({ path: join(out, `${n}.png`) }); };
  const run = (fn, arg) => page.evaluate(fn, arg);

  await shot("1-intent");
  await run(() => { document.getElementById("intent-input").value = "Plan a hike this Saturday with Sam, Ana and Jo"; document.getElementById("intent-form").requestSubmit(); });
  await poll(page, () => document.body.dataset.screen === "agreement", undefined, 10_000);
  check("agreement shows", true);
  await run(() => { document.getElementById("ag-focus").checked = false; });
  await shot("2-agreement");

  await run(() => document.getElementById("agreement-form").requestSubmit());
  await poll(page, () => document.querySelectorAll("#pieces .piece").length > 0 && !document.body.classList.contains("busy"), undefined, 10_000);
  check("explore pieces drawn", await run(() => document.querySelector('#pieces [data-type="options"]') != null));
  check("off-plan link went to the shelf", await run(() => document.getElementById("shelf-count").textContent === "1"));
  await run(() => document.querySelector("#pieces .src").click());
  await poll(page, () => !document.getElementById("reader").hidden, undefined, 5000);
  await sleep(2500);
  check("reader panel opens on a source", await run(() => (document.getElementById("reader-frame").contentDocument?.body?.innerText ?? "").length > 200));
  await shot("3-explore");

  await run(() => { const picks = document.querySelectorAll("#pieces .pick"); picks[0].click(); picks[2].click(); document.querySelector("#pieces .piece-foot .primary").click(); });
  await poll(page, () => document.querySelector('#pieces [data-type="compare"]') && !document.body.classList.contains("busy"), undefined, 10_000);
  check("compare drawn", true);
  check("reader page from the last screen closed", await run(() => getComputedStyle(document.getElementById("reader")).display === "none"));
  check("stage pill moved to Compare", await run(() => document.querySelector("#bar-stages .now")?.textContent === "Compare"));
  await shot("4-compare");

  await run(() => document.querySelector("#pieces tfoot .primary").click());
  await poll(page, () => document.querySelector('#pieces [data-type="draft"]') && !document.body.classList.contains("busy"), undefined, 10_000);
  await shot("5-send");
  await run(() => document.querySelector('#pieces [data-type="draft"] .primary').click());
  await poll(page, () => document.body.dataset.screen === "done", undefined, 5000);
  check("sending finishes the task", true);
  await sleep(1200);
  await shot("6-done");
} catch (error) {
  check(`flow completed (${error.message})`, false);
} finally {
  await close();
  server.kill();
}
const bad = results.filter(([, ok]) => !ok).length;
console.log(bad ? `\n${bad} check(s) failed.` : `\nAll ${results.length} checks pass. Screenshots in test-results/app/.`);
process.exit(bad ? 1 : 0);
