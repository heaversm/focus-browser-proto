// Checks the tab lock still works after the extension's background script
// has gone idle (it is unloaded after ~30 s). Usage: node tests/lock-idle.mjs
import { spawn } from "node:child_process";
import { launch, openExtensionPage, pageUrl, poll, root, sleep } from "./lib/firefox.mjs";
// Refuse to run against a server that's already up: it may be the real AI, on someone's key.
if (await fetch("http://127.0.0.1:4747/api/status", { method: "POST" }).then(() => true, () => false)) {
  console.error("Something is already running on port 4747 (probably npm start). Quit it first.");
  process.exit(1);
}
const server = spawn(process.execPath, ["server/index.mjs", "--rehearse"], { cwd: root, stdio: "ignore" });
await sleep(800);
const { browser, close } = await launch({ headless: true });
try {
  const page = await browser.newPage();
  await openExtensionPage(page, pageUrl("app/index.html"));
  const run = (fn) => page.evaluate(fn);
  await run(() => { document.getElementById("intent-input").value = "Plan a hike"; document.getElementById("intent-form").requestSubmit(); });
  await poll(page, () => document.body.dataset.screen === "agreement", undefined, 10_000);
  await run(() => { document.getElementById("ag-focus").checked = false; document.getElementById("agreement-form").requestSubmit(); });
  await poll(page, () => document.querySelectorAll("#pieces .piece").length > 0, undefined, 10_000);
  console.log("waiting 40s for the background script to go idle…");
  await sleep(40_000);
  const tabs = await run(async () => {
    const before = (await browser.tabs.query({})).length;
    await browser.tabs.create({ url: "about:blank" });
    await new Promise((r) => setTimeout(r, 2000));
    return [before, (await browser.tabs.query({})).length];
  });
  console.log(tabs[0] === tabs[1] ? `ok  new tab closed after idle ${JSON.stringify(tabs)}` : `BAD new tab survived ${JSON.stringify(tabs)}`);
} catch (e) { console.log("ERROR", e.message); } finally { await close(); server.kill(); }
