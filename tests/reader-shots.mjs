// Screenshots the reader panel on a real run: the bike repair's first screen,
// a parktool.com source opened in reader view, then "Show original".
// Spends API credit (one agreement, one step). Usage: node --env-file-if-exists=.env tests/reader-shots.mjs
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { launch, openExtensionPage, pageUrl, poll, root, sleep } from "./lib/firefox.mjs";

if (await fetch("http://127.0.0.1:4747/api/status", { method: "POST" }).then(() => true, () => false)) {
  console.error("Something is already running on port 4747 (probably npm start). Quit it first.");
  process.exit(1);
}
const out = join(root, "test-results/reader");
mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, ["--env-file-if-exists=.env", "server/index.mjs"], { cwd: root, stdio: "inherit" });
await sleep(800);
const { browser, close } = await launch({ headless: false });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 }).catch(() => {});
  await openExtensionPage(page, pageUrl("app/index.html"));
  const run = (fn, arg) => page.evaluate(fn, arg);
  await run(() => { document.getElementById("intent-input").value = "My road bike's rear gears skip when I pedal hard. Figure out how to fix it myself."; document.getElementById("intent-form").requestSubmit(); });
  await poll(page, () => document.body.dataset.screen === "agreement", undefined, 120_000);
  await run(() => { document.getElementById("ag-focus").checked = false; document.getElementById("ag-cooldown").value = 0; document.getElementById("agreement-form").requestSubmit(); });
  await poll(page, () => document.querySelectorAll("#pieces .piece").length > 0 && !document.body.classList.contains("busy"), undefined, 300_000);
  const opened = await run(() => {
    const src = [...document.querySelectorAll("#pieces .src")].find((b) => b.textContent.includes("parktool")) ?? document.querySelector("#pieces .src");
    src?.click();
    return src?.title ?? null;
  });
  console.log("opened:", opened);
  await poll(page, () => (document.getElementById("reader-frame").contentDocument?.body?.innerText ?? "").length > 400, undefined, 30_000);
  await sleep(4000);
  await page.screenshot({ path: join(out, "reader.png") });
  await run(() => document.getElementById("reader-original").click());
  await sleep(9000);
  await page.screenshot({ path: join(out, "original.png") });
  // Back to reader view, as a second take of the reader shot.
  await run(() => document.getElementById("reader-original").click());
  await poll(page, () => (document.getElementById("reader-frame").contentDocument?.body?.innerText ?? "").length > 400, undefined, 30_000);
  await sleep(4000);
  await page.screenshot({ path: join(out, "reader-2.png") });
  console.log("done");
} catch (e) {
  console.log("ERROR", e.message);
} finally { await close(); server.kill(); }
